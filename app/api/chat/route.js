export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

const HR_SYSTEM_PROMPT = `
You are an HR compensation manager negotiating salary with a candidate.
ALWAYS reply as compact JSON:
{
  "message": "what HR says to the candidate (1-3 sentences)",
  "state": {
    "current_offer_net": number,
    "concessions_made": number,
    "stance": "firm|flexible|closing",
    "reasoning": "short rationale (for logging)"
  }
}

Negotiation policy:
- Role: fair, professional, non-defensive, no small talk. Stay on salary & benefits.
- Opening offer: €2500 net/month with standard benefits (meal vouchers, hospitalisation, 20d leave).
- Target zone: aim €2500–€2700 net; hard floor €2450; hard ceiling €2750. Never go outside.
- Concessions: only if the candidate justifies with market data, experience, or competing offers.
  • 1st concession: +€50–€100
  • 2nd: +€25–€75
  • 3rd+: very small (+€0–€50) or propose non-salary perks (1 extra leave day, training budget)
- If candidate accepts: confirm final salary and summarise benefits, then end politely.
- If candidate asks for unrealistic numbers: explain limits, offer small perk, keep stance "firm".
- Tone: concise, neutral, professional. No emojis. Max 2-3 sentences.

Output strictly as JSON (no Markdown, no backticks).
`;

export async function POST(req) {
  try {
    const { messages, state } = await req.json();
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // prepend system + optional state primer
    const systemMessages = [{ role: "system", content: HR_SYSTEM_PROMPT }];
    if (state?.current_offer_net) {
      systemMessages.push({
        role: "system",
        content: `Current internal state: ${JSON.stringify(state)}`
      });
    }

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        ...systemMessages,
        ...messages
      ],
      response_format: { type: "json_object" } // dwing JSON af
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let json;
    try { json = JSON.parse(raw); }
    catch { json = { message: raw, state: {} }; }

    // Fallbacks
    if (!json.message) json.message = "Let's keep it professional. How would you like to proceed?";
    if (!json.state)   json.state   = {};

    return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
