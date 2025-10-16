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
Collaborating:
This strategy has also been referred to as integrating or problem solving. Relative to the dual concerns
model, this strategy represents a high concern for attaining one’s own outcomes as well as a high
concern for whether the other party attains their desired outcomes. A collaborative strategy is
represented by a desire to exchange meaningful and accurate information in order to reach an
agreement that is best for all parties involved. There is an emphasis on discovery of the basic interests of
those involved in the negotiation, in order to craft a solution that meets both parties’ interests. This
strategy is especially appropriate when there is value to synthesizing ideas to develop better solutions,
when time is available for negotiation, and when both parties have an investment in the outcomes
(Lewicki et al., 2004).

Competing:
Also called contending or dominating, the competing strategy represents a greater concern for one’s
own outcomes and a lower concern for other’s outcomes. Tactics utilized in a competing strategy can
include persuading, threatening, misrepresenting, and asserting.

Compromising:
Compromising involves some level of concern for one’s own outcomes and some level for others’
outcomes. The use of a compromise strategy would include the use of a give-and-take approach with a
desire to reach an acceptable middle ground.

Accommodating:
Also referred to as obliging or yielding, an accommodating strategy to negotiation represents high
concern for others and low concerns about one’s own outcomes. Negotiators pursuing an
accommodating strategy are more interested in having others attain their desired outcomes. While
this strategy has disadvantages when one is trying to reach agreement on issues that are important, this
strategy may be appropriate in situations where one’s focus is on the longer term relationship or one is
negotiating from a position of limited power.

Avoiding:
This approach involves dodging situations that would involve negotiation. While there are situations
where an ‘‘avoid’’ approach would be effective, often in salary negotiations an avoid approach ‘‘leaves
money on the table.’’ The dual concerns model considers the avoiding strategy as one that represents
low concern about one’s own and other’s outcomes.

Return STRICT JSON in this format:
{
  "salary": number,
  "agreement": "yes" | "no",
  "Competing": {
    "persuade_with_threats": number,
    "present_qualifications": number,
    "communicate_value": number,
    "persistent_no": number,
    "express_unreasonableness": number,
    "present_market_value": number
  },
  "Collaborating": {
    "mutual_acceptability": number,
    "integrate_interests": number,
    "joint_offer": number,
    "accurate_information": number,
    "open_concerns": number,
    "collaborate_offer": number,
    "understand_position": number
  },
  "Compromising": {
    "find_middle_ground": number,
    "propose_middle_ground": number,
    "give_and_take": number
  },
  "Accommodating": {
    "give_in_to_demands": number,
    "allow_concessions": number,
    "accommodate_wishes": number,
    "go_along_offer": number
  },
  "Avoiding": {
    "avoid_negotiating": number
  },
  "notes": "concise qualitative summary (1–2 sentences)"
}

Rules:
- Estimate "salary" from the final negotiated amount if mentioned (numbers with € or similar).
- Set "agreement" = "yes" if the conversation ends with clear mutual acceptance; otherwise "no".
- If data are missing, use midpoint (4).
- Compute each *_index as the mean of its items.
- All numeric answers must be plain numbers (1–7), not text or words.
- Return valid JSON only.
`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

const ANALYZE_PROMPT = `
You are a behavioral researcher analyzing a salary negotiation transcript.
Rate the candidate on five conflict-handling styles (Marks & Harold, 2011)
and return STRICT JSON in the specified format (see below).
`;

// 🧠 --- DEBUG-FRIENDLY ANALYZE ENDPOINT ---
export async function POST(req) {
  try {
    const { conversation } = await req.json();
    console.log("🟢 [analyze] Incoming conversation sample:", conversation?.slice(0, 250));

    if (!process.env.OPENAI_API_KEY) {
      console.warn("⚠️ Missing OPENAI_API_KEY — returning dummy data");
      return new Response(JSON.stringify(getDummyAnalysis()), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYZE_PROMPT },
        { role: "user", content: conversation || "" },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    console.log("🟣 [analyze] Raw model output:", raw);

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (err) {
      console.error("❌ JSON parse error from model:", err);
      return new Response(JSON.stringify(getDummyAnalysis("Invalid model JSON")), {
        headers: { "Content-Type": "application/json" },
      });
    }

    function toNumber(value, fallback = 0) {
      const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
      return isNaN(n) ? fallback : n;
    }

    function normalizeSection(section = {}) {
      const result = {};
      for (const [k, v] of Object.entries(section)) result[k] = toNumber(v, 0);
      return result;
    }

    const salary = toNumber(analysis.salary, 0);
    const agreement = analysis.agreement?.toLowerCase?.() === "yes" ? "yes" : "no";

    const cleaned = {
      salary,
      agreement,
      Competing: normalizeSection(analysis.Competing),
      Collaborating: normalizeSection(analysis.Collaborating),
      Compromising: normalizeSection(analysis.Compromising),
      Accommodating: normalizeSection(analysis.Accommodating),
      Avoiding: normalizeSection(analysis.Avoiding),
      notes: analysis.notes || "",
    };

    console.log("✅ [analyze] Returning cleaned analysis:", cleaned);

    return new Response(JSON.stringify(cleaned), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("💥 [analyze] Fatal error:", err);
    return new Response(JSON.stringify(getDummyAnalysis(err.message)), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

function getDummyAnalysis(reason = "Fallback") {
  console.log(`⚙️ [analyze] Returning dummy analysis (${reason})`);
  return {
    salary: 2750,
    agreement: "yes",
    Competing: {
      persuade_with_threats: 2,
      present_qualifications: 6,
      communicate_value: 5,
      persistent_no: 3,
      express_unreasonableness: 2,
      present_market_value: 6,
    },
    Collaborating: {
      mutual_acceptability: 6,
      integrate_interests: 5,
      joint_offer: 5,
      accurate_information: 7,
      open_concerns: 6,
      collaborate_offer: 6,
      understand_position: 6,
    },
    Compromising: {
      find_middle_ground: 5,
      propose_middle_ground: 5,
      give_and_take: 6,
    },
    Accommodating: {
      give_in_to_demands: 3,
      allow_concessions: 4,
      accommodate_wishes: 4,
      go_along_offer: 4,
    },
    Avoiding: {
      avoid_negotiating: 2,
    },
    notes: "Candidate showed strong collaboration with moderate compromise.",
  };
}
