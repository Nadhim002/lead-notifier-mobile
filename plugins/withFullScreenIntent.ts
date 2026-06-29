import {
  ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

const PACKAGE_NAME = 'com.leadnotifier.app';

// Config plugins run in a CommonJS prebuild context that can't resolve the
// sibling TS module, so the phonecall channel ID is duplicated here as a
// literal. MUST stay in sync with CHANNEL_CALL in ../channels.ts.
const CHANNEL_CALL = 'lead-alerts-call';

// ---------------------------------------------------------------------------
// Kotlin source files written into the Android project
// ---------------------------------------------------------------------------

const PHONECALL_MODULE_KT = `package ${PACKAGE_NAME}

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PhonecallNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "PhonecallNotification"

    private var ringtonePlayer: MediaPlayer? = null

    /** Called from JS (backgrounded state) to post a fullscreen-intent notification. */
    @ReactMethod
    fun present(title: String, body: String, leadDataJson: String) {
        postFullScreenNotification(reactContext.applicationContext, title, body, leadDataJson)
    }

    /**
     * Returns true if the app may launch full-screen intents. On Android 14+
     * (API 34) this permission is revoked by default for non-dialer/alarm apps;
     * the user must grant it in system settings (see openFullScreenIntentSettings).
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
     * permission for this app (Android 14+). No-op on older versions.
     */
    @ReactMethod
    fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT >= 34) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.parse("package:" + reactContext.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        }
    }

    /**
     * Plays the device's default ringtone on a loop (call-style). Called when
     * the IncomingLeadScreen mounts. Safe to call repeatedly — restarts cleanly.
     */
    @ReactMethod
    fun startRinging() {
        stopRinging()
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val player = MediaPlayer().apply {
                setDataSource(reactContext.applicationContext, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
            ringtonePlayer = player
        } catch (e: Exception) {
            // ignore — vibration still provides the alert
        }
    }

    /** Stops the looping ringtone. Called on dismiss/answer or screen unmount. */
    @ReactMethod
    fun stopRinging() {
        ringtonePlayer?.let {
            try { if (it.isPlaying) it.stop(); it.release() } catch (e: Exception) {}
        }
        ringtonePlayer = null
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
        private const val NOTIFICATION_TAG = "phonecall_lead"
        private const val NOTIFICATION_ID = 9001

        fun postFullScreenNotification(
            context: Context,
            title: String,
            body: String,
            leadDataJson: String = "{}",
        ) {
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
                .setAutoCancel(true)
                .build()

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_TAG, NOTIFICATION_ID, notification)
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

// Subclasses ExpoFirebaseMessagingService so all non-phonecall FCM messages
// (token refresh, regular pushes) still flow through expo-notifications.
//
// For killed-app phonecall delivery the extension sends a DATA-ONLY Expo push
// (no top-level title/body) whose developer \`data\` object carries
// { type:"phonecall", title, body, lead }. Expo routes the developer data into
// the FCM data map, but the exact key/nesting through Expo's push service is
// not contractually documented — so findPhonecall() searches every plausible
// location (flat data["type"], a JSON string under data["body"], and a nested
// "data" object inside it). The raw payload is logged once per message so the
// real shape can be confirmed on-device via:  adb logcat -s LeadNotifSvc
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

    /** Looks for our { type:"phonecall", ... } marker in any plausible location. */
    private fun findPhonecall(data: Map<String, String>): Phonecall? {
        // 1. Flat top-level keys (raw FCM send, bypassing Expo)
        if (data["type"] == "phonecall") {
            return Phonecall(
                data["title"] ?: "New Lead",
                data["body"] ?: "New lead purchased!",
                data["lead"] ?: data["leadData"] ?: "{}",
            )
        }
        // 2. Developer data JSON-stringified under the "body" key (Expo path)
        val bodyStr = data["body"] ?: return null
        val obj = try { JSONObject(bodyStr) } catch (e: Exception) { return null }
        // Marker may sit at the root of that object, or nested under a "data" object.
        val nested = obj.optJSONObject("data")
        val candidate = when {
            obj.optString("type") == "phonecall" -> obj
            nested != null && nested.optString("type") == "phonecall" -> nested
            else -> return null
        }
        return Phonecall(
            candidate.optString("title", "New Lead"),
            candidate.optString("body", "New lead purchased!"),
            candidate.optString("lead", "{}"),
        )
    }

    companion object {
        private const val TAG = "LeadNotifSvc"
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

    return mod;
  });

  return config;
};

export default withFullScreenIntent;
