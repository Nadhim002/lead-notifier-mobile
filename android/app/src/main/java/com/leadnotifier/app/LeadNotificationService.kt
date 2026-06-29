package com.leadnotifier.app

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
