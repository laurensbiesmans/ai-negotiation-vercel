"use client";
import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Page() {
  // Visible chat transcript
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Thank you for joining me in this conversation to discuss your contract as we would like to offer you this job. Based on your relevant experience and match with this role, we would like to offer you a salary of €2500 net per month with standard benefits, such as 20 days paid leave, hospitalisation, and meal vouchers. How would you like to respond?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [inputDisabled, setInputDisabled] = useState(false);

  const negStateRef = useRef({});
  const metaRef = useRef({ rid: null, cond: null });

  // Scroll to bottom on new message
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Read URL params (Qualtrics)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    metaRef.current.rid = p.get("rid") || null;
    metaRef.current.cond = p.get("cond") || null;
  }, []);

  // --- 🧠 IMPROVED AUTO-DETECTION FUNCTION FOR AGREEMENT ---
  function detectAgreement(text) {
    const dealKeywords = [
      "we have a deal",
      "deal",
      "agreement",
      "offer accepted",
      "accept the offer",
      "i accept",
      "accepted",
      "welcome aboard",
      "congratulations",
      "agreed on",
      "i'm happy to confirm",
      "sounds fair",
      "that works for me",
      "this looks good",
      "offer sounds good",
      "i'm satisfied",
      "i'll take it",
      "i accept your offer",
      "sounds good to me",
      "happy to join",
      "looking forward to joining",
    ];
    const lower = text.toLowerCase();
    return dealKeywords.some((k) => lower.includes(k));
  }

  // --- 💬 SEND MESSAGE FUNCTION ---
  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!input.trim() || inputDisabled) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
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
      const hrText = data?.message || data?.reply || data?.error || "No response.";

      // Add HR message
      setMessages((prev) => [...prev, { role: "assistant", content: hrText }]);
      if (data?.state && typeof data.state === "object") {
        negStateRef.current = data.state;
      }

      // 🧠 Detect agreement and stop further replies
      if (detectAgreement(hrText)) {
        setInputDisabled(true);
        setMessages((prev) => [
          ...prev,
          { role: "system", content: "✅ Agreement reached. Negotiation concluded." },
        ]);

        // Auto-run analysis after agreement
        await runAnalysis();

        // Optional redirect to Qualtrics after 4s
       // setTimeout(() => {
        //  window.location.href = "https://YOUR-QUALTRICS-LINK.com"; // ← replace this
     //   }, 4000);

        return;
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    }

    setLoading(false);
  }

  // --- 📊 RUN ANALYSIS FUNCTION ---
  async function runAnalysis() {
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

  // --- 📈 VISUALIZATION HELPER ---
  const getIndexData = (analysis) => {
    if (!analysis) return [];
    return [
      { name: "Competition", score: analysis.Competition?.comp_index || 0 },
      { name: "Collaboration", score: analysis.Collaboration?.collab_index || 0 },
      { name: "Compromise", score: analysis.Compromise?.compr_index || 0 },
      { name: "Accommodation", score: analysis.Accommodation?.accom_index || 0 },
      { name: "Avoidance", score: analysis.Avoidance?.avoid_index || 0 },
    ];
  };

  return (
    <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden">
      {/* Chat Area */}
      <div className="flex flex-col p-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-2 shadow max-w-[80%] text-sm ${
              m.role === "assistant"
                ? "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                : m.role === "system"
                ? "bg-green-100 text-green-800 self-center text-center"
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

      {/* Input Bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-200 p-3 bg-gray-50"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            inputDisabled ? "Negotiation concluded." : "Type your message..."
          }
          disabled={loading || inputDisabled}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={loading || inputDisabled}
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

      {/* 📊 Visualization and Analysis Output */}
      {analysis && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm">
          <h2 className="text-base font-semibold mb-2">Negotiation Style Profile</h2>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getIndexData(analysis)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[1, 7]} />
                <Tooltip />
                <Bar dataKey="score" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-gray-600 italic">
            {analysis.notes || "No qualitative summary available."}
          </p>

          <details className="mt-3">
            <summary className="cursor-pointer text-gray-500 text-xs">
              Show raw data
            </summary>
            <pre className="mt-2 text-xs bg-white border border-gray-200 p-2 rounded">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
