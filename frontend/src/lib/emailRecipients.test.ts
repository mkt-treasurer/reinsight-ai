import { describe, it, expect } from "vitest";
import { extractEmails, addRecipient } from "./emailRecipients";
import { buildEml } from "./eml";

describe("extractEmails", () => {
  it("pulls addresses out of free text", () => {
    const text = "From: jane.doe@munichre.com\nCc: ops@swissre.co.uk, no-reply@x.io";
    expect(extractEmails(text)).toEqual([
      "jane.doe@munichre.com",
      "ops@swissre.co.uk",
      "no-reply@x.io",
    ]);
  });

  it("dedupes case-insensitively, first-seen order, across sources", () => {
    expect(
      extractEmails("a@b.com\nA@B.COM", "c@d.com; a@b.com")
    ).toEqual(["a@b.com", "c@d.com"]);
  });

  it("trims trailing punctuation", () => {
    expect(extractEmails("write to under@reinsurer.com.")).toEqual([
      "under@reinsurer.com",
    ]);
  });

  it("ignores null/undefined/empty sources and non-email text", () => {
    expect(extractEmails(null, undefined, "", "no addresses here")).toEqual([]);
  });

  it("handles subdomains and plus-addressing", () => {
    expect(extractEmails("claims+soc@team.dwins.co.kr")).toEqual([
      "claims+soc@team.dwins.co.kr",
    ]);
  });
});

describe("addRecipient", () => {
  it("appends to an empty field", () => {
    expect(addRecipient("", "a@b.com")).toBe("a@b.com");
  });

  it("appends with a semicolon separator", () => {
    expect(addRecipient("a@b.com", "c@d.com")).toBe("a@b.com; c@d.com");
  });

  it("does not duplicate an existing address (case-insensitive)", () => {
    expect(addRecipient("a@b.com; c@d.com", "A@B.COM")).toBe("a@b.com; c@d.com");
  });

  it("normalises existing comma separators when re-joining", () => {
    expect(addRecipient("a@b.com, c@d.com", "e@f.com")).toBe(
      "a@b.com; c@d.com; e@f.com"
    );
  });
});

describe("buildEml — Reply-To header", () => {
  it("emits a Reply-To header when provided", () => {
    const eml = buildEml({
      to: "x@y.com",
      replyTo: "claim@dwins.co.kr",
      subject: "Hi",
      bodyText: "body",
    });
    expect(eml).toContain("Reply-To: claim@dwins.co.kr");
  });

  it("omits Reply-To when not provided", () => {
    const eml = buildEml({ to: "x@y.com", subject: "Hi", bodyText: "body" });
    expect(eml).not.toContain("Reply-To:");
  });
});
