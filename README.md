# Ashdown Gym — Setup Notes

## What changed

The weight inputs now log to a small history (newest-first, last 50 entries
per set) stored in **Vercel KV** (Redis under the hood). Each weight input
shows:

- A small **sync dot** next to it (yellow while saving, green briefly after
  a successful save, red if the save failed — falls back silently to
  localStorage either way, so you never lose the value on your phone).
- A **"last Xkg ↑/↓/→"** label showing your most recent logged weight for
  that exact set, with a trend arrow vs. the session before that.
- A small **clock icon** that opens a bottom-sheet modal with the full
  history for that exercise, switchable across sets via tabs.

## One-time setup in your Vercel project

1. Push this folder to your `tiodu/Gym-card` GitHub repo (replacing the
   current `ashdown-gym.html` — the file is now `public/index.html` and
   there's an `api/weights.js` serverless function alongside it).

2. In the Vercel dashboard, open your `gym-card` project → **Storage** tab →
   **Create Database** → choose **KV** (it's Upstash Redis under the hood,
   free tier is more than enough for this).

3. Vercel will automatically inject the required environment variables
   (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) into your project — you
   don't need to copy/paste anything manually as long as you create the KV
   store from inside this same project.

4. Redeploy (Vercel will do this automatically on your next git push, or
   you can trigger a redeploy manually from the dashboard).

That's it — no other config needed. The `@vercel/kv` package in
`package.json` will be installed automatically during the Vercel build.

## Testing locally (optional)

If you want to test before pushing:

```bash
npm install -g vercel
cd ashdown-gym-vercel
vercel link        # link to your existing gym-card project
vercel env pull    # pulls the KV env vars into .env.local
vercel dev
```

Then open `http://localhost:3000`.

## Notes on the data model

- Each exercise+set pair has its own history key in KV: `history:{exerciseId}:{setIndex}`
- Every POST appends a new `{ weight, date }` entry (server-stamped date,
  so it's always accurate regardless of your phone's clock) and keeps the
  most recent 50 entries.
- The frontend fetches all sets for an exercise in one request
  (`?allSets=true`) to keep API calls low — only one fetch per exercise
  card, not one per set.
- Weight is still also saved to `localStorage` as a fast local cache and a
  fallback if the network request fails, but `localStorage` no longer
  holds the source of truth for history — KV does.
