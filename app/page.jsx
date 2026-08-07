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

// --- Currency + anchor helpers ---
const CUR_SYMBOL = { GBP: "£", USD: "$" };
const round25 = (x) => Math.round(Number(x) / 25) * 25;
const round10 = (x) => Math.round(Number(x) / 10) * 10;

function buildOpening(anchor, cur) {
  const s = CUR_SYMBOL[cur] || "£";
  return `Thank you for joining me to discuss your contract, as we would like to offer you this position. Based on your experience and fit for the role, we would like to offer you ${s}${anchor} net per month, together with a standard benefits package and paid leave. How would you like to respond?`;
}

export default function Page() {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [inputDisabled, setInputDisabled] = useState(false);

  const negStateRef = useRef({});
  const metaRef = useRef({ rid: null, cond: null, anchor: 2500, currency: "GBP" });
  const bottomRef = useRef(null);
  const startedAtRef = useRef(null);

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
    const rawAnchor = parseFloat(p.get("anchor"));
    const anchor = round10(isNaN(rawAnchor) ? 2500 : rawAnchor);
    const currency = p.get("cur") || "GBP";
    metaRef.current.anchor = anchor;
    metaRef.current.currency = currency;
    setMessages([{ role: "assistant", content: buildOpening(anchor, currency) }]);
  }, []);

  // --- 🧠 Agreement detection ---
  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[.,!?'"-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
      /\bwe have an agreement\b/,
      /\bi'?m pleased to finalize the offer\b/,
      /\boffer confirmed\b/,
      /\bthank you for accepting\b/,
      /\bi'?m looking forward to working together\b/,
      /\bconsider this offer accepted\b/,
      /\bthe agreement is complete\b/,
      /\bwe'?re excited to have you join\b/,
      /\bthank you for (your )?acceptance\b/,
      /\bwe'?re pleased to confirm your salary\b/,
      /\blook forward to having you (on board|join|in the team)\b/,
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

  // --- 📊 Run analysis ---
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
      const result = data.analysis || data;
      console.log("🔍 Cleaned analysis result:", result);
      setAnalysis(result);
      return result;
    } catch (err) {
      console.error("❌ Analysis failed:", err);
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
            ...analysisData.Competing,
            ...analysisData.Collaborating,
            ...analysisData.Compromising,
            ...analysisData.Accommodating,
          },
        },
        "*"
      );
    }
  }

  // --- 💾 Save full conversation to database ---
  async function saveConversation(convo, analysisData, agreementFlag) {
    try {
      const nUser = convo.filter((m) => m.role === "user").length;
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rid: metaRef.current.rid || "TEST",
          cond: metaRef.current.cond || null,
          salary: analysisData?.salary ?? null,
          agreement: agreementFlag,
          transcript: convo,
          analysis: analysisData || null,
          n_user_messages: nUser,
          started_at: startedAtRef.current,
          finished_at: new Date().toISOString(),
          currency: metaRef.current.currency,
          anchor: metaRef.current.anchor,
        }),
      });
    } catch (err) {
      console.error("❌ saveConversation failed:", err);
    }
  }

  // --- 💬 Send message handler ---
  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!input.trim() || inputDisabled) return;
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();

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
          anchor: metaRef.current.anchor,
          currency: metaRef.current.currency,
        }),
      });

      const data = await res.json();
      const hrText =
        data?.message || data?.reply || data?.error || "No response.";
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
          {
            role: "system",
            content:
              "✅ Agreement reached. Negotiation concluded. Please move on to the next question.",
          },
        ];
        setMessages(done);
        const analysisData = await runAnalysis(done);
        await saveConversation(done, analysisData, "yes");
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
        await saveConversation(done, analysisData, "no");
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
      {
        role: "system",
        content:
          "✅ You have manually finished the conversation. Please move on to the next question.",
      },
    ];
    setMessages(done);
    const analysisData = await runAnalysis(done);
    const agreementFlag = analysisData?.agreement || "manual";
    await saveConversation(done, analysisData, agreementFlag);
    sendToQualtrics(analysisData, agreementFlag);
  }

  // --- 📈 Chart data ---
  const getIndexData = (analysis) => {
    if (!analysis) return [];

    const avg = (obj = {}) => {
      const vals = Object.values(obj).map((v) => parseFloat(v) || 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    return [
      { name: "Competing", score: avg(analysis.Competing) },
      { name: "Collaborating", score: avg(analysis.Collaborating) },
      { name: "Compromising", score: avg(analysis.Compromising) },
      { name: "Accommodating", score: avg(analysis.Accommodating) },
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
          <div className="text-center text-gray-400 text-sm italic">
            Thinking...
          </div>
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
          onClick={finishManually}
          disabled={loading || inputDisabled}
          className="px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Finish conversation
        </button>
      </form>

      {/* 📊 AI Analysis */}
      {analysis && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm">
          <h2 className="text-base font-semibold mb-2">
            Negotiation Style Profile
          </h2>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getIndexData(analysis)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[1, 7]} />
                <Tooltip />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* --- Summary info (salary & agreement) --- */}
          <div className="mt-3 text-gray-700 text-sm">
            {analysis.salary ? (
              <p>
                <strong>Final salary:</strong>{" "}
                {(CUR_SYMBOL[metaRef.current.currency] || "£")}
                {analysis.salary.toLocaleString("en-US")}
              </p>
            ) : (
              <p>
                <strong>Final salary:</strong> Not specified
              </p>
            )}

            <p>
              <strong>Agreement reached:</strong>{" "}
              {analysis.agreement === "yes"
                ? "✅ Yes"
                : analysis.agreement === "no"
                ? "❌ No"
                : "Manual / Unclear"}
            </p>
          </div>

          {/* --- Qualitative summary --- */}
          <p className="mt-3 text-gray-600 italic">
            {analysis.notes || "No qualitative summary available."}
          </p>

          {/* ▼ Detailed item scores */}
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-gray-700">
              Show item scores (per dimension)
            </summary>

            <div className="mt-2 space-y-4 text-sm text-gray-700">
              {[
                "Competing",
                "Collaborating",
                "Compromising",
                "Accommodating",
              ].map((dim) => (
                <div key={dim}>
                  <h3 className="font-semibold text-gray-800">{dim}</h3>
                  {analysis[dim] ? (
                    <ul className="ml-4 list-disc">
                      {Object.entries(analysis[dim])
                        .filter(([k]) => !k.endsWith("_index"))
                        .map(([key, value]) => (
                          <li key={key}>
                            <span className="font-mono text-gray-600">{key}</span>:{" "}
                            <span className="text-gray-900">
                              {typeof value === "number" ? value.toFixed(2) : value}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No items scored.</p>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
