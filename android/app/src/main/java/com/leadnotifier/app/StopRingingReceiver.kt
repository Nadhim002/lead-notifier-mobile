package com.leadnotifier.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StopRingingReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        PhonecallNotificationModule.stopRinging()
    }
}
