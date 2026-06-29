package com.leadnotifier.app

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

            val notification = NotificationCompat.Builder(context, "lead-alerts-call")
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
