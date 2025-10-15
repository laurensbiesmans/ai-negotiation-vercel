export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

// --- SCIENTIFIC ANALYSIS PROMPT (Marks & Harold, 2011) ---
const ANALYZE_PROMPT = `
You are a behavioral researcher analyzing a salary negotiation transcript.

Use the conversation to rate the candidate on the following five conflict-handling styles (Marks & Harold, 2011).
For each item, assign a score from 1 (strongly disagree) to 7 (strongly agree)
based solely on observable negotiation behavior (what the candidate says/does).

Definitions of the five dimensions, from Marks & Harold (2011):
[Collaborating]
This strategy has also been referred to as integrating or problem solving. Relative to the dual concerns
model, this strategy represents a high concern for attaining one’s own outcomes as well as a high
concern for whether the other party attains their desired outcomes. A collaborative strategy is
represented by a desire to exchange meaningful and accurate information in order to reach an
agreement that is best for all parties involved. There is an emphasis on discovery of the basic interests of
those involved in the negotiation, in order to craft a solution that meets both parties’ interests. This
strategy is especially appropriate when there is value to synthesizing ideas to develop better solutions,
when time is available for negotiation, and when both parties have an investment in the outcomes
(Lewicki et al., 2004).

[Competing]
Also called contending or dominating, the competing strategy represents a greater concern for one’s
own outcomes and a lower concern for other’s outcomes. Tactics utilized in a competing strategy can
include persuading, threatening, misrepresenting, and asserting.

[Accommodating]
Also referred to as obliging or yielding, an accommodating strategy to negotiation represents high
concern for others and low concerns about one’s own outcomes. Negotiators pursuing an
accommodating strategy are more interested in having others attain their desired outcomes. While
this strategy has disadvantages when one is trying to reach agreement on issues that are important, this
strategy may be appropriate in situations where one’s focus is on the longer term relationship or one is
negotiating from a position of limited power.

[Compromising]
Compromising involves some level of concern for one’s own outcomes and some level for others’
outcomes. The use of a compromise strategy would include the use of a give-and-take approach with a
desire to reach an acceptable middle ground.

[Avoiding]
This approach involves dodging situations that would involve negotiation. While there are situations
where an ‘‘avoid’’ approach would be effective, often in salary negotiations an avoid approach ‘‘leaves
money on the table.’’ The dual concerns model considers the avoiding strategy as one that represents
low concern about one’s own and other’s outcomes.

Return STRICT JSON in this format:
{
  "Competition": {
    "persuade_with_threats": number,
    "present_qualifications": number,
    "communicate_value": number,
    "persistent_no": number,
    "express_unreasonableness": number,
    "present_market_value": number,
    "comp_index": number
  },
  "Collaboration": {
    "mutual_acceptability": number,
    "integrate_interests": number,
    "joint_offer": number,
    "accurate_information": number,
    "open_concerns": number,
    "collaborate_offer": number,
    "understand_position": number,
    "collab_index": number
  },
  "Compromise": {
    "find_middle_ground": number,
    "propose_middle_ground": number,
    "give_and_take": number,
    "compr_index": number
  },
  "Accommodation": {
    "give_in_to_demands": number,
    "allow_concessions": number,
    "accommodate_wishes": number,
    "go_along_offer": number,
    "accom_index": number
  },
  "Avoidance": {
    "avoid_negotiating": number
  },
  "notes": "concise qualitative summary (1–2 sentences)"
}

Here are the item definitions to rate:

[Competition Scale]
1. persuade_with_threats – Persuade the organization by threatening to withdraw.
2. present_qualifications – Present past record and qualifications to improve the offer.
3. communicate_value – Emphasize value and benefits to influence the offer.
4. persistent_no – Do not take "no" for an answer.
5. express_unreasonableness – Express when an offer feels unreasonable.
6. present_market_value – Provide market value information of the position.

[Collaboration Scale]
1. mutual_acceptability – Seek an offer acceptable to both sides.
2. integrate_interests – Integrate own and organizational interests.
3. joint_offer – Work together to find a mutually acceptable offer.
4. accurate_information – Exchange accurate information to reach agreement.
5. open_concerns – Bring all concerns into the open for resolution.
6. collaborate_offer – Collaborate to create acceptable offer.
7. understand_position – Seek understanding of organization’s position.

[Compromise Scale]
1. find_middle_ground – Try to find a middle ground.
2. propose_middle_ground – Propose compromise solution.
3. give_and_take – Engage in give-and-take to resolve issues.

[Accommodation Scale]
1. give_in_to_demands – Give in to organizational demands.
2. allow_concessions – Allow more concessions than the organization.
3. accommodate_wishes – Accommodate the organization’s wishes.
4. go_along_offer – Go along with the initial offer.

[Avoidance Scale]
1. avoid_negotiating – Avoid negotiating after receiving an offer.

Rules:
- Base ratings only on the candidate’s language, tone, persistence, concessions, and self-advocacy.
- If insufficient data, use midpoint (4).
- Calculate each *_index as the mean of its items.
- Output valid JSON only.
`;

export async function POST(req) {
  try {
    const { conversation } = await req.json();
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
      });
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
    const parsed = JSON.parse(raw);

    // ✅ Ensure index fields exist even if AI forgets them
    function computeIndex(obj, keys, targetKey) {
      const values = keys.map((k) => obj[k]).filter((v) => typeof v === "number");
      obj[targetKey] = values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
    }

    computeIndex(parsed.Competition, [
      "persuade_with_threats",
      "present_qualifications",
      "communicate_value",
      "persistent_no",
      "express_unreasonableness",
      "present_market_value",
    ], "comp_index");

    computeIndex(parsed.Collaboration, [
      "mutual_acceptability",
      "integrate_interests",
      "joint_offer",
      "accurate_information",
      "open_concerns",
      "collaborate_offer",
      "understand_position",
    ], "collab_index");

    computeIndex(parsed.Compromise, [
      "find_middle_ground",
      "propose_middle_ground",
      "give_and_take",
    ], "compr_index");

    computeIndex(parsed.Accommodation, [
      "give_in_to_demands",
      "allow_concessions",
      "accommodate_wishes",
      "go_along_offer",
    ], "accom_index");

    computeIndex(parsed.Avoidance, ["avoid_negotiating"], "avoid_index");

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
