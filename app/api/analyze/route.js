
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import OpenAI from "openai";

export async function POST(req) {
  try {
    const { conversation } = await req.json();
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = "You are a negotiation research assistant. Analyze the transcript and output a strict JSON object only.";
    const user = `Analyze the following salary negotiation transcript and return ONLY valid JSON with these keys:
{
  "assertiveness": number (0..1),
  "cooperativeness": number (0..1),
  "anchoring": number (0..1),
  "emotional_tone": "positive" | "neutral" | "negative",
  "overall_intensity": number (0..1),
  "notes": string (one short sentence)
}

Transcript:
${conversation}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.1
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { parsed = { raw: content }; }

    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
