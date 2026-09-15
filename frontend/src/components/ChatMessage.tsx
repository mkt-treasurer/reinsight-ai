interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sqlQuery?: string | null;
  data?: Record<string, unknown>[] | null;
}

export default function ChatMessage({ role, content, sqlQuery, data }: ChatMessageProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
        role === "user"
          ? "bg-blue-600 text-white"
          : "bg-white border border-gray-200"
      }`}>
        <div className="whitespace-pre-wrap text-[13px] font-medium">{content}</div>
        {sqlQuery && (
          <details className="mt-2">
            <summary className="text-[11px] text-gray-400 cursor-pointer font-semibold">SQL Query</summary>
            <pre className="mt-1.5 p-2 bg-gray-900 text-green-400 rounded text-[11px] overflow-x-auto">{sqlQuery}</pre>
          </details>
        )}
        {data && data.length > 0 && (
          <details className="mt-2">
            <summary className="text-[11px] text-gray-400 cursor-pointer font-semibold">
              Data ({data.length} rows)
            </summary>
            <div className="mt-1.5 overflow-x-auto">
              <table className="text-[11px] border-collapse">
                <thead>
                  <tr>{Object.keys(data[0]).map((key) => (
                    <th key={key} className="border border-gray-200 px-2 py-1 bg-gray-50 font-bold text-black">{key}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.slice(0, 20).map((row, idx) => (
                    <tr key={idx}>{Object.values(row).map((val, cidx) => (
                      <td key={cidx} className="border border-gray-200 px-2 py-1 font-medium">{String(val ?? "-")}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
