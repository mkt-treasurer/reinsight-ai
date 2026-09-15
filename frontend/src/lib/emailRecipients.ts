// Recipient helpers for the slip email-draft flow. `extractEmails` mines the
// source materials (pasted cedent/reinsurer email, extracted fields, reinsurer
// directory) for candidate addresses so the compose modal can *recommend*
// To / Cc / Reply-To rather than leaving them blank. `addRecipient` appends a
// picked candidate to a semicolon-joined field without creating duplicates.

// Pragmatic address matcher — good enough for mining free text / known fields.
// Not an RFC 5322 validator (those are notoriously over-broad); this favours
// precision so we don't surface junk tokens as suggestions.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Unique email addresses across all sources, in first-seen order.
 *  Case-insensitive dedupe; trailing punctuation is trimmed. */
export function extractEmails(...sources: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    const matches = src.match(EMAIL_RE);
    if (!matches) continue;
    for (const raw of matches) {
      const email = raw.replace(/[.,;:]+$/, "");
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(email);
    }
  }
  return out;
}

/** Append `email` to a semicolon-joined recipient string, skipping duplicates
 *  (case-insensitive). Returns the field unchanged if already present. */
export function addRecipient(current: string, email: string): string {
  const parts = current
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === email.toLowerCase())) return current;
  return [...parts, email].join("; ");
}
