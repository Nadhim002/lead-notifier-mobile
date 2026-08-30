package com.leadnotifier.app

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
        private const val ACTION_STOP_RINGING = "com.leadnotifier.app.STOP_RINGING"

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

            if (nm.getNotificationChannel("lead-alerts-call") == null) {
                nm.createNotificationChannel(
                    NotificationChannel("lead-alerts-call", "Lead Alerts — Phone Call", NotificationManager.IMPORTANCE_HIGH).apply {
                        enableVibration(true)
                        vibrationPattern = RING_VIBRATION_PATTERN
                        enableLights(true)
                        lightColor = Color.RED
                        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                        setShowBadge(true)
                    }
                )
            }
            if (nm.getNotificationChannel("lead-alerts-banner") == null) {
                nm.createNotificationChannel(
                    NotificationChannel("lead-alerts-banner", "Lead Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
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

            val notification = NotificationCompat.Builder(context, "lead-alerts-call")
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
