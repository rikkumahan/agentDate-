# Project Plan

_Last updated: 2026-10-14_

## Goal
Agentic dating site (3-hour test). Paste LinkedIn + public Instagram links for 25+ real
people → each person gets an agent that reads them → profile page → agents go on dates
with each other → per-person ranking of who fits best.

## Pipeline
1. **Scrape** (`/api/scrape`): Apify — one Instagram actor run + one LinkedIn actor run for all people.
2. **Analyze** (`/api/analyze`): LLM reads both raw sources → profile (needs, hobbies, interests, values, evidence).
3. **Shortlist** (`/api/shortlist`): each agent picks its top 3 from everyone's summaries.
4. **Date** (`/api/date`): every shortlisted pair dates — venue picked, two agents alternate turns
   (each only knows its own person), then each agent privately scores the date.
5. **Rank** (`lib/rank.ts`): per person, sort their dates by mutual score.

## Architecture / key decisions
- Next.js App Router only, deployed on Vercel. Client orchestrates the pipeline; API routes are stateless.
- LLM: any OpenAI-compatible endpoint (`LLM_BASE_URL`), default Groq; Kaggle Ollama is a drop-in swap.
- Persistence: live run in browser localStorage; finished demo committed as `public/demo.json`.

## Hand-in checklist
- [ ] 25 real people (LinkedIn + public IG)
- [ ] Full run → export → `public/demo.json`
- [ ] Deploy to Vercel, env vars set
- [ ] Public GitHub repo
- [ ] ≤3 min video: analysis → profile page → dates → rankings
- [ ] 200-char explanation + scraping tech section
