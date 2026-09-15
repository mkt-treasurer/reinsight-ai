"use client";

import { useEffect, useState } from "react";
import { buildEml, downloadEml, type EmlAttachment } from "@/lib/eml";
import { addRecipient } from "@/lib/emailRecipients";
import type { SlipEmailLang } from "@/lib/slipEmail";

interface EmailComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Recipient(s) — language-independent, so they survive a KO/EN switch. */
  to?: string;
  cc?: string;
  /** Recommended Reply-To address (broker handler mailbox). Editable. */
  replyTo?: string;
  /** Email addresses mined from the source materials, offered as one-click
   *  To / Cc suggestions. Already deduped by the caller. */
  suggestions?: string[];
  /** Produce the subject + body for a given language. Called on open and on
   *  every language toggle. */
  buildDraft: (lang: SlipEmailLang) => { subject: string; body: string };
  defaultLang?: SlipEmailLang;
  /** Attachment filename shown to the recipient, e.g. "RQ_The Founders.pdf". */
  attachmentFilename: string;
  attachmentMime?: string;
  /** Render the attachment bytes (e.g. the slip PDF). Return null to abort. */
  buildAttachment: () => Promise<Uint8Array | ArrayBuffer | null>;
  /** Download name for the .eml; defaults to the attachment name. */
  emlFilename?: string;
  /** Fired after a .eml is successfully generated (e.g. to mark a case sent). */
  onGenerated?: () => void;
}

type Status = "idle" | "working" | "done";

const FIELD =
  "w-full border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-slate-900";
const LABEL =
  "block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1";

const LANGS: { id: SlipEmailLang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
];

export default function EmailComposeModal({
  open,
  onClose,
  to: toDefault,
  cc: ccDefault,
  replyTo: replyToDefault,
  suggestions = [],
  buildDraft,
  defaultLang = "en",
  attachmentFilename,
  attachmentMime = "application/pdf",
  buildAttachment,
  emlFilename,
  onGenerated,
}: EmailComposeModalProps) {
  const [lang, setLang] = useState<SlipEmailLang>(defaultLang);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the parent each time the modal opens — fresh defaults per
  // slip/SOC must not be shadowed by a stale draft from a previous open.
  useEffect(() => {
    if (!open) return;
    const draft = buildDraft(defaultLang);
    setLang(defaultLang);
    setTo(toDefault ?? "");
    setCc(ccDefault ?? "");
    setReplyTo(replyToDefault ?? "");
    setSubject(draft.subject);
    setBody(draft.body);
    setStatus("idle");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Switching language regenerates subject + body from the template (any manual
  // body edits are intentionally replaced — the toggle means "give me the other
  // language"). Recipients are language-independent and left untouched.
  const switchLang = (next: SlipEmailLang) => {
    if (next === lang) return;
    const draft = buildDraft(next);
    setLang(next);
    setSubject(draft.subject);
    setBody(draft.body);
    setStatus("idle");
    setError(null);
  };

  const generate = async () => {
    setStatus("working");
    setError(null);
    try {
      const raw = await buildAttachment();
      if (!raw) {
        setError("첨부할 PDF를 생성하지 못했습니다. 슬립 미리보기를 연 뒤 다시 시도해 주세요.");
        setStatus("idle");
        return;
      }
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      const attachment: EmlAttachment = {
        filename: attachmentFilename,
        mimeType: attachmentMime,
        bytes,
      };
      const eml = buildEml({ to, cc, replyTo, subject, bodyText: body, attachments: [attachment] });
      const name = emlFilename ?? attachmentFilename.replace(/\.pdf$/i, "");
      downloadEml(name, eml);
      setStatus("done");
      onGenerated?.();
    } catch (e) {
      setError(
        `.eml 생성 실패: ${e instanceof Error ? e.message : String(e)} — 새로고침 후 다시 시도해 주세요.`
      );
      setStatus("idle");
    }
  };

  const working = status === "working";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={working ? undefined : onClose} />
      <div className="relative bg-white border border-slate-300 shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase">Email 초안</span>
            <span className="text-[10px] text-slate-400 tracking-wider hidden sm:inline">
              Outlook · .eml draft
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Language toggle — regenerates the template on switch */}
            <div className="flex border border-slate-600">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => switchLang(l.id)}
                  disabled={working}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors disabled:opacity-40 ${
                    lang === l.id
                      ? "bg-white text-slate-900"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              disabled={working}
              className="text-slate-400 hover:text-white text-lg font-bold leading-none disabled:opacity-40"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className={LABEL}>To</label>
            <input
              className={FIELD}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@reinsurer.com"
            />
            {suggestions.length > 0 && (
              <SuggestionChips
                label="추천 수신처 (자료 추출)"
                emails={suggestions}
                onPick={(email) => setTo((cur) => addRecipient(cur, email))}
                disabled={working}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Cc</label>
              <input
                className={FIELD}
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="optional"
              />
              {suggestions.length > 0 && (
                <SuggestionChips
                  label="Cc 추가"
                  emails={suggestions}
                  onPick={(email) => setCc((cur) => addRecipient(cur, email))}
                  disabled={working}
                />
              )}
            </div>
            <div>
              <label className={LABEL}>Reply-To · 회신</label>
              <input
                className={FIELD}
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="reply@dwins.co.kr"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Subject</label>
            <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <label className={LABEL}>Body</label>
            <textarea
              className={`${FIELD} font-mono leading-relaxed`}
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-slate-400">📎</span>
            <span className="font-mono text-slate-700 break-all">{attachmentFilename}</span>
            <span className="text-slate-400">— 슬립 PDF가 자동 첨부됩니다</span>
          </div>

          {error && (
            <p className="text-[11px] text-red-700 border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}
          {status === "done" && !error && (
            <p className="text-[11px] text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-2">
              .eml을 내려받았습니다. 파일을 더블클릭하면 Outlook이 편집 가능한 새 메일(초안)로 열립니다.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={working}
            className="px-3 py-1.5 border border-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 hover:bg-white disabled:opacity-40"
          >
            {status === "done" ? "닫기" : "취소"}
          </button>
          <button
            onClick={generate}
            disabled={working}
            className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-700 disabled:opacity-40"
          >
            {working ? "생성 중…" : status === "done" ? "다시 생성" : ".eml 생성"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestionChips({
  label,
  emails,
  onPick,
  disabled,
}: {
  label: string;
  emails: string[];
  onPick: (email: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-slate-400 tracking-wide">{label}:</span>
      {emails.map((email) => (
        <button
          key={email}
          type="button"
          onClick={() => onPick(email)}
          disabled={disabled}
          title={`추가: ${email}`}
          className="px-2 py-0.5 border border-slate-300 text-[10px] font-mono text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors disabled:opacity-40"
        >
          + {email}
        </button>
      ))}
    </div>
  );
}
