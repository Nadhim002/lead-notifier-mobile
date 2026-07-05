// Mirror of the extension's src/shared/email.ts. Firebase RTDB keys cannot
// contain '.', '#', '$', '[', or ']', so account emails are sanitized into a
// legal key for the accounts/{sanitizedEmail} path. MUST stay in sync with the
// extension and admin dashboard sanitizers or the two clients won't meet.

const ILLEGAL_TO_SAFE: Record<string, string> = {
  '.': ',',
  '#': '%23',
  '$': '%24',
  '[': '%5B',
  ']': '%5D',
};

export function sanitizeEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[.#$[\]]/g, (ch) => ILLEGAL_TO_SAFE[ch] ?? ch);
}
