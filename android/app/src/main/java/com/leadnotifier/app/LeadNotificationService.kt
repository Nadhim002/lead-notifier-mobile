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
