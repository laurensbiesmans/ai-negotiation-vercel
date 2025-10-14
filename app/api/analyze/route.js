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
  "Competition": { "1": number, "2": number, "3": number, "4": number, "5": number, "6": number },
  "Collaboration": { "1": number, "2": number, "3": number, "4": number, "5": number, "6": number, "7": number },
  "Compromise": { "1": number, "2": number, "3": number },
  "Accommodation": { "1": number, "2": number, "3": number, "4": number },
  "Avoidance": { "1": number },
  "notes": "concise qualitative summary (1-2 sentences)"
}

Here are the item statements to rate:

[Competition Scale]
1. During negotiation, I try to persuade the organization to better my offer by threatening to withdraw from the process.
2. In the negotiation process, I present information about my past record and qualifications to improve the quality of the offer extended to me.
3. During negotiations, I make clear the value and benefit I could bring to the organization, in an attempt to influence the process.
4. While negotiating, I do not take “no” for an answer.
5. During the negotiation process, if I feel that the organization's offer is unreasonable, I make sure to make my feelings known.
6. I present information about the market value of the position for which I was hired.

[Collaboration Scale]
1. I try to negotiate an offer that is acceptable to both me and the organization.
2. I try to integrate my interests with those of the organization to come up with an offer supported by both sides.
3. I try to work together with the organization to come up with an acceptable offer.
4. I exchange accurate information with the organization to come to a joint agreement.
5. I try to bring all of our concerns out in the open so that the issues can be resolved in the best possible way.
6. I collaborate with the organization to come up with an offer acceptable to both of us.
7. I try to work with the organization to gain a thorough understanding of their position.

[Compromise Scale]
1. I try to find a middle ground to reach an acceptable offer.
2. I propose a middle ground to resolve the differences between our two sides.
3. I tend to “give and take” so that compromise can be made.

[Accommodation Scale]
1. I initiate job negotiations, but I tend to give in to the demands of the organization.
2. To reach an agreement, I tend to allow more concessions than the organization.
3. I tend to feel myself trying to accommodate the wishes of the organization.
4. Though I attempt to negotiate, I tend to find myself going along with much of what the organization initially offered.

[Avoidance Scale]
1. After receiving a job offer, I avoid negotiating the terms of the offer.

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
      temperature: 0.2,
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
