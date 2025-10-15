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

  // --- 🧠 Agreement detection (AI-only phrasing) ---
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

      // 🧠 Detect AI agreement
      if (detectAgreement(hrText)) {
        setInputDisabled(true);
        const doneMessages = [
          ...updated,
          { role: "system", content: "✅ Agreement reached. Negotiation concluded." },
        ];
        setMessages(doneMessages);

        const analysisData = await runAnalysis(doneMessages);
        const baseQualtrics = "https://feb.qualtrics.com/jfe/form/SV_3k1cnUM6cqEVGL4";

        // Prepare all data for redirect
        const params = new URLSearchParams({
          rid: metaRef.current.rid || "TEST",
          agreement: "yes",
          salary: analysisData?.salary || "0",
          // Competition
          persuade_with_threats: analysisData?.Competition?.persuade_with_threats || "0",
          present_qualifications: analysisData?.Competition?.present_qualifications || "0",
          communicate_value: analysisData?.Competition?.communicate_value || "0",
          persistent_no: analysisData?.Competition?.persistent_no || "0",
          express_unreasonableness: analysisData?.Competition?.express_unreasonableness || "0",
          present_market_value: analysisData?.Competition?.present_market_value || "0",
          comp_index: analysisData?.Competition?.comp_index || "0",
          // Collaboration
          mutual_acceptability: analysisData?.Collaboration?.mutual_acceptability || "0",
          integrate_interests: analysisData?.Collaboration?.integrate_interests || "0",
          joint_offer: analysisData?.Collaboration?.joint_offer || "0",
          accurate_information: analysisData?.Collaboration?.accurate_information || "0",
          open_concerns: analysisData?.Collaboration?.open_concerns || "0",
          collaborate_offer: analysisData?.Collaboration?.collaborate_offer || "0",
          understand_position: analysisData?.Collaboration?.understand_position || "0",
          collab_index: analysisData?.Collaboration?.collab_index || "0",
          // Compromise
          find_middle_ground: analysisData?.Compromise?.find_middle_ground || "0",
          propose_middle_ground: analysisData?.Compromise?.propose_middle_ground || "0",
          give_and_take: analysisData?.Compromise?.give_and_take || "0",
          compr_index: analysisData?.Compromise?.compr_index || "0",
          // Accommodation
          give_in_to_demands: analysisData?.Accommodation?.give_in_to_demands || "0",
          allow_concessions: analysisData?.Accommodation?.allow_concessions || "0",
          accommodate_wishes: analysisData?.Accommodation?.accommodate_wishes || "0",
          go_along_offer: analysisData?.Accommodation?.go_along_offer || "0",
          accom_index: analysisData?.Accommodation?.accom_index || "0",
          // Avoidance
          avoid_negotiating: analysisData?.Avoidance?.avoid_negotiating || "0",
          avoid_index: analysisData?.Avoidance?.avoid_index || "0",
        });

        // ✅ Uncomment next line when you want Qualtrics redirect to activate
       window.top.location.href = `${baseQualtrics}?${params.toString()}`;


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
      setAnalysis(data);
      return data; // ✅ Return for redirect use
    } catch {
      setAnalysis({ error: "Analysis failed." });
      return null;
    } finally {
      setLoading(false);
    }
  }

  // --- 📈 Chart data ---
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

      {/* ✏️ Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-200 p-3 bg-gray-50"
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
          onClick={() => runAnalysis()}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          Analyze
        </button>
      </form>

      {/* 📊 AI Analysis */}
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
