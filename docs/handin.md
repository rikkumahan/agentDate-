# Hand-in drafts

## Overall explanation (≤200 chars)

Paste LinkedIn + Instagram links. An AI agent reads each person, builds a profile, then goes on real dates with other agents on their behalf and ranks who fits them best.

## Technical section — scraping stack (≤500 chars)

Apify actors run from a Next.js API route on Vercel: apify/instagram-profile-scraper (bio, captions, hashtags, locations, image alt-text from public profiles) and dev_fusion/Linkedin-Profile-Scraper (headline, experience, education, about). One batched run per platform; results matched back by handle/slug, pruned of media/IDs, then read by an LLM (Groq, OpenAI-compatible) via the Vercel AI SDK.

## Video shot list (≤3 min)

1. 0:00–0:15 Home: paste links, "Send the agents out".
2. 0:15–0:45 Pipeline: scraping → agents reading (activity log), profiles appear.
3. 0:45–1:25 Profile page: summary, needs, dealbreakers, hobbies, evidence quotes from LinkedIn/IG.
4. 1:25–2:20 Dates: live side-by-side chats, venue, both agents' private debriefs + second-date call.
5. 2:20–2:55 Rankings: per-person ranked list, click into a top match's date.
