package com.leadnotifier.app

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
