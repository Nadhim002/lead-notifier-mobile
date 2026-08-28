// Seed synthetic lead history for the Play Store reviewer account, so the
// reviewer sees a working app instead of an empty HomeScreen.
//
// No service-account key is needed. The database rules already let an account
// write its own leads:
//
//   accounts/$email/leads/new  .write =
//     auth.token.email.toLowerCase().replace('.', ',') === $email
//
// ...so this script simply signs in AS the review account (email/password) and
// writes to its own path. Nothing here can touch any other account, and no
// secret is stored in the repo.
//
// The subscription record is NOT written here — accounts/$email/subscription is
// admin-only by rule. Create it through your normal admin flow first, or the
// reviewer will land on LockoutScreen.
//
// Usage:
//   node scripts/seed-review-leads.mjs <review-email> <password>
//   node scripts/seed-review-leads.mjs <review-email> <password> --clear
//
// Corporate network note: behind a Zscaler TLS proxy, prefix with
// NODE_TLS_REJECT_UNAUTHORIZED=0 (see DEBUG.md).

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, push, set, remove } from 'firebase/database';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB1ynT9OknXikIviuXNL-6xU_u3NbFd1R0',
  authDomain: 'indiamart-extension-notifier.firebaseapp.com',
  databaseURL:
    'https://indiamart-extension-notifier-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'indiamart-extension-notifier',
  storageBucket: 'indiamart-extension-notifier.firebasestorage.app',
  messagingSenderId: '797004741619',
  appId: '1:797004741619:web:9733864b41beafb10e3086',
};

// Mirror of email.ts :: sanitizeEmail — keep in sync.
const ILLEGAL_TO_SAFE = { '.': ',', '#': '%23', $: '%24', '[': '%5B', ']': '%5D' };
function sanitizeEmail(email) {
  return email
    .trim()
    .toLowerCase()
    .replace(/[.#$[\]]/g, (ch) => ILLEGAL_TO_SAFE[ch] ?? ch);
}

// Wholly fictional buyers. Mobile numbers use the 90000000XX pattern so they
// read as obviously synthetic, while deliberately avoiding the exact sentinel
// '9000000000' — that one triggers the [TEST] badge (see dummyLead.ts), and the
// reviewer should see the app exactly as a paying user does.
const DAY = 86_400_000;
const HOUR = 3_600_000;

const SAMPLE_LEADS = [
  { title: 'Enquiry for Cotton Tote Bags', buyerName: 'Arun Mehta',      buyerMobile: '9000000012', quantity: '500 Pieces',  price: 12500, city: 'Mumbai',    state: 'Maharashtra',   ageMs: 2 * HOUR },
  { title: 'Enquiry for Jute Shopping Bags', buyerName: 'Priya Nair',     buyerMobile: '9000000023', quantity: '1000 Pieces', price: 28000, city: 'Kochi',     state: 'Kerala',        ageMs: 6 * HOUR },
  { title: 'Enquiry for Canvas Backpacks',  buyerName: 'Rahul Deshpande', buyerMobile: '9000000034', quantity: '250 Pieces',  price: 47500, city: 'Pune',      state: 'Maharashtra',   ageMs: 20 * HOUR },
  { title: 'Enquiry for Non-Woven Carry Bags', buyerName: 'Sneha Iyer',   buyerMobile: '9000000045', quantity: '2000 Pieces', price: 16000, city: 'Bengaluru', state: 'Karnataka',     ageMs: 1 * DAY + 3 * HOUR },
  { title: 'Enquiry for Laptop Sleeves',    buyerName: 'Vikram Singh',    buyerMobile: '9000000056', quantity: '300 Pieces',  price: 33000, city: 'Jaipur',    state: 'Rajasthan',     ageMs: 1 * DAY + 9 * HOUR },
  { title: 'Enquiry for Drawstring Pouches', buyerName: 'Meera Krishnan', buyerMobile: '9000000067', quantity: '1500 Pieces', price: 21000, city: 'Chennai',   state: 'Tamil Nadu',    ageMs: 2 * DAY + 5 * HOUR },
  { title: 'Enquiry for Printed Paper Bags', buyerName: 'Imran Qureshi',  buyerMobile: '9000000078', quantity: '5000 Pieces', price: 39000, city: 'Hyderabad', state: 'Telangana',     ageMs: 3 * DAY + 2 * HOUR },
  { title: 'Enquiry for Insulated Lunch Bags', buyerName: 'Kavita Joshi', buyerMobile: '9000000089', quantity: '400 Pieces',  price: 26400, city: 'Ahmedabad', state: 'Gujarat',       ageMs: 4 * DAY + 7 * HOUR },
  { title: 'Enquiry for Gift Hamper Boxes', buyerName: 'Sanjay Rao',      buyerMobile: '9000000090', quantity: '750 Pieces',  price: 52500, city: 'Kolkata',   state: 'West Bengal',   ageMs: 6 * DAY + 1 * HOUR },
  { title: 'Enquiry for Reusable Produce Bags', buyerName: 'Anjali Verma', buyerMobile: '9000000091', quantity: '3000 Pieces', price: 18000, city: 'Lucknow',  state: 'Uttar Pradesh', ageMs: 8 * DAY + 4 * HOUR },
  { title: 'Enquiry for Leather Duffel Bags', buyerName: 'Farhan Ali',    buyerMobile: '9000000092', quantity: '120 Pieces',  price: 96000, city: 'Delhi',     state: 'Delhi',         ageMs: 11 * DAY + 6 * HOUR },
  { title: 'Enquiry for School Bags',       buyerName: 'Deepak Menon',    buyerMobile: '9000000093', quantity: '800 Pieces',  price: 64000, city: 'Coimbatore', state: 'Tamil Nadu',   ageMs: 14 * DAY + 2 * HOUR },
];

const [emailArg, passwordArg, ...flags] = process.argv.slice(2);
const clear = flags.includes('--clear');

if (!emailArg || !passwordArg) {
  console.error('usage: node scripts/seed-review-leads.mjs <review-email> <password> [--clear]');
  process.exit(1);
}

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

try {
  await signInWithEmailAndPassword(auth, emailArg.trim().toLowerCase(), passwordArg);
} catch (e) {
  console.error(`Sign-in failed (${e.code ?? 'unknown'}): ${e.message}`);
  console.error('Enable the Email/Password provider in Firebase Console → Authentication →');
  console.error('Sign-in method, and create this user, before running this script.');
  process.exit(1);
}

const accountKey = sanitizeEmail(emailArg);
const leadsPath = `accounts/${accountKey}/leads/new`;
console.log(`Signed in as ${emailArg}`);
console.log(`Target: ${leadsPath}`);

if (clear) {
  await remove(ref(db, leadsPath));
  console.log('Cleared existing leads.');
}

const now = Date.now();
let written = 0;
for (const lead of SAMPLE_LEADS) {
  const { ageMs, ...fields } = lead;
  const entry = { ...fields, timestamp: now - ageMs };
  const entryRef = push(ref(db, leadsPath));
  await set(entryRef, entry);
  written += 1;
  console.log(`  + ${entry.title} — ${entry.buyerName} (${entry.city})`);
}

console.log(`\nDone. Wrote ${written} synthetic leads.`);
console.log('These are fictional buyers; no real personal data is used.');
process.exit(0);
