import {
  ConfigPlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

const PACKAGE_NAME = 'com.leadnotifier.app';

// Config plugins run in a CommonJS prebuild context that can't resolve a
// sibling .ts module (confirmed: `import { CHANNEL_CALL } from '../channels'`
// fails at prebuild time with a require-resolution error, since channels.ts
// has no compiled .js counterpart on disk) — so the channel IDs are
// duplicated here as literals. MUST stay in sync with channels.ts. This is a
// cross-repo wire contract with the extension (see constitution principle II)
// — a mismatch here means a native post silently targets a non-existent
// channel and Android drops it.
const CHANNEL_BANNER = 'lead-alerts-banner';
const CHANNEL_CALL = 'lead-alerts-call';

// ---------------------------------------------------------------------------
// Kotlin source files written into the Android project
// ---------------------------------------------------------------------------

const PHONECALL_MODULE_KT = `package ${PACKAGE_NAME}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PhonecallNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PhonecallNotification"

    /** Called from JS (backgrounded state) to post a fullscreen-intent notification. */
    @ReactMethod
    fun present(title: String, body: String, leadDataJson: String) {
        postFullScreenNotification(reactContext.applicationContext, title, body, leadDataJson)
    }

    /**
     * Returns true if the app may launch full-screen intents. On Android 14+
     * (API 34) this permission is revoked by default for non-dialer/alarm apps;
     * the user must grant it in system settings (see openFullScreenIntentSettings).
     * This is the ONLY permission required to select Phone Call Alert style —
     * SYSTEM_ALERT_WINDOW is a separate, optional reliability improvement (see
     * canDrawOverlays below), not a prerequisite.
     */
    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 34) {
            val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            promise.resolve(nm.canUseFullScreenIntent())
        } else {
            promise.resolve(true)
        }
    }

    /**
     * Opens the system settings page where the user grants full-screen-intent
     * permission for this app (Android 14+). No-op on older versions. Some OEM
     * builds omit this settings screen, so a failed launch is swallowed rather
     * than crossing the bridge as an unhandled rejection.
     */
    @ReactMethod
    fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                    data = Uri.parse("package:" + reactContext.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            } catch (e: Exception) {
                Log.w(TAG, "openFullScreenIntentSettings failed", e)
            }
        }
    }

    /**
     * Returns true if the app may draw over other apps ("Display over other
     * apps" / SYSTEM_ALERT_WINDOW). NOT required for the full-screen call to
     * work on stock Android — the system launches a full-screen-intent activity
     * as an exempt background start regardless. It matters only on OEM builds
     * (Xiaomi/HyperOS, ColorOS, FuntouchOS, realme UI) that impose extra
     * background-launch restrictions on top of AOSP. Offered as a separate,
     * skippable reliability improvement, never a prerequisite.
     */
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    /**
     * Opens the system "Display over other apps" settings page for this app so
     * the user can grant it. Works the same across OEMs (standard AOSP intent).
     */
    @ReactMethod
    fun openOverlaySettings() {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + reactContext.packageName)
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "openOverlaySettings failed", e)
        }
    }

    /**
     * Returns true if the app is already exempt from battery optimization.
     * Exemption reduces the odds Doze/App Standby delays a killed-app alert.
     */
    @ReactMethod
    fun canIgnoreBatteryOptimizations(promise: Promise) {
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        promise.resolve(pm?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: true)
    }

    /**
     * Opens the system-wide "ignore battery optimizations" list, where the user
     * can find and exempt Lead Notifier themselves. Used only as a fallback —
     * some OEMs don't handle the direct request below, or the user may have
     * declined it once (Android then requires the list for that app).
     */
    @ReactMethod
    fun openBatteryOptimizationSettings() {
        try {
            reactContext.startActivity(
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (e: Exception) {
            Log.w(TAG, "openBatteryOptimizationSettings failed", e)
        }
    }

    /**
     * Shows the direct system Allow/Deny dialog to exempt this app from battery
     * optimization — a single tap, rather than making the user find Lead
     * Notifier in a system-wide list themselves (the OEM battery-manager UI
     * many phones ship is a DIFFERENT, non-standard toggle that does not
     * actually flip this allowlist bit, which is what canIgnoreBatteryOptimizations
     * checks). Requires the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission,
     * which Play reviews under its "unrestricted battery usage" declaration —
     * falls back to the plain list screen if the OEM doesn't support the
     * direct-request intent.
     */
    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        try {
            reactContext.startActivity(
                Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + reactContext.packageName)
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (e: Exception) {
            Log.w(TAG, "requestIgnoreBatteryOptimizations failed, falling back to settings list", e)
            openBatteryOptimizationSettings()
        }
    }

    /** Starts the looping ringtone + vibration (call-style). Safe to call repeatedly — no-ops if already ringing. */
    @ReactMethod
    fun startRinging() {
        Companion.startRinging(reactContext.applicationContext)
    }

    /** Stops the looping ringtone + vibration. Called on dismiss/answer or screen unmount. */
    @ReactMethod
    fun stopRinging() {
        Companion.stopRinging()
    }

    /** Returns true if the native ring/vibrate loop is currently active. */
    @ReactMethod
    fun isRinging(promise: Promise) {
        promise.resolve(Companion.isRinging())
    }

    /**
     * Called from JS on app startup to check if the app was launched via a
     * fullscreen-intent (phonecall lead). Consumes the intent so it isn't
     * read twice on re-renders.
     */
    @ReactMethod
    fun getInitialLeadData(promise: Promise) {
        val activity = reactContext.currentActivity
        val action = activity?.intent?.action
        val leadData = activity?.intent?.getStringExtra("phonecallLeadData")
        if (activity != null && action == "PHONECALL_LEAD" && leadData != null) {
            activity.intent.action = null // consume
            promise.resolve(leadData)
        } else {
            promise.resolve(null)
        }
    }

    companion object {
        private const val TAG = "PhonecallNotifModule"
        private const val NOTIFICATION_TAG = "phonecall_lead"
        private const val NOTIFICATION_ID = 9001
        private const val ACTION_STOP_RINGING = "${PACKAGE_NAME}.STOP_RINGING"

        // Ringing pattern mirrors the "lead-alerts-call" channel's vibration so
        // silent/vibrate-mode devices (whose channel sound is suppressed) still
        // get the same call-like pulses via the native Vibrator.
        private val RING_VIBRATION_PATTERN = longArrayOf(0, 1000, 1000, 1000, 1000, 1000, 1000)
        private const val AUTO_STOP_MS = 45_000L

        private var ringtonePlayer: MediaPlayer? = null
        private var vibrator: Vibrator? = null
        private var audioManager: AudioManager? = null
        private var audioFocusRequest: AudioFocusRequest? = null
        private var autoStopHandler: Handler? = null
        private var autoStopRunnable: Runnable? = null

        fun isRinging(): Boolean = ringtonePlayer != null || vibrator != null

        /**
         * Creates (or updates, if missing) the notification channels natively so
         * a native FCM post is never dropped for targeting a non-existent
         * channel — which happens silently on Android O+ if this runs before
         * the JS side's setupNotifications() has ever completed. Settings must
         * mirror notifications.ts exactly; createNotificationChannel() is a
         * no-op for an already-existing channel ID and never overrides a
         * setting the user has since changed.
         */
        fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (nm.getNotificationChannel("${CHANNEL_CALL}") == null) {
                nm.createNotificationChannel(
                    NotificationChannel("${CHANNEL_CALL}", "Lead Alerts — Phone Call", NotificationManager.IMPORTANCE_HIGH).apply {
                        enableVibration(true)
                        vibrationPattern = RING_VIBRATION_PATTERN
                        enableLights(true)
                        lightColor = Color.RED
                        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                        setShowBadge(true)
                    }
                )
            }
            if (nm.getNotificationChannel("${CHANNEL_BANNER}") == null) {
                nm.createNotificationChannel(
                    NotificationChannel("${CHANNEL_BANNER}", "Lead Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 2000)
                        enableLights(true)
                        lightColor = Color.RED
                        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                        setShowBadge(true)
                    }
                )
            }
        }

        /**
         * Starts the looping ringtone + vibration immediately — independent of
         * React Native booting or the full-screen activity ever launching, so a
         * killed-app alert rings even when it only surfaces as a heads-up
         * notification (FSI denied, phone unlocked, or an OEM restriction).
         * No-ops if already ringing, so a later JS-side startRinging() call
         * (e.g. IncomingLeadScreen mounting) doesn't restart the loop.
         */
        fun startRinging(context: Context) {
            if (isRinging()) return
            try {
                val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager = am

                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(attrs)
                        .build()
                    audioFocusRequest = request
                    am.requestAudioFocus(request)
                } else {
                    @Suppress("DEPRECATION")
                    am.requestAudioFocus(null, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                }

                // Respect the ringer mode: only play audio in normal mode. Vibrate
                // mode and silent mode fall through to vibration-only below.
                if (am.ringerMode == AudioManager.RINGER_MODE_NORMAL) {
                    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    if (uri != null) {
                        ringtonePlayer = MediaPlayer().apply {
                            setDataSource(context.applicationContext, uri)
                            setAudioAttributes(attrs)
                            isLooping = true
                            prepare()
                            start()
                        }
                    }
                }

                if (am.ringerMode != AudioManager.RINGER_MODE_SILENT) {
                    val vib = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    vibrator = vib
                    if (vib != null && vib.hasVibrator()) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            vib.vibrate(VibrationEffect.createWaveform(RING_VIBRATION_PATTERN, 0))
                        } else {
                            @Suppress("DEPRECATION")
                            vib.vibrate(RING_VIBRATION_PATTERN, 0)
                        }
                    }
                }

                val handler = Handler(Looper.getMainLooper())
                val stopRunnable = Runnable { stopRinging() }
                autoStopHandler = handler
                autoStopRunnable = stopRunnable
                handler.postDelayed(stopRunnable, AUTO_STOP_MS)
            } catch (e: Exception) {
                Log.w(TAG, "startRinging failed", e)
                // Ring failed — vibration (if it started before the failure) or
                // the channel's own default sound still provides the alert.
            }
        }

        /** Stops the looping ringtone + vibration and releases every resource it holds. */
        fun stopRinging() {
            autoStopHandler?.let { h -> autoStopRunnable?.let { h.removeCallbacks(it) } }
            autoStopHandler = null
            autoStopRunnable = null

            ringtonePlayer?.let {
                try {
                    if (it.isPlaying) it.stop()
                } catch (e: Exception) {
                    // ignore — still release below
                } finally {
                    it.release()
                }
            }
            ringtonePlayer = null

            vibrator?.cancel()
            vibrator = null

            try {
                val am = audioManager
                val req = audioFocusRequest
                if (am != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && req != null) {
                        am.abandonAudioFocusRequest(req)
                    } else {
                        @Suppress("DEPRECATION")
                        am.abandonAudioFocus(null)
                    }
                }
            } catch (e: Exception) {
                // ignore
            }
            audioManager = null
            audioFocusRequest = null
        }

        fun postFullScreenNotification(
            context: Context,
            title: String,
            body: String,
            leadDataJson: String = "{}",
        ) {
            ensureChannels(context)

            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    action = "PHONECALL_LEAD"
                    putExtra("phonecallLeadData", leadDataJson)
                } ?: return

            val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT

            val pendingIntent = PendingIntent.getActivity(context, 0, launchIntent, piFlags)

            // Delete intent stops the native ring/vibrate loop if the user swipes
            // the notification away without ever opening the app.
            val stopIntent = Intent(context, StopRingingReceiver::class.java).apply {
                action = ACTION_STOP_RINGING
            }
            val deleteIntent = PendingIntent.getBroadcast(context, 0, stopIntent, piFlags)

            val iconRes = context.resources.getIdentifier(
                "notification_icon", "drawable", context.packageName
            ).takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info

            val notification = NotificationCompat.Builder(context, "${CHANNEL_CALL}")
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .setDeleteIntent(deleteIntent)
                .setAutoCancel(true)
                .build()

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_TAG, NOTIFICATION_ID, notification)

            // Ring immediately — do not wait for the full-screen activity to
            // launch or for React Native to boot. This is what makes a killed-app
            // alert behave like an incoming call rather than a notification chime,
            // even when the takeover degrades to a plain heads-up.
            startRinging(context)
        }
    }
}
`;

const PHONECALL_PACKAGE_KT = `package ${PACKAGE_NAME}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PhonecallNotificationPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(PhonecallNotificationModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// Stops the native ring/vibrate loop when the user swipes away the
// full-screen/heads-up notification without opening the app. Registered as
// the notification's setDeleteIntent target; targeted explicitly by
// component, so no intent-filter/action is required in the manifest entry.
const STOP_RINGING_RECEIVER_KT = `package ${PACKAGE_NAME}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StopRingingReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        PhonecallNotificationModule.stopRinging()
    }
}
`;

// Subclasses ExpoFirebaseMessagingService so all non-phonecall FCM messages
// (token refresh, regular pushes) still flow through expo-notifications.
//
// For killed-app phonecall delivery the extension sends a DATA-ONLY Expo push
// (no top-level title/body) whose developer \`data\` object carries
// { type:"phonecall", title, body, lead }. Expo routes the developer data into
// the FCM data map, but the exact key/nesting through Expo's push service is
// not contractually documented, and may itself be JSON-stringified one or more
// levels deep — so findPhonecall() walks the whole data map recursively
// (bounded depth), parsing any string value that looks like JSON, until it
// finds a node whose "type" is "phonecall". The raw payload is logged once per
// message so the real shape can be confirmed on-device via:
//   adb logcat -s LeadNotifSvc
const LEAD_NOTIFICATION_SERVICE_KT = `package ${PACKAGE_NAME}

