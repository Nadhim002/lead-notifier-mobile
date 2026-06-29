import {
  ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

const PACKAGE_NAME = 'com.leadnotifier.app';

// ---------------------------------------------------------------------------
// Kotlin source files written into the Android project
// ---------------------------------------------------------------------------

const PHONECALL_MODULE_KT = `package ${PACKAGE_NAME}

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
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
     * Called from JS on app startup to check if the app was launched via a
     * fullscreen-intent (phonecall lead). Consumes the intent so it isn't
     * read twice on re-renders.
     */
    @ReactMethod
    fun getInitialLeadData(promise: Promise) {
        val activity = currentActivity
        val action = activity?.intent?.action
        val leadData = activity?.intent?.getStringExtra("phonecallLeadData")
        if (action == "PHONECALL_LEAD" && leadData != null) {
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

            val notification = NotificationCompat.Builder(context, "lead-alerts-phonecall-v2")
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
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
// For killed-app phonecall delivery this requires the service worker to send
// a data-only FCM message (no "notification" key) with data.type="phonecall".
const LEAD_NOTIFICATION_SERVICE_KT = `package ${PACKAGE_NAME}

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class LeadNotificationService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        if (remoteMessage.data["type"] == "phonecall") {
            val title = remoteMessage.data["title"] ?: "New Lead"
            val body  = remoteMessage.data["body"]  ?: "New lead purchased!"
            val lead  = remoteMessage.data["leadData"] ?: "{}"
            PhonecallNotificationModule.postFullScreenNotification(this, title, body, lead)
        } else {
            super.onMessageReceived(remoteMessage)
        }
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
