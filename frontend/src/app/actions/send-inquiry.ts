"use server";

import { Resend } from "resend";
import { inquirySchema, companyTypeLabel, type InquiryInput } from "@/lib/inquiry-schema";

export type SendInquiryResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type InquiryData = {
  company: string;
  name: string;
  title?: string;
  email: string;
  phone?: string;
  companyType: string;
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailHtml(data: InquiryData): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;background:#0f1729;color:#9ca3af;border:1px solid #1f2937;width:140px;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;background:#111827;color:#e5e7eb;border:1px solid #1f2937;font-size:14px;">${escapeHtml(value || "-")}</td>
    </tr>`;
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard',system-ui,sans-serif;background:#0a0e1a;padding:32px;color:#e5e7eb;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="border:1px solid #1f2937;border-radius:16px;overflow:hidden;background:#0f1729;">
        <div style="padding:24px 28px;border-bottom:1px solid #1f2937;background:linear-gradient(135deg,#0f1729,#0a0e1a);">
          <div style="font-size:12px;letter-spacing:0.2em;color:#d4af37;text-transform:uppercase;">ARIA · 도입 문의</div>
          <div style="font-size:20px;font-weight:600;color:#fff;margin-top:6px;">새로운 문의가 도착했습니다</div>
        </div>
        <div style="padding:24px 28px;">
          <table style="width:100%;border-collapse:collapse;">
            ${row("회사명", data.company)}
            ${row("담당자", data.name)}
            ${row("직책", data.title || "")}
            ${row("이메일", data.email)}
            ${row("연락처", data.phone || "")}
            ${row("회사 유형", companyTypeLabel(data.companyType))}
          </table>
          <div style="margin-top:20px;padding:16px 18px;border:1px solid #1f2937;border-radius:12px;background:#111827;">
            <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;">문의 내용</div>
            <div style="white-space:pre-wrap;color:#e5e7eb;font-size:14px;line-height:1.7;">${escapeHtml(data.message)}</div>
          </div>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #1f2937;font-size:12px;color:#6b7280;">
          이 메일은 ARIA 랜딩 페이지 문의 폼을 통해 자동 발송되었습니다.
        </div>
      </div>
    </div>
  </div>`;
}

function buildSlackPayload(data: InquiryData) {
  const field = (label: string, value: string) => ({
    type: "mrkdwn" as const,
    text: `*${label}*\n${value || "-"}`,
  });

  return {
    text: `[ARIA 문의] ${data.company} · ${data.name}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "ARIA · 새 도입 문의", emoji: true },
      },
      {
        type: "section",
        fields: [
          field("회사명", data.company),
          field("담당자", data.name),
          field("직책", data.title || ""),
          field("이메일", `<mailto:${data.email}|${data.email}>`),
          field("연락처", data.phone || ""),
          field("회사 유형", companyTypeLabel(data.companyType)),
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*문의 내용*\n${data.message.length > 2800 ? data.message.slice(0, 2800) + "…" : data.message}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "ARIA 랜딩 페이지 도입 문의 폼" },
        ],
      },
    ],
  };
}

async function sendEmail(data: InquiryData): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY 미설정" };

  const to = process.env.CONTACT_EMAIL || "henry@treasurer.co.kr";
  const from = process.env.RESEND_FROM || "ARIA <onboarding@resend.dev>";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: data.email,
      subject: `[ARIA 문의] ${data.company} · ${data.name}`,
      html: renderEmailHtml(data),
    });
    if (error) {
      console.error("[sendInquiry] Resend error:", error);
      return { ok: false, reason: `Resend: ${error.message ?? "unknown"}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sendInquiry] Resend unexpected error:", err);
    return { ok: false, reason: "Resend 예외" };
  }
}

async function sendSlack(data: InquiryData): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "SLACK_WEBHOOK_URL 미설정" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackPayload(data)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sendInquiry] Slack ${res.status}:`, body.slice(0, 200));
      return { ok: false, reason: `Slack: HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sendInquiry] Slack unexpected error:", err);
    return { ok: false, reason: "Slack 예외" };
  }
}

export async function sendInquiry(input: InquiryInput): Promise<SendInquiryResult> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "입력값을 확인해 주세요.", fieldErrors };
  }

  const data = parsed.data;
  const [emailResult, slackResult] = await Promise.all([sendEmail(data), sendSlack(data)]);

  if (emailResult.ok || slackResult.ok) return { ok: true };

  console.error("[sendInquiry] all channels failed:", {
    email: emailResult.reason,
    slack: slackResult.reason,
    company: data.company,
    name: data.name,
  });

  return {
    ok: false,
    error:
      "문의 전송 설정이 아직 완료되지 않았습니다. 잠시 후 다시 시도하시거나 henry@treasurer.co.kr 로 직접 문의해 주세요.",
  };
}