import android.util.Log
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

class LeadNotificationService : ExpoFirebaseMessagingService() {

    private data class Phonecall(val title: String, val body: String, val lead: String)

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "FCM data: " + remoteMessage.data.toString())
        val phonecall = try {
            findPhonecall(remoteMessage.data)
        } catch (e: Exception) {
            Log.w(TAG, "phonecall parse failed", e)
            null
        }
        if (phonecall != null) {
            Log.d(TAG, "Routing to full-screen intent (phonecall)")
            PhonecallNotificationModule.postFullScreenNotification(
                this, phonecall.title, phonecall.body, phonecall.lead
            )
        } else {
            super.onMessageReceived(remoteMessage)
        }
    }

    /** Wraps the flat FCM data map as a JSON tree, then walks it for our marker. */
    private fun findPhonecall(data: Map<String, String>): Phonecall? {
        val root = JSONObject()
        for ((key, value) in data) root.put(key, value)
        return searchNode(root, depth = 0)
    }

    /**
     * Recursively searches [obj] and any nested object — whether a native
     * JSONObject or a string that itself parses as one — for a node whose
     * "type" is "phonecall", to a bounded depth so a malformed/circular-looking
     * payload can't loop forever.
     */
    private fun searchNode(obj: JSONObject, depth: Int): Phonecall? {
        if (obj.optString("type") == "phonecall") {
            return Phonecall(
                obj.optString("title", "New Lead"),
                obj.optString("body", "New lead purchased!"),
                firstNonEmpty(obj.optString("lead", ""), obj.optString("leadData", "")) ?: "{}",
            )
        }
        if (depth >= MAX_DEPTH) return null

        val keys = obj.keys()
        while (keys.hasNext()) {
            val value = obj.opt(keys.next())
            val nested: JSONObject? = when (value) {
                is JSONObject -> value
                is String -> try { JSONObject(value) } catch (e: Exception) { null }
                else -> null
            }
            if (nested != null) {
                val found = searchNode(nested, depth + 1)
                if (found != null) return found
            }
        }
        return null
    }

    private fun firstNonEmpty(vararg values: String): String? = values.firstOrNull { it.isNotEmpty() }

    companion object {
        private const val TAG = "LeadNotifSvc"
        private const val MAX_DEPTH = 4
    }
}
`;

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const withFullScreenIntent: ConfigPlugin = (config) => {
  // 1. Write Kotlin files and patch MainApplication.kt
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const pkgDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java/com/leadnotifier/app',
      );

      fs.writeFileSync(path.join(pkgDir, 'PhonecallNotificationModule.kt'), PHONECALL_MODULE_KT);
      fs.writeFileSync(path.join(pkgDir, 'PhonecallNotificationPackage.kt'), PHONECALL_PACKAGE_KT);
      fs.writeFileSync(path.join(pkgDir, 'LeadNotificationService.kt'), LEAD_NOTIFICATION_SERVICE_KT);
      fs.writeFileSync(path.join(pkgDir, 'StopRingingReceiver.kt'), STOP_RINGING_RECEIVER_KT);

      // Register the React package in MainApplication.kt
      const mainAppPath = path.join(pkgDir, 'MainApplication.kt');
      let mainApp = fs.readFileSync(mainAppPath, 'utf8');
      if (!mainApp.includes('PhonecallNotificationPackage')) {
        mainApp = mainApp.replace(
          '// add(MyReactNativePackage())',
          '// add(MyReactNativePackage())\n          add(PhonecallNotificationPackage())',
        );
        fs.writeFileSync(mainAppPath, mainApp);
      }

      // Patch MainActivity.kt so a WARM tap on the phonecall heads-up (app already
      // running) refreshes the activity intent — JS then re-reads it via
      // getInitialLeadData() on AppState 'active' and navigates to the lead.
      const mainActPath = path.join(pkgDir, 'MainActivity.kt');
      let mainAct = fs.readFileSync(mainActPath, 'utf8');
      if (!mainAct.includes('fun onNewIntent')) {
        if (!mainAct.includes('import android.content.Intent')) {
          mainAct = mainAct.replace(
            'import android.os.Bundle',
            'import android.content.Intent\nimport android.os.Bundle',
          );
        }
        // Insert the override right after the onCreate(...) block's closing brace.
        mainAct = mainAct.replace(
          /(super\.onCreate\(null\)\s*\n\s*\})/,
          '$1\n\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent) // so getInitialLeadData() sees the tapped notification\n  }',
        );
        fs.writeFileSync(mainActPath, mainAct);
      }

      return mod;
    },
  ]);

  // 2. Patch AndroidManifest.xml
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // Allow MainActivity to show over the lock screen
    const mainActivity = app.activity?.find(
      (a: any) => a.$['android:name'] === '.MainActivity',
    );
    if (mainActivity) {
      (mainActivity as any).$['android:showWhenLocked'] = 'true';
      (mainActivity as any).$['android:turnScreenOn'] = 'true';
    }

    if (!app.service) (app as any).service = [];
    const services: any[] = (app as any).service;

    // Add tools namespace so we can use tools:node="remove"
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Tell the manifest merger to drop expo-notifications' FCM service
    // (declared in the library's own AndroidManifest).
    // Our LeadNotificationService extends it, so nothing is lost.
    const alreadyRemoving = services.some(
      (s) => s.$['android:name'] === 'expo.modules.notifications.service.ExpoFirebaseMessagingService',
    );
    if (!alreadyRemoving) {
      services.push({
        $: {
          'android:name': 'expo.modules.notifications.service.ExpoFirebaseMessagingService',
          'tools:node': 'remove',
        },
      });
    }

    // Register our replacement FCM service
    const hasOurService = services.some(
      (s) => s.$['android:name'] === `${PACKAGE_NAME}.LeadNotificationService`,
    );
    if (!hasOurService) {
      services.push({
        $: {
          'android:name': `${PACKAGE_NAME}.LeadNotificationService`,
          'android:exported': 'false',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] },
        ],
      });
    }

    // Register the delete-intent receiver that stops native ringing when the
    // user swipes away the notification without opening the app. Targeted
    // only by explicit component (see postFullScreenNotification), so no
    // intent-filter is needed.
    if (!app.receiver) (app as any).receiver = [];
    const receivers: any[] = (app as any).receiver;
    const hasStopReceiver = receivers.some(
      (r) => r.$['android:name'] === `${PACKAGE_NAME}.StopRingingReceiver`,
    );
    if (!hasStopReceiver) {
      receivers.push({
        $: {
          'android:name': `${PACKAGE_NAME}.StopRingingReceiver`,
          'android:exported': 'false',
        },
      });
    }

    return mod;
  });

  // 3. Ensure the app module's own compile classpath has firebase-messaging.
  // expo-notifications declares it as `implementation` (not `api`) in its own
  // module, so it is NOT transitively exposed to a sibling Gradle module —
  // without this, LeadNotificationService.kt's `import
  // com.google.firebase.messaging.RemoteMessage` fails to resolve at compile
  // time. This must go through the plugin, not a hand-edit to
  // android/app/build.gradle, or the next `expo prebuild --clean` silently
  // drops it and the native build breaks.
  config = withAppBuildGradle(config, (mod) => {
    const dep = 'implementation("com.google.firebase:firebase-messaging")';
    if (!mod.modResults.contents.includes(dep)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")\n    ${dep} // needed for RemoteMessage in LeadNotificationService.kt — see plugins/withFullScreenIntent.ts`,
      );
    }
    return mod;
  });

  return config;
};

export default withFullScreenIntent;
