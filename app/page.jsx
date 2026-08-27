"use client";
import { useEffect, useRef, useState } from "react";

// --- Currency + anchor helpers ---
const CUR_SYMBOL = { GBP: "£", USD: "$" };
const OPENING_DISCOUNT = 0.90;
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
  const [inputDisabled, setInputDisabled] = useState(false);

  const negStateRef = useRef({});
  const metaRef = useRef({ rid: null, cond: null, anchor: 2500, currency: "GBP" });
  const openingRef = useRef(null);
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
    const opening = round10(anchor * OPENING_DISCOUNT);
    openingRef.current = opening;
    setMessages([{ role: "assistant", content: buildOpening(opening, currency) }]);
  }, []);

  // --- 💰 Final offer on the table ---
  function currentSalary() {
    const s = Number(negStateRef.current?.current_offer_net);
    return isNaN(s) ? openingRef.current : s;
  }

  // --- 🧭 Send results to Qualtrics ---
  function sendToQualtrics(agreementFlag) {
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage(
        {
          type: "nextQuestion",
          embeddedData: {
            rid: metaRef.current.rid || "TEST",
            agreement: agreementFlag,
            salary: currentSalary() ?? "0",
          },
        },
        "*"
      );
    }
  }

  // --- 💾 Save full conversation to database ---
  async function saveConversation(convo, agreementFlag) {
    try {
      const nUser = convo.filter((m) => m.role === "user").length;
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rid: metaRef.current.rid || "TEST",
          cond: metaRef.current.cond || null,
          salary: currentSalary() ?? null,
          agreement: agreementFlag,
          transcript: convo,
          analysis: null,
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // --- 🖐️ Manual finish (accept or decline) ---
  async function finishManually(agreed) {
    setInputDisabled(true);
    setLoading(true);
    const flag = agreed ? "yes" : "no";
    const closingText = agreed
      ? "✅ You accepted the offer and closed the negotiation. Please wait until you are automatically sent to the next question. This can take a couple of seconds."
      : "❌ You declined the offer and closed the negotiation. Please wait until you are automatically sent to the next question. This can take a couple of seconds.";
    const done = [
      ...messages,
      { role: "system", content: closingText },
    ];
    setMessages(done);
    await saveConversation(done, flag);
    setLoading(false);
    sendToQualtrics(flag);
  }

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
          onClick={() => finishManually(true)}
          disabled={loading || inputDisabled}
          className="px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Accept offer and close negotiation
        </button>

        <button
          type="button"
          onClick={() => finishManually(false)}
          disabled={loading || inputDisabled}
          className="px-4 py-2 bg-rose-600 text-white rounded-full text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
        >
          Decline offer and close negotiation
        </button>
      </form>
    </div>
  );
}
