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
            val leadJson = firstNonEmpty(obj.optString("lead", ""), obj.optString("leadData", "")) ?: "{}"
            val rawTitle = obj.optString("title", "New Lead")
            // The payload's title is whatever the browser extension sent — this app
            // doesn't control it. Derive dummy-ness ourselves from the lead record
            // (mirrors dummyLead.ts's isDummyLead) so "[TEST]" marking is reliable
            // on this fully-killed-app path too, not just the JS-driven paths.
            val title = if (!rawTitle.startsWith(TEST_PREFIX) && isDummyLead(leadJson)) {
                "$TEST_PREFIX$rawTitle"
            } else {
                rawTitle
            }
            return Phonecall(title, obj.optString("body", "New lead purchased!"), leadJson)
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

    /** Mirrors dummyLead.ts's isDummyLead/normalizeMobile — keep both in sync. */
    private fun isDummyLead(leadJson: String): Boolean {
        val mobile = try {
            JSONObject(leadJson).optString("buyerMobile", "")
        } catch (e: Exception) {
            return false
        }
        if (mobile.isEmpty()) return false
        val digits = mobile.filter { it.isDigit() }
        val normalized = if (digits.length == 12 && digits.startsWith("91")) digits.substring(2) else digits
        return normalized == DUMMY_BUYER_MOBILE
    }

    companion object {
        private const val TAG = "LeadNotifSvc"
        private const val MAX_DEPTH = 4
        private const val TEST_PREFIX = "[TEST] "
        private const val DUMMY_BUYER_MOBILE = "9000000000"
    }
}
