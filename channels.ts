// Android notification channel IDs — single source of truth for the mobile app.
//
// WIRE CONTRACT: these IDs must stay in sync with the extension's copies in
// indiamart-extension/public/channels.js and src/panel/lib/channels.ts.
// The extension sends pushes targeting these channel IDs; a mismatch means
// the push references a channel that does not exist on the device and Android
// silently drops it. Update both codebases together.
//
// Version-free, semantic names. NOTE: Android freezes a channel's vibration/
// sound settings at first creation — to change those settings on existing
// installs you must rename the channel (new ID), not edit the old one.

export const CHANNEL_BANNER = 'lead-alerts-banner';
export const CHANNEL_CALL = 'lead-alerts-call';
