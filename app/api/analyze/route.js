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

These are the items to rate (1–7 scale). Use these **exact JSON keys** and link each to its full original item text:

Competing:
- "persuade_with_threats" = "During negotiation, I try to persuade the organization to better my offer by threatening to withdraw from the process."
- "present_qualifications" = "In the negotiation process, I present information about my past record and qualifications to improve the quality of the offer extended to me."
- "communicate_value" = "During negotiations, I make clear the value and benefit I could bring to the organization, in an attempt to influence the process."
- "persistent_no" = "While negotiating, I do not take “no” for an answer."
- "express_unreasonableness" = "During the negotiation process, if I feel that the organization's offer is unreasonable, I make sure to make my feelings known."
- "present_market_value" = "I present information about the market value of the position for which I was hired."

Collaborating:
- "mutual_acceptability" = "I try to negotiate an offer that is acceptable to both me and the organization."
- "integrate_interests" = "I try to integrate my interests with those of the organization to come up with an offer supported by both sides."
- "joint_offer" = "I try to work together with the organization to come up with an acceptable offer."
- "accurate_information" = "I exchange accurate information with the organization to come to a joint agreement."
- "open_concerns" = "I try to bring all of our concerns out in the open so that the issues can be resolved in the best possible way."
- "collaborate_offer" = "I collaborate with the organization to come up with an offer acceptable to both of us."
- "understand_position" = "I try to work with the organization to gain a thorough understanding of their position."

Compromising:
- "find_middle_ground" = "I try to find a middle ground to reach an acceptable offer."
- "propose_middle_ground" = "I propose a middle ground to resolve the differences between our two sides."
- "give_and_take" = "I tend to “give and take” so that compromise can be made."

Accommodating:
- "give_in_to_demands" = "I initiate job negotiations, but I tend to give in to the demands of the organization."
- "allow_concessions" = "To reach an agreement, I tend to allow more concessions than the organization."
- "accommodate_wishes" = "I tend to feel myself trying to accommodate the wishes of the organization."
- "go_along_offer" = "Though I attempt to negotiate, I tend to find myself going along with much of what the organization initially offered."

Avoiding (reversed item):
- "avoid_negotiating" = "After receiving a job offer, I negotiated to get what I wanted. (reversed item)"
  → Reverse-score this item so that 1 = not avoiding (i.e., fully engaged in negotiation) and 7 = fully avoiding negotiation.

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
- Reverse-code Avoiding as (8 - score).
- All numeric answers must be plain numbers (1–7), not text.
- Return valid JSON only.
`;

export async function POST(req) {
  try {
    const { conversation } = await req.json();
    if (!conversation) {
      return Response.json({ error: "No conversation provided." }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert organizational psychologist analyzing negotiation transcripts.",
        },
        {
          role: "user",
          content: `${ANALYZE_PROMPT}\n\nConversation:\n${conversation}`,
        },
      ],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content || "{}";
    let analysis = JSON.parse(text);

    // ✅ Compute index scores
    function mean(obj) {
      const vals = Object.values(obj || {}).map((v) => parseFloat(v) || 4);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 4;
    }

    const l = mean(analysis.Collaborating);
    const c = mean(analysis.Competing);
    const p = mean(analysis.Compromising);
    const a = mean(analysis.Accommodating);
    const v = mean(analysis.Avoiding);

    analysis = {
      ...analysis,
      Collaborating: { ...analysis.Collaborating, collab_index: l },
      Competing: { ...analysis.Competing, comp_index: c },
      Compromising: { ...analysis.Compromising, compr_index: p },
      Accommodating: { ...analysis.Accommodating, accom_index: a },
      Avoiding: { ...analysis.Avoiding, avoid_index: v },
    };

    return Response.json(analysis);
  } catch (err) {
    console.error("❌ Error in /api/analyze:", err);
    return Response.json({ error: "Analysis failed." }, { status: 500 });
  }
}
