export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

// --- SCIENTIFIC ANALYSIS PROMPT (Marks & Harold, 2011) ---
const ANALYZE_PROMPT = `
You are a behavioral researcher analyzing a salary negotiation transcript.

Use the conversation to rate the candidate on the following five conflict-handling styles (Marks & Harold, 2011).
For each item, assign a score from 1 (strongly disagree) to 7 (strongly agree)
based solely on observable negotiation behavior (what the candidate says/does).

Return STRICT JSON in this format:
{
  "Competition": {...},
  "Collaboration": {...},
  "Compromise": {...},
  "Accommodation": {...},
  "Avoidance": {...},
  "agreement": "yes" or "no",
  "salary": number,
  "notes": "concise qualitative summary (1–2 sentences)"
}

Rules:
- Base ratings only on the candidate’s language, tone, persistence, concessions, and self-advocacy.
- If insufficient data, use midpoint (4).
- Calculate each *_index as the mean of its items.
- Output valid JSON only.
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

    // --- Detect automatic agreement from transcript ---
    const transcriptLower = (conversation || "").toLowerCase();
    const agreementKeywords = [
      "we have a deal",
      "offer accepted",
      "i accept",
      "welcome aboard",
      "congratulations",
      "i'm happy to confirm",
      "agreement complete",
      "i'm looking forward to working together",
      "consider this offer accepted",
    ];
    const hasAgreement = agreementKeywords.some((k) => transcriptLower.includes(k));

    analysis.agreement = hasAgreement ? "yes" : "no";

    // --- Extract safe values for redirect ---
    const salary = analysis.salary || "";
    const c = analysis.Competition || {};
    const l = analysis.Collaboration || {};
    const p = analysis.Compromise || {};
    const a = analysis.Accommodation || {};
    const v = analysis.Avoidance || {};

    // Build URL parameters
    const params = new URLSearchParams({
      rid: rid || "",
      salary,
      agreement: analysis.agreement,
      persuade_with_threats: c.persuade_with_threats || "",
      present_qualifications: c.present_qualifications || "",
      communicate_value: c.communicate_value || "",
      persistent_no: c.persistent_no || "",
      express_unreasonableness: c.express_unreasonableness || "",
      present_market_value: c.present_market_value || "",
      comp_index: c.comp_index || "",
      mutual_acceptability: l.mutual_acceptability || "",
      integrate_interests: l.integrate_interests || "",
      joint_offer: l.joint_offer || "",
      accurate_information: l.accurate_information || "",
      open_concerns: l.open_concerns || "",
      collaborate_offer: l.collaborate_offer || "",
      understand_position: l.understand_position || "",
      collab_index: l.collab_index || "",
      find_middle_ground: p.find_middle_ground || "",
      propose_middle_ground: p.propose_middle_ground || "",
      give_and_take: p.give_and_take || "",
      compr_index: p.compr_index || "",
      give_in_to_demands: a.give_in_to_demands || "",
      allow_concessions: a.allow_concessions || "",
      accommodate_wishes: a.accommodate_wishes || "",
      go_along_offer: a.go_along_offer || "",
      accom_index: a.accom_index || "",
      avoid_negotiating: v.avoid_negotiating || "",
      avoid_index: v.avoid_index || "",
    });

    // --- Build the Qualtrics redirect URL (if ever used standalone) ---
    const qualtricsBase = "https://feb.qualtrics.com/jfe/form/SV_3k1cnUM6cqEVGL4";
    const redirectUrl = `${qualtricsBase}?${params.toString()}`;

    return new Response(
      JSON.stringify({
        status: "ok",
        redirect: redirectUrl,
        analysis,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
