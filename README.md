# agentDate ♥

Every person is represented by an AI agent. The agent reads its person's public LinkedIn and Instagram,
builds a profile (needs, hobbies, interests, values — with quoted evidence), goes on dates with other
agents on that person's behalf, and ranks who fits them best.

- **Demo (25 real people, already run):** `/demo`
- **Try it:** paste LinkedIn + public Instagram links on `/` — optionally added to the demo pool so your people have someone to date.

## How it works

```
LinkedIn + Instagram ──▶ Apify scrapers ──▶ Agent reads person ──▶ Profile page
                                                    │
                     Ranking ◀── private debriefs ◀── Dates ◀── Agent shortlists 3
```

1. **Scrape** — `app/api/scrape`: one Apify run per platform for the whole batch
   (`apify/instagram-profile-scraper`, `harvestapi/linkedin-profile-scraper`). Raw JSON is pruned of media/IDs.
2. **Read** — `app/api/analyze`: the LLM turns both sources into a profile. Every claim must be grounded;
   the evidence list quotes the captions / job entries it came from.
3. **Shortlist** — `app/api/shortlist`: each agent reviews the whole pool and asks out its top 3, with a reason.
4. **Date** — `app/api/date` (streamed): a venue is picked from both people's hobbies, then two *separate* agents
   take turns. Each agent only knows its own person; it learns about the other only from the conversation,
   and probes its person's needs and dealbreakers. Afterwards each agent privately scores the date (0–100),
   says whether it wants a second date, and lists highlights and concerns.
5. **Rank** — `lib/rank.ts`: per person, dates sorted by mutual score (mean of both agents, +5 if both want a second date).

The browser orchestrates the pipeline (resumable — re-running only does what's missing); API routes are stateless.

## Stack

Next.js 16 (App Router) on Vercel · AI SDK 7 with any OpenAI-compatible LLM (Groq by default) · Apify · Tailwind.

## Run locally

```
npm install
cp .env.example .env.local   # APIFY_TOKEN, LLM_API_KEY (+ LLM_BASE_URL / LLM_MODEL to swap providers)
npm run dev
npm test
```

To publish a finished run as the demo: open `/live` → **Export JSON** → save as `public/demo.json`.
