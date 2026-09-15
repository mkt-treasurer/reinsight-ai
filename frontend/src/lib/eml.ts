// Client-side RFC 822 / MIME .eml builder for "open as editable Outlook draft".
//
// The `X-Unsent: 1` header is the key: Outlook for Windows (and the new
// Outlook) opens a .eml carrying it in *compose* mode — an editable new mail
// with the recipients, subject, body and attachments already populated —
// rather than rendering it as a received message. The whole thing is built in
// the browser; no mail server, no backend round-trip.
//
// Usage: build a slip PDF, hand its bytes in as an attachment, then
// `downloadEml(name, buildEml({...}))`. The operator double-clicks the file
// and Outlook opens the draft, ready to review and send.

const CRLF = "\r\n";
// RFC 2045 caps base64 transport lines at 76 characters.
const BASE64_LINE = 76;
// btoa() chokes on multi-megabyte binary strings if built with a single
// String.fromCharCode(...spread); slice the bytes into safe chunks instead.
const CHUNK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function wrapBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += BASE64_LINE) {
    lines.push(b64.slice(i, i + BASE64_LINE));
  }
  return lines.join(CRLF);
}

// MIME "encoded-word" for header values containing non-ASCII (e.g. a Korean
// subject or display name). Pure-ASCII values pass through untouched so plain
// English subjects stay human-readable in the raw .eml.
function encodeHeaderValue(value: string): string {
  // Non-ASCII anywhere → MIME encode the whole value.
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

export interface EmlAttachment {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface EmlInput {
  to?: string;
  cc?: string;
  /** Reply-To address — where the recipient's reply should be routed. */
  replyTo?: string;
  subject: string;
  bodyText: string;
  attachments?: EmlAttachment[];
}

function mimePart(headerLines: string[], body: string): string {
  return headerLines.join(CRLF) + CRLF + CRLF + body;
}

/** Serialise an editable Outlook draft as a MIME .eml string. */
export function buildEml(input: EmlInput): string {
  const headers: string[] = ["X-Unsent: 1"];
  if (input.to) headers.push(`To: ${input.to}`);
  if (input.cc) headers.push(`Cc: ${input.cc}`);
  if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`);
  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`);
  headers.push("MIME-Version: 1.0");

  const attachments = input.attachments ?? [];
  const bodyBase64 = wrapBase64(utf8ToBase64(input.bodyText));

  // No attachment → a single text/plain body, no multipart wrapper.
  if (attachments.length === 0) {
    headers.push('Content-Type: text/plain; charset="utf-8"');
    headers.push("Content-Transfer-Encoding: base64");
    return headers.join(CRLF) + CRLF + CRLF + bodyBase64 + CRLF;
  }

  const boundary = `----=_reinsight_${Date.now().toString(36)}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const blocks: string[] = [
    mimePart(
      ['Content-Type: text/plain; charset="utf-8"', "Content-Transfer-Encoding: base64"],
      bodyBase64
    ),
  ];
  for (const att of attachments) {
    blocks.push(
      mimePart(
        [
          `Content-Type: ${att.mimeType}; name="${att.filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${att.filename}"`,
        ],
        wrapBase64(bytesToBase64(att.bytes))
      )
    );
  }

  const multipartBody =
    blocks.map((block) => `--${boundary}${CRLF}${block}`).join(CRLF) +
    CRLF +
    `--${boundary}--`;

  return headers.join(CRLF) + CRLF + CRLF + multipartBody + CRLF;
}

/** Trigger a browser download of the .eml so Outlook can open it as a draft. */
export function downloadEml(filename: string, eml: string): void {
  const name = filename.toLowerCase().endsWith(".eml") ? filename : `${filename}.eml`;
  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
