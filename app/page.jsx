
"use client";
import { useState, useRef, useEffect } from "react";

export default function Page() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Thank you for your interest. The initial offer is €2500 net per month with standard benefits. How would you like to respond?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || data.error || "No response." }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  }

  async function runAnalysis() {
    const transcript = messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: transcript }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setAnalysis({ error: "Analysis failed." });
    }
    setLoading(false);
  }

  return (
    <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex flex-col p-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role === "assistant" ? "hr-bubble" : "user-bubble"} ${m.role === "assistant" ? "self-start" : "self-end"}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-center text-gray-400 text-sm italic">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-gray-200 p-3 bg-gray-50">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Send
        </button>
        <button type="button" onClick={runAnalysis} disabled={loading} className="px-4 py-2 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
          Analyze
        </button>
      </form>

      {analysis && (
        <div className="p-4 bg-green-50 border-t border-green-200 text-sm">
          <b>AI Analysis:</b>
          <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
