import { describe, it, expect } from "vitest";
import { buildEml } from "./eml";

// Decode a base64 block (joined, CRLF-stripped) back to bytes / text.
function decodeBytes(b64Block: string): Buffer {
  return Buffer.from(b64Block.replace(/\r\n/g, ""), "base64");
}
function decodeText(b64Block: string): string {
  return decodeBytes(b64Block).toString("utf8");
}

// Pull the raw (still base64) body of the part whose headers contain `marker`,
// up to the next boundary or the terminal boundary.
function partBody(eml: string, boundary: string, marker: string): string {
  const idx = eml.indexOf(marker);
  const start = eml.indexOf("\r\n\r\n", idx) + 4;
  const end = eml.indexOf(`\r\n--${boundary}`, start);
  return eml.slice(start, end);
}

function getBoundary(eml: string): string {
  const m = eml.match(/boundary="([^"]+)"/);
  if (!m) throw new Error("no boundary");
  return m[1];
}

describe("buildEml — no attachment", () => {
  const eml = buildEml({
    to: "a@b.com",
    subject: "Hello",
    bodyText: "Line one\nLine two",
  });

  it("starts with the X-Unsent draft header", () => {
    expect(eml.startsWith("X-Unsent: 1\r\n")).toBe(true);
  });

  it("emits a single text/plain body, no multipart", () => {
    expect(eml).toContain('Content-Type: text/plain; charset="utf-8"');
    expect(eml).not.toContain("multipart/mixed");
  });

  it("round-trips the body through base64", () => {
    const body = eml.slice(eml.indexOf("\r\n\r\n") + 4).trimEnd();
    expect(decodeText(body)).toBe("Line one\nLine two");
  });
});

describe("buildEml — with attachment", () => {
  // 600 bytes forces base64 line-wrapping (> 76 chars per line).
  const bytes = new Uint8Array(600).map((_, i) => (i * 31) % 256);
  const eml = buildEml({
    to: "under@reinsurer.com",
    cc: "ops@broker.com",
    subject: "Slip",
    bodyText: "Dear Reinsurer,\n\nRegards",
    attachments: [{ filename: "slip.pdf", mimeType: "application/pdf", bytes }],
  });
  const boundary = getBoundary(eml);

  it("carries To and Cc headers", () => {
    expect(eml).toContain("To: under@reinsurer.com");
    expect(eml).toContain("Cc: ops@broker.com");
  });

  it("declares multipart/mixed and a content-disposition attachment", () => {
    expect(eml).toContain("multipart/mixed");
    expect(eml).toContain('Content-Disposition: attachment; filename="slip.pdf"');
  });

  it("has two opening boundaries and one closing boundary", () => {
    const opens = eml.match(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!--)`, "g"));
    expect(opens?.length).toBe(2);
    expect(eml).toContain(`--${boundary}--`);
  });

  it("round-trips the attachment bytes exactly", () => {
    const decoded = decodeBytes(partBody(eml, boundary, 'filename="slip.pdf"'));
    expect(decoded.length).toBe(600);
    expect([...decoded]).toEqual([...bytes]);
  });

  it("round-trips the text body", () => {
    const decoded = decodeText(partBody(eml, boundary, 'text/plain; charset="utf-8"'));
    expect(decoded).toBe("Dear Reinsurer,\n\nRegards");
  });

  it("wraps attachment base64 at <= 76 chars per line", () => {
    const block = partBody(eml, boundary, 'filename="slip.pdf"');
    for (const line of block.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });
});

describe("buildEml — subject encoding", () => {
  it("passes plain ASCII subjects through unchanged", () => {
    const eml = buildEml({ subject: "Plain ASCII Subject", bodyText: "x" });
    expect(eml).toContain("Subject: Plain ASCII Subject\r\n");
  });

  it("MIME-encodes non-ASCII (Korean) subjects, decodable back", () => {
    const subject = "[INS Corp] 요율 견적 요청서";
    const eml = buildEml({ subject, bodyText: "x" });
    const m = eml.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/);
    expect(m).not.toBeNull();
    expect(Buffer.from(m![1], "base64").toString("utf8")).toBe(subject);
  });
});
