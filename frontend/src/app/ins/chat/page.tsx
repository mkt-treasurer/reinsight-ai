"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface Step {
  event: string;
  step?: number;
  content?: string;
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  summary?: string;
  server?: string;
  code?: string;
}

/** code_execution 이 그린 차트 (Files API 에서 회수해 base64 임베드) */
interface ChartImage {
  name: string;
  mime: string;
  b64: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  steps: Step[];
  loading?: boolean;
  mcp?: boolean; // 이 턴을 + 알파렌즈 모드로 물었는지
  images: ChartImage[];
}

const SUGGESTIONS = [
  "2026년 재보험사별 보험료 합계를 알려줘",
  "미결 클레임 중 금액이 큰 상위 10건은?",
  "Property 종목의 월별 보험료 추이를 보여줘",
  "SOC 금액 불일치 건 중 차이가 큰 상위 5건 보여줘",
  "커버노트 중 미부킹 건수와 목록 알려줘",
  "ACE KR의 2026년 총 보험료와 커미션은?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // 모드: 내부 툴만(false) vs + 알파렌즈(argo MCP 외부 툴, true)
  const [useMcp, setUseMcp] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), steps: [], images: [] };
    const assistantMsg: Message = { role: "assistant", content: "", steps: [], loading: true, mcp: useMcp, images: [] };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), use_mcp: useMcp }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      // 청크 경계를 넘어 유지돼야 한다. 루프 안에 두면 'event: image' 와 그
      // 뒤의 거대한 'data:' 줄(차트 base64 ~130KB)이 다른 청크로 갈릴 때
      // 이벤트 이름이 초기화되어 데이터가 조용히 버려진다.
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              processEvent(currentEvent, data);
            } catch { /* skip parse errors */ }
            currentEvent = "";
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1),
          { ...last, content: "Error occurred. Please try again.", loading: false }];
      });
    } finally {
      setLoading(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, loading: false }];
      });
    }
  };

  const processEvent = (event: string, data: Record<string, unknown>) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;

      // 순수 업데이터로 유지한다. 이전 구현은 last.steps.push() 로 기존 객체를
      // 변형해서, StrictMode 가 업데이터를 두 번 호출할 때 스텝이 중복 추가됐다.
      const step = (extra: Partial<Step>): Message => ({
        ...last,
        steps: [...last.steps, { event, step: data.step as number, ...extra }],
      });

      let next: Message;
      switch (event) {
        case "thinking":
          next = step({ content: data.content as string });
          break;
        case "tool_call":
          next = step({
            tool: data.tool as string,
            params: data.params as Record<string, unknown>,
          });
          break;
        case "tool_result":
          next = step({
            tool: data.tool as string,
            success: data.success as boolean,
            summary: data.summary as string,
          });
          break;
        case "mcp_tool_call":
          next = step({
            tool: data.tool as string,
            server: data.server as string,
            params: data.params as Record<string, unknown>,
          });
          break;
        case "mcp_tool_result":
          next = step({
            success: data.success as boolean,
            summary: data.summary as string,
          });
          break;
        case "code":
          next = step({ tool: "code_execution", code: data.code as string });
          break;
        case "image":
          next = {
            ...last,
            images: [
              ...last.images,
              {
                name: data.name as string,
                mime: data.mime as string,
                b64: data.b64 as string,
              },
            ],
          };
          break;
        case "answer":
          next = { ...last, content: data.content as string };
          break;
        case "done":
          next = { ...last, loading: false };
          break;
        default:
          return prev;
      }
      return [...prev.slice(0, -1), next];
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-black">AI Agent</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">ReAct agent with tools -- iterates until it finds the answer</p>
        </div>

        {/* 모드 토글: 내부 툴만 vs + 알파렌즈(argo MCP) */}
        <div className="flex border border-slate-300 shrink-0">
          <button
            onClick={() => setUseMcp(false)}
            title="내부 DB 툴만 사용"
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              !useMcp ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            내부 툴만
          </button>
          <button
            onClick={() => setUseMcp(true)}
            title="알파렌즈 외부 툴(뉴스·DART·제재·매크로)까지 사용"
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-l border-slate-300 transition-colors ${
              useMcp ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            + 알파렌즈
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[13px] text-gray-400 mb-5 font-medium">Ask anything about the reinsurance data</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-[12px] font-semibold text-black bg-white hover:bg-gray-50 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`max-w-[85%] ${msg.role === "user" ? "bg-blue-600 text-white rounded-lg px-4 py-2.5" : ""}`}>
              {msg.role === "user" && (
                <div className="text-[13px] font-medium">{msg.content}</div>
              )}

              {msg.role === "assistant" && (
                <div>
                  {/* 알파렌즈 모듈 보드 — MCP 턴만, 실제 호출된 툴만 점등 */}
                  {msg.mcp && <McpModuleBoard steps={msg.steps} />}

                  {/* Steps */}
                  {msg.steps.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.steps.map((step, sidx) => (
                        <StepDisplay key={sidx} step={step} />
                      ))}
                    </div>
                  )}

                  {/* Loading indicator */}
                  {msg.loading && !msg.content && msg.steps.length === 0 && (
                    <div className="text-[13px] text-gray-400 font-medium py-2">Starting analysis...</div>
                  )}

                  {/* 차트 — code_execution 산출물 */}
                  {msg.images.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {msg.images.map((img, k) => (
                        <div key={k} className="border border-slate-200 bg-white">
                          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">CHART</span>
                            <span className="text-[10px] text-slate-400">{img.name}</span>
                          </div>
                          {/* base64 인라인이라 next/image 최적화 대상이 아니다 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${img.mime};base64,${img.b64}`}
                            alt={img.name}
                            className="block w-full max-w-2xl"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer */}
                  {msg.content && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <Markdown text={msg.content} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 bg-white p-3 rounded-lg">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Type your question..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-[13px] font-medium focus:outline-none focus:border-blue-500"
            disabled={loading} />
          <button onClick={() => send(input)} disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-30 transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/** 답변 마크다운. 표(GFM)·목록·코드를 DESIGN.md 토큰으로 렌더한다.
 *  react-markdown 단독은 표를 지원하지 않으므로 remark-gfm 이 필수. */
function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-slate-800">
      <ReactMarkdown
        // singleTilde:false — 한국어 범위 표기('2017~2019년')를 취소선으로
        // 해석하지 않게 한다. 취소선은 ~~로만.
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        components={{
          h1: ({ children }) => (
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700 pt-1">{children}</div>
          ),
          h2: ({ children }) => (
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700 pt-1">{children}</div>
          ),
          h3: ({ children }) => (
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 pt-1">{children}</div>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          em: ({ children }) => <span className="font-semibold text-slate-700">{children}</span>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 marker:text-slate-400">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 marker:text-slate-400">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer"
              className="text-[#1e40af] underline underline-offset-2">{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
          ),
          hr: () => <hr className="border-slate-200" />,
          // 모델은 차트를 ![설명](chart.png) 으로 참조하지만 실제 URL 이 아니다
          // (그림은 SSE image 이벤트로 따로 온다). 깨진 img 대신 캡션만 남긴다.
          img: ({ alt, src }) =>
            typeof src === "string" && src.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} className="block w-full max-w-2xl" />
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                ↑ {alt || "chart"}
              </span>
            ),
          code: ({ children }) => (
            <code className="bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-slate-50 border border-slate-200 p-2 overflow-x-auto text-[11px]">{children}</pre>
          ),
          // 넓은 표가 페이지를 밀지 않도록 자체 스크롤 컨테이너에 넣는다
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-slate-200 px-2 py-1 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-100 px-2 py-1 font-mono tabular-nums text-slate-800 align-top">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function StepDisplay({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(false);

  if (step.event === "code") {
    return (
      <div className="text-[12px] border-l-2 border-violet-500 pl-2 py-0.5">
        <div className="flex items-center gap-2">
          <span className="text-violet-700 font-bold shrink-0">PY [{step.step}]</span>
          <span className="font-bold text-black">code_execution</span>
          {step.code && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
              {expanded ? "[-]" : "[+]"}
            </button>
          )}
        </div>
        {expanded && step.code && (
          <pre className="mt-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 p-2 overflow-x-auto">
            {step.code}
          </pre>
        )}
      </div>
    );
  }

  if (step.event === "thinking") {
    return (
      <div className="flex items-start gap-2 text-[12px] border-l-2 border-blue-400 pl-2 py-0.5">
        <span className="text-blue-600 font-bold shrink-0">THINK [{step.step}]</span>
        <span className="text-gray-600">{step.content}</span>
      </div>
    );
  }

  if (step.event === "tool_call") {
    return (
      <div className="text-[12px] border-l-2 border-amber-400 pl-2 py-0.5">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-bold shrink-0">CALL [{step.step}]</span>
          <span className="font-bold text-black">{step.tool}</span>
          {step.params && Object.keys(step.params).length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
              {expanded ? "[-]" : "[+]"}
            </button>
          )}
        </div>
        {expanded && step.params && (
          <pre className="mt-1 text-[11px] text-gray-500 bg-gray-50 rounded p-2 overflow-x-auto">
            {JSON.stringify(step.params, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (step.event === "tool_result") {
    return (
      <div className="flex items-start gap-2 text-[12px] border-l-2 border-emerald-400 pl-2 py-0.5">
        <span className={`font-bold shrink-0 ${step.success ? "text-emerald-600" : "text-red-600"}`}>
          {step.success ? "OK" : "FAIL"} [{step.step}]
        </span>
        <span className="text-gray-600 font-medium">{step.tool}: {step.summary}</span>
      </div>
    );
  }

  // 외부(알파렌즈) 툴은 서버측 실행이라 내부 툴과 시각적으로 구분한다.
  if (step.event === "mcp_tool_call") {
    return (
      <div className="text-[12px] border-l-2 border-slate-900 pl-2 py-0.5">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 font-bold shrink-0">
            {(step.server || "argo").toUpperCase()} [{step.step}]
          </span>
          <span className="font-bold text-black">{step.tool}</span>
          {step.params && Object.keys(step.params).length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
              {expanded ? "[-]" : "[+]"}
            </button>
          )}
        </div>
        {expanded && step.params && (
          <pre className="mt-1 text-[11px] text-gray-500 bg-slate-50 p-2 overflow-x-auto">
            {JSON.stringify(step.params, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (step.event === "mcp_tool_result") {
    return (
      <div className="flex items-start gap-2 text-[12px] border-l-2 border-slate-400 pl-2 py-0.5">
        <span className={`font-bold shrink-0 ${step.success ? "text-slate-600" : "text-red-600"}`}>
          {step.success ? "EXT" : "FAIL"} [{step.step}]
        </span>
        <span className="text-gray-500 font-medium break-all">{step.summary}</span>
      </div>
    );
  }

  return null;
}

/** 이 턴에서 실제로 점등된 알파렌즈 모듈. 호출 안 된 모듈은 흐리게 남겨 커버리지를 보여준다. */
const ALPHA_MODULES: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: "news", label: "NEWS", match: (t) => t.startsWith("news_") },
  { key: "entity", label: "ENTITY", match: (t) => t === "resolve_entity" || t === "company_profile" },
  { key: "dart", label: "DART", match: (t) => t.startsWith("dart_") },
  { key: "sanctions", label: "SANCTIONS", match: (t) => t.startsWith("opensanctions_") },
  { key: "financial", label: "FINANCIAL", match: (t) => t === "financial_query" },
  { key: "macro", label: "MACRO", match: (t) => t === "macro_data" || t.startsWith("fred_") || t === "economic_calendar" },
];

function McpModuleBoard({ steps }: { steps: Step[] }) {
  const called = steps.filter((s) => s.event === "mcp_tool_call" && s.tool).map((s) => s.tool as string);
  if (called.length === 0) return null;

  return (
    <div className="mb-2 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">알파렌즈</span>
      {ALPHA_MODULES.map((m) => {
        const hits = called.filter((t) => m.match(t)).length;
        return (
          <span
            key={m.key}
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${
              hits > 0
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-300"
            }`}
          >
            {m.label}
            {hits > 1 && ` ${hits}`}
          </span>
        );
      })}
    </div>
  );
}
