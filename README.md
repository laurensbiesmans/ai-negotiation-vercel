
# Salary Negotiator (Full)

Neutral, AI-driven salary negotiation simulator built with Next.js 14 (App Router) and TailwindCSS.

## 1) Files to check
- `app/page.jsx` – chat UI
- `app/api/chat/route.js` – talks to OpenAI (defaults to `gpt-4o-mini`)
- `app/api/analyze/route.js` – returns 5-dimension analysis (JSON)
- `app/globals.css` + `tailwind.config.cjs` + `postcss.config.cjs` – Tailwind setup
- `app/layout.jsx` – imports `globals.css` and sets page shell

## 2) Deploy on Vercel
1. Create a new GitHub repo and upload **the contents** of this folder.
2. Import the repo on Vercel.
3. Add environment variables in **Project → Settings → Environment Variables**:
   - `OPENAI_API_KEY` = your key from https://platform.openai.com/api-keys
   - (Optional) `OPENAI_MODEL` = `gpt-4o-mini`
4. Redeploy. Clear the build cache if needed.

## 3) Qualtrics
- Use a **Question → Text/Graphic** with an **iFrame** that points to your Vercel URL.
- Set iFrame height ~800–1000px for a good chat view.
- Pass respondent IDs via query params if needed (e.g., `?rid=${e://Field/ResponseID}`).

## 4) Notes
- All keys are read from environment variables (no secrets in code).
- The analysis endpoint attempts to coerce model output to valid JSON.
