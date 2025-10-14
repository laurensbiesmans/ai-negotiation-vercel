"use client";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  // Visible chat transcript (what the participant sees)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Thank you for your interest. The initial offer is €2500 net per month with standard benefits. How would you like to respond?",
    },
  ]);

  // UI state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  // Internal (not shown) negotiation state from the HR policy agent
  const negStateRef = useRef({});
  // Optional metadata from URL (Qualtrics): rid & cond
  const metaRef = useRef({ rid: null, cond: null });

  // Scroll to bottom whenever messages change
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Read URL params once (rid, cond)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    metaRef.current.rid = p.get("rid") || null;
    metaRef.current.cond = p.get("cond") || null;
  }, []);

  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!input.trim()) return;

    // Push user's message to the visible transcript
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Send both the visible transcript and the internal HR state to the API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          state: negStateRef.current || {},
          rid: metaRef.current.rid,
          cond: metaRef.current.cond,
        }),
      });

      const data = await res.json();
      // data is expected as: { message: "...", state: {...} } from the HR policy agent

      // Show ONLY the HR message to participants
      const hrText = data?.message || data?.reply || data?.error || "No response.";

      setMessages((prev) => [...prev, { role: "assistant", content: hrText }]);

      // Keep the internal state for the next turn
      if (data?.state && typeof data.state === "object") {
        negStateRef.current = data.state;
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    }

    setLoading(false);
  }

  async function runAnalysis() {
    // Build a plain-text transcript for the analyzer
    const transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
      {/* Chat area */}
      <div className="flex flex-col p-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-2 shadow max-w-[80%] text-sm ${
              m.role === "assistant"
                ? "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                : "bg-blue-600 text-white self-end rounded-br-none"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="text-center text-gray-400 text-sm italic">Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-200 p-3 bg-gray-50"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          Analyze
        </button>
      </form>

      {/* Optional analysis output for researchers (not needed for participants) */}
      {analysis && (
        <div className="p-4 bg-green-50 border-t border-green-200 text-sm">
          <b>AI Analysis:</b>
          <pre className="mt-2 whitespace-pre-wrap">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
