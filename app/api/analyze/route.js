export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

// --- SCIENTIFIC ANALYSIS PROMPT (Marks & Harold, 2011) ---
const ANALYZE_PROMPT = `
You are a behavioral researcher analyzing a salary negotiation transcript.

Use the conversation to rate the candidate on the following five conflict-handling styles (Marks & Harold, 2011).
For each item, assign a score from 1 (strongly disagree) to 7 (strongly agree)
based solely on observable negotiation behavior (what the candidate says/does).

Definitions of the five dimensions (summarized):
- Collaboration: joint problem solving, open exchange of information, mutual benefit.
- Competition: self-assertive, persuasive, sometimes aggressive tactics.
- Compromise: give-and-take, finding a middle ground.
- Accommodation: yielding, prioritizing the other's wishes.
- Avoidance: reluctance to engage in negotiation or decision.

Return STRICT JSON in this format:
{
  "salary": number,
  "agreement": "yes" | "no",
  "Competition": {
    "persuade_with_threats": number,
    "present_qualifications": number,
    "communicate_value": number,
    "persistent_no": number,
    "express_unreasonableness": number,
    "present_market_value": number,
  },
  "Collaboration": {
    "mutual_acceptability": number,
    "integrate_interests": number,
    "joint_offer": number,
    "accurate_information": number,
    "open_concerns": number,
    "collaborate_offer": number,
    "understand_position": number,
  },
  "Compromise": {
    "find_middle_ground": number,
    "propose_middle_ground": number,
    "give_and_take": number,
  },
  "Accommodation": {
    "give_in_to_demands": number,
    "allow_concessions": number,
    "accommodate_wishes": number,
    "go_along_offer": number,
  },
  "Avoidance": {
    "avoid_negotiating": number,
  },
  "notes": "concise qualitative summary (1–2 sentences)"
}

Rules:
- Estimate "salary" from the final negotiated amount if mentioned (numbers with € or similar).
- Set "agreement" = "yes" if the conversation ends with clear mutual acceptance; otherwise "no".
- If data are missing, use midpoint (4).
- Compute each *_index as the mean of its items.
- Return valid JSON only.
`;

export async function POST(req) {
  try {
    const { conversation, rid } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYZE_PROMPT },
        { role: "user", content: conversation || "" },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const analysis = JSON.parse(raw);

    // Extract safely
    const salary = analysis.salary || "";
    const agreement = analysis.agreement || "no";
    const c = analysis.Competition || {};
    const l = analysis.Collaboration || {};
    const p = analysis.Compromise || {};
    const a = analysis.Accommodation || {};
    const v = analysis.Avoidance || {};

    // Build Qualtrics redirect parameters
    const params = new URLSearchParams({
      rid: rid || "",
      salary,
      agreement,
      // Competition
      persuade_with_threats: c.persuade_with_threats || "",
      present_qualifications: c.present_qualifications || "",
      communicate_value: c.communicate_value || "",
      persistent_no: c.persistent_no || "",
      express_unreasonableness: c.express_unreasonableness || "",
      present_market_value: c.present_market_value || "",
      // Collaboration
      mutual_acceptability: l.mutual_acceptability || "",
      integrate_interests: l.integrate_interests || "",
      joint_offer: l.joint_offer || "",
      accurate_information: l.accurate_information || "",
      open_concerns: l.open_concerns || "",
      collaborate_offer: l.collaborate_offer || "",
      understand_position: l.understand_position || "",
      // Compromise
      find_middle_ground: p.find_middle_ground || "",
      propose_middle_ground: p.propose_middle_ground || "",
      give_and_take: p.give_and_take || "",
      // Accommodation
      give_in_to_demands: a.give_in_to_demands || "",
      allow_concessions: a.allow_concessions || "",
      accommodate_wishes: a.accommodate_wishes || "",
      go_along_offer: a.go_along_offer || "",
      // Avoidance
      avoid_negotiating: v.avoid_negotiating || "",
    });

    // Redirect to Qualtrics continuation (change QID if needed)
    const qualtricsBase =
      "https://feb.qualtrics.com/jfe/form/SV_3k1cnUM6cqEVGL4?Q_JUMP_TO=QID12"; // 👈 replace QID12 with the next question
    const redirectUrl = `${qualtricsBase}&${params.toString()}`;

    return new Response(
      JSON.stringify({
        status: "ok",
        redirect: redirectUrl,
        analysis,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Analyze route error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
