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
  // --- State ---
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
  const bottomRef = useRef(null);

  // --- Scroll automatically on new message ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Get URL parameters (Qualtrics integration) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    metaRef.current.rid = p.get("rid") || null;
    metaRef.current.cond = p.get("cond") || null;
  }, []);

  // --- 🧠 Agreement detection ---
  function normalize(text) {
    return text.toLowerCase().replace(/[.,!?'"-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function detectAgreement(text) {
    const t = normalize(text);
    const patterns = [
      /\bwe have a deal\b/,
      /\bcongratulations\b/,
      /\bwelcome aboard\b/,
      /\bwelcome to the team\b/,
      /\bi'?m glad we could reach an agreement\b/,
      /\bi'?m happy to confirm our agreement\b/,
      /\bi'?m pleased to finalize the offer\b/,
      /\boffer confirmed\b/,
      /\bthank you for accepting\b/,
      /\bi'?m looking forward to working together\b/,
      /\bconsider this offer accepted\b/,
      /\bthe agreement is complete\b/,
      /\bwe'?re excited to have you join\b/,
    ];
    return patterns.some((re) => re.test(t));
  }

  function detectNoAgreement(text) {
    const t = normalize(text);
    const patterns = [
      /\bno agreement\b/,
      /\bwe (cannot|can't) reach an agreement\b/,
      /\bwe (cannot|can't) proceed\b/,
      /\bwe (won't|will not) be able to move forward\b/,
      /\bwe have to close this process\b/,
      /\bwe will (withdraw|retract) the offer\b/,
      /\bi understand you (decline|are declining)\b/,
      /\bthank you for your time\b.*\bwe (cannot|can't) continue\b/,
    ];
    return patterns.some((re) => re.test(t));
  }

// --- 🔧 Analysis helpers (normalize + indices) ---
function normalizeAnalysis(a = {}) {
  // Map mogelijke varianten naar vaste namen
  const out = { ...a };
  if (a.Competing && !a.Competition) out.Competition = a.Competing;
  if (a.Collaborating && !a.Collaboration) out.Collaboration = a.Collaborating;

  // Zorg dat alle secties bestaan (lege objecten als fallback)
  out.Competition   = out.Competition   || {};
  out.Collaboration = out.Collaboration || {};
  out.Compromise    = out.Compromise    || {};
  out.Accommodation = out.Accommodation || {};
  out.Avoidance     = out.Avoidance     || {};

  // Compute indices (gemiddelde van items) voor de grafiek
  function idx(section) {
    const vals = Object.values(section || {})
      .map((x) => Number(x))
      .filter((n) => !Number.isNaN(n));
    if (!vals.length) return 0;
    return +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
  }
  out._indices = {
    Competition:   idx(out.Competition),
    Collaboration: idx(out.Collaboration),
    Compromise:    idx(out.Compromise),
    Accommodation: idx(out.Accommodation),
    Avoidance:     idx(out.Avoidance),
  };

  // Notes/salary/agreement als fallback
  out.notes = typeof out.notes === "string" ? out.notes : "";
  out.salary = out.salary ?? 0;
  out.agreement = out.agreement ?? "no";
  return out;
}
  
  // --- 📊 Run analysis (AI evaluation) ---
async function runAnalysis(messagesOverride) {
  const arr = messagesOverride || messages;
  const transcript = arr.map((m) => `${m.role}: ${m.content}`).join("\n");
  setLoading(true);
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: transcript }),
    });
    const data = await res.json();
    const normalized = normalizeAnalysis(data);
    setAnalysis(normalized);
    return normalized; // gebruik deze in sendToQualtrics
  } catch {
    setAnalysis({ error: "Analysis failed." });
    return null;
  } finally {
    setLoading(false);
  }
}


  // --- 🧭 Send results to Qualtrics ---
  function sendToQualtrics(analysisData, agreementFlag) {
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage(
        {
          type: "nextQuestion",
          embeddedData: {
            rid: metaRef.current.rid || "TEST",
            agreement: agreementFlag,
            salary: analysisData?.salary || "0",
            ...analysisData.Competition,
            ...analysisData.Collaboration,
            ...analysisData.Compromise,
            ...analysisData.Accommodation,
            ...analysisData.Avoidance,
          },
        },
        "*"
      );
    }
  }

  // --- 💬 Send message handler ---
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
      const updated = [...newMessages, { role: "assistant", content: hrText }];
      setMessages(updated);

      if (data?.state && typeof data.state === "object") {
        negStateRef.current = data.state;
      }

      // ✅ Auto-closure: agreement
      if (detectAgreement(hrText)) {
        setInputDisabled(true);
        const done = [
          ...updated,
          { role: "system", content: "✅ Agreement reached. Negotiation concluded. Please move on to the next question." },
        ];
        setMessages(done);
        const analysisData = await runAnalysis(done);
        sendToQualtrics(analysisData, "yes");
        return;
      }

      // ❌ Auto-closure: no agreement
      if (detectNoAgreement(hrText)) {
        setInputDisabled(true);
        const done = [
          ...updated,
          { role: "system", content: "❌ No agreement. Negotiation concluded." },
        ];
        setMessages(done);
        const analysisData = await runAnalysis(done);
        sendToQualtrics(analysisData, "no");
        return;
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // --- 🖐️ Manual finish ---
  async function finishManually() {
    setInputDisabled(true);
    const done = [
      ...messages,
      { role: "system", content: "✅ You have manually finished the conversation. Please move on to the next question." },
    ];
    setMessages(done);
    const analysisData = await runAnalysis(done);
    const agreementFlag = analysisData?.agreement || "manual";
    sendToQualtrics(analysisData, agreementFlag);
  }

 // --- 📈 Chart data ---
const getIndexData = (analysis) => {
  if (!analysis || !analysis._indices) return [];
  return [
    { name: "Competition",   score: analysis._indices.Competition   || 0 },
    { name: "Collaboration", score: analysis._indices.Collaboration || 0 },
    { name: "Compromise",    score: analysis._indices.Compromise    || 0 },
    { name: "Accommodation", score: analysis._indices.Accommodation || 0 },
    { name: "Avoidance",     score: analysis._indices.Avoidance     || 0 },
  ];
};

  // --- 🧩 Render ---
  return (
    <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden">
      {/* 💬 Chat area */}
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

      {/* ✏️ Input bar + Finish */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-200 p-3 bg-gray-50 flex-wrap"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputDisabled ? "Negotiation concluded." : "Type your message..."}
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
          onClick={finishManually}
          disabled={loading || inputDisabled}
          className="px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Finish conversation
        </button>
      </form>

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

    {/* Uitklapbare lijst met items per dimensie */}
    <details className="mt-4">
      <summary className="cursor-pointer text-gray-700 font-medium">
        Show item scores (per dimension)
      </summary>

      {[
        ["Competition", analysis.Competition],
        ["Collaboration", analysis.Collaboration],
        ["Compromise", analysis.Compromise],
        ["Accommodation", analysis.Accommodation],
        ["Avoidance", analysis.Avoidance],
      ].map(([label, section]) => (
        <div key={label} className="mt-3">
          <div className="font-semibold text-gray-800">{label}</div>
          {section && Object.keys(section).length > 0 ? (
            <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(section).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-gray-600">{k}</span>
                  <span className="font-medium">{Number(v) || 0}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-400 text-sm">No items scored.</div>
          )}
        </div>
      ))}

      {/* Desgewenst ook de ruwe JSON */}
      <div className="mt-4">
        <details>
          <summary className="cursor-pointer text-gray-500 text-xs">
            Show raw JSON
          </summary>
          <pre className="mt-2 text-xs bg-white border border-gray-200 p-2 rounded overflow-x-auto">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  </div>
)}
);
}


