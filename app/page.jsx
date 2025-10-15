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
  const [chatClosed, setChatClosed] = useState(false);

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

  // --- 🧠 ROBUST AGREEMENT DETECTION ---
  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function detectAgreement(text) {
    const t = normalize(text);

    const keywords = [
      "we have a deal",
      "welcome to the team",
      "deal",
      "agreement",
      "offer accepted",
      "accept the offer",
      "i accept",
      "accepted",
      "welcome aboard",
      "congratulations",
      "agreed on",
      "i m happy to confirm",
      "sounds fair",
      "that works for me",
      "this looks good",
      "offer sounds good",
      "i m satisfied",
      "i ll take it",
      "i accept your offer",
      "sounds good to me",
      "happy to join",
      "looking forward to joining",
    ];
    const hasKeyword = keywords.some((k) => t.includes(k));
    if (hasKeyword) return true;

    const patterns = [
      /\bi accept( the)? offer\b/,
      /\boffer (is )?accepted\b/,
      /\bwe (have )?an? (agreement|deal)\b/,
      /\b(let ?us|let's) (proceed|sign|finalize)\b/,
      /\bthis (is|looks|sounds) (good|acceptable|fine)\b/,
      /\bready to (start|join)\b/,
      /\bconsider it accepted\b/,
    ];
    return patterns.some((rx) => rx.test(t));
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
      const afterAssistant = [...newMessages, { role: "assistant", content: hrText }];
      setMessages(afterAssistant);

      // Keep internal state
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

  // --- 📊 RUN ANALYSIS FUNCTION ---
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
    } catch {
      setAnalysis({ error: "Analysis failed." });
    }
    setLoading(false);
  }

  // --
