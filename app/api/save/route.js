export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export async function POST(req) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      return Response.json({ error: "Missing Supabase env vars" }, { status: 500 });
    }

    const body = await req.json();
    const {
      rid,
      cond = null,
      salary = null,
      agreement = null,
      transcript = null,
      analysis = null,
      n_user_messages = null,
      started_at = null,
      finished_at = null,
    } = body || {};

    if (!rid) {
      return Response.json({ error: "Missing rid" }, { status: 400 });
    }

    // salaris veilig als getal of null wegschrijven
    const salaryNum =
      salary === null || salary === "" || isNaN(parseFloat(salary))
        ? null
        : parseFloat(salary);

    const { error } = await supabase
      .from("negotiations")
      .upsert(
        {
          rid,
          cond,
          salary: salaryNum,
          agreement,
          transcript,
          analysis,
          n_user_messages,
          started_at,
          finished_at,
        },
        { onConflict: "rid" }
      );

    if (error) {
      console.error("❌ Supabase insert failed:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("❌ /api/save failed:", err);
    return Response.json({ error: "Save failed." }, { status: 500 });
  }
}
