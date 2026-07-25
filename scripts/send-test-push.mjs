// Fire a synthetic lead through the REAL Expo push transport — the exact same
// payload shape the extension sends in production (see
// indiamart-extension/src/shared/pushPayload.ts :: buildExpoMessage). Lets you
// test the phone's notification path (delivery → native parse → display /
// full-screen intent) from the terminal, without opening Chrome.
//
// Pair it with adb to watch the whole chain on a killed app:
//   adb shell am kill com.leadnotifier.app        # simulate swipe-away (NOT force-stop)
//   adb logcat -c
//   node scripts/send-test-push.mjs --style=phonecall <ExponentPushToken...>
//   adb logcat -d -s LeadNotifSvc                  # + `adb shell dumpsys notification`
//
// Corporate network note: this machine is behind a Zscaler TLS proxy, so Node's
// fetch fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. Prefix with
// NODE_TLS_REJECT_UNAUTHORIZED=0 (see DEBUG.md). curl/Chrome are unaffected
// because they trust the Zscaler root from the OS keychain.
//
// Usage:
//   node scripts/send-test-push.mjs [--style=phonecall|headsup] <token> [token...]

const args = process.argv.slice(2);
let style = 'phonecall';
const tokens = [];
for (const a of args) {
  if (a.startsWith('--style=')) style = a.slice('--style='.length);
  else tokens.push(a);
}

if (tokens.length === 0 || !['phonecall', 'headsup'].includes(style)) {
  console.error('usage: node scripts/send-test-push.mjs [--style=phonecall|headsup] <ExponentPushToken...>');
  process.exit(1);
}

const CHANNEL_BANNER = 'lead-alerts-banner'; // must match channels.ts

const payload = {
  title: 'Test Lead — synthetic',
  buyerName: 'Test Buyer',
  buyerMobile: '9000000000',
  quantity: '100',
  city: 'Mumbai',
  state: 'Maharashtra',
  timestamp: Date.now(),
};
const body = [payload.buyerName, payload.city, payload.state].filter(Boolean).join(' — ');

// Mirror of buildExpoMessage() — keep in sync with @shared/pushPayload.
function buildExpoMessage(token) {
  return style === 'phonecall'
    ? {
        to: token,
        data: { type: 'phonecall', title: payload.title, body, lead: JSON.stringify(payload) },
        priority: 'high',
        _contentAvailable: true,
      }
    : {
        to: token,
        title: payload.title,
        body,
        channelId: CHANNEL_BANNER,
        priority: 'high',
        sound: 'default',
        data: payload,
      };
}

const messages = tokens.map(buildExpoMessage);
const res = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(messages),
});
console.log(`style=${style}  HTTP ${res.status}`);
console.log(JSON.stringify(await res.json(), null, 2));
