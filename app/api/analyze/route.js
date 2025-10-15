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
    "comp_threat": number,
    "comp_record": number,
    "comp_value": number,
    "comp_persist": number,
    "comp_feelings": number,
    "comp_market": number,
    "comp_index": number
  },
  "Collaboratiing": {
    "collab_joint": number,
    "collab_integrate": number,
    "collab_work": number,
    "collab_info": number,
    "collab_concerns": number,
    "collab_cooperate": number,
    "collab_understand": number,
    "collab_index": number
  },
  "Compromise": {
    "compr_middle1": number,
    "compr_middle2": number,
    "compr_give": number,
    "compr_index": number
  },
  "Accommodation": {
    "accom_concede": number,
    "accom_givein": number,
    "accom_wish": number,
    "accom_accept": number,
    "accom_index": number
  },
  "Avoidance": {
    "avoid_negotiate": number,
    "avoid_index": number
  },
  "notes": "concise qualitative summary (1-2 sentences)"
}

Here are the item statements to rate:

[Competition Scale]
comp_threat — I try to persuade the organization to better my offer by threatening to withdraw from the process.
comp_record — I present information about my past record and qualifications to improve the quality of the offer extended to me.
comp_value — I make clear the value and benefit I could bring to the organization, in an attempt to influence the process.
comp_persist — While negotiating, I do not take “no” for an answer.
comp_feelings — If I feel that the organization's offer is unreasonable, I make sure to make my feelings known.
comp_market — I present information about the market value of the position for which I was hired.

[Collaboration Scale]
collab_joint — I try to negotiate an offer that is acceptable to both me and the organization.
collab_integrate — I try to integrate my interests with those of the organization to come up with an offer supported by both sides.
collab_work — I try to work together with the organization to come up with an acceptable offer.
collab_info — I exchange accurate information with the organization to come to a joint agreement.
collab_concerns — I try to bring all of our concerns out in the open so that the issues can be resolved in the best possible way.
collab_cooperate — I collaborate with the organization to come up with an offer acceptable to both of us.
collab_understand — I try to work with the organization to gain a thorough understanding of their position.

[Compromise Scale]
compr_middle1 — I try to find a middle ground to reach an acceptable offer.
compr_middle2 — I propose a middle ground to resolve the differences between our two sides.
compr_give — I tend to “give and take” so that compromise can be made.

[Accommodation Scale]
accom_concede — I initiate job negotiations, but I tend to give in to the demands of the organization.
accom_givein — To reach an agreement, I tend to allow more concessions than the organization.
accom_wish — I tend to feel myself trying to accommodate the wishes of the organization.
accom_accept — Though I attempt to negotiate, I tend to find myself going along with much of what the organization initially offered.

[Avoidance Scale]
avoid_negotiate — After receiving a job offer, I avoid negotiating the terms of the offer.

Rules:
- Base ratings only on candidate’s language, tone, persistence, concessions, and self-advocacy.
- If insufficient data, give a midpoint (4).
- Output valid JSON, no extra text.
`;
export async function POST(req) {
  try {
    const { conversation } = await req.json();
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
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
    return new Response(raw, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
