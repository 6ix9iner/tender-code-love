
## Scope

A clean, highly responsive web app for students to capture, tag, link, search, and AI-summarize academic notes — plus a knowledge graph and study insights. Frontend lives in Lovable (TanStack Start + React + Tailwind + shadcn). Data lives in your existing Supabase project. Heavy logic (AI calls to Qwen, summarization, insights aggregation, graph computation) runs on a **PHP API you host on Railway**.

## Architecture

```text
Browser (React, TanStack Start)
    │
    ├── Direct Supabase calls (CRUD, auth, realtime)  ── publishable key, RLS
    │
    └── fetch()  ──► PHP API on Railway
                       ├── verifies Supabase JWT (user identity)
                       ├── talks to Supabase via service role for aggregations
                       └── calls Qwen (DashScope) for summaries / insights
```

- **Auth:** Supabase Auth (email + password) on the frontend.
- **CRUD (notes/tags/links):** direct Supabase from the browser; RLS already enforces ownership.
- **AI + analytics:** all go through the PHP API so the Qwen key and service role key never touch the browser.

## What I will build (in Lovable)

**Frontend (TanStack Start)**
1. Auth flow — sign up / sign in / sign out, `_authenticated` route gate.
2. App shell — minimalist layout, left sidebar (search + tag filter), main pane, right context panel; fully responsive (collapses to bottom-sheet nav on mobile).
3. Pages:
   - `/` — dashboard: recent notes, revision reminders, study insights cards.
   - `/notes` — list + search + tag filter, virtualized for speed.
   - `/notes/$id` — markdown editor, tag editor, "linked notes" panel, "AI summarize" button, view-tracking.
   - `/graph` — interactive knowledge graph (nodes = notes, edges = `note_links` + shared tags), zoom/pan/click-to-open.
   - `/insights` — AI-generated insights (frequent topics, suggested focus, gaps).
   - `/auth` — sign in / sign up.
4. Shared API client — small `apiClient.ts` that calls the Railway PHP base URL with the user's Supabase JWT in `Authorization: Bearer ...`.
5. Realtime — subscribe to `notes` changes for live updates across tabs.

**Database (Supabase)**
- Existing schema already covers: `notes`, `tags`, `note_tags`, `note_links`, `note_views`, `insights`, `app_users`. No migrations needed up front.
- One small migration: add a `search_tsv` generated tsvector column + GIN index on `notes` for fast full-text search.

**Secrets needed in Lovable**
- `RAILWAY_API_BASE_URL` — public, stored as `VITE_RAILWAY_API_BASE_URL`.

## What you will run on Railway (I cannot deploy this for you)

I'll deliver a `php-api/` folder in the repo with a complete, ready-to-deploy Slim 4 PHP app:
- `POST /summarize` — body `{ note_id }` → calls Qwen, writes `notes.summary`.
- `POST /insights/generate` — recomputes study insights, writes to `insights`.
- `GET /graph` — returns nodes + edges for the current user.
- `GET /search?q=…` — full-text search using the new tsvector.
- `POST /suggest-links` — Qwen suggests related notes for a given note.
- Middleware: validates Supabase JWT (`SUPABASE_JWT_SECRET`), extracts `user_id`.
- Uses Supabase service role for DB; uses Qwen via DashScope `chat/completions`.
- Includes `Dockerfile`, `composer.json`, `.env.example`, README with Railway deploy steps.

**Env vars you'll set on Railway:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DASHSCOPE_API_KEY`, `QWEN_MODEL` (default `qwen-max`), `ALLOWED_ORIGIN`.

## Design direction

Minimalist, paper-like, very high information density without feeling cluttered:
- **Palette:** near-white `#FAFAF7` bg, ink `#111111` text, single accent `#2F6BFF`, muted borders `#E7E5DE`. Dark mode: `#0E0E10` / `#F2F2EE` / `#6B8CFF`.
- **Type:** Inter for UI, IBM Plex Serif for note body (readable long-form). Loaded via `@fontsource`.
- **Motion:** 120–180ms ease-out only; no bounces. Graph uses subtle force-directed layout.
- **Components:** shadcn (Button, Input, Command palette for `⌘K` search, Sheet for mobile nav, Dialog, Tooltip).

## Open questions / heads-up

1. **Qwen key:** I'll add `DASHSCOPE_API_KEY` to your Railway env, not Lovable — it must never reach the browser. Lovable doesn't store it.
2. **"Qwen 3.7 Max"** isn't a public model name; the closest current models are `qwen-max`, `qwen-plus`, `qwen3-235b-a22b`. The PHP code will read the model name from `QWEN_MODEL` so you can swap it.
3. **PHP deploy is on you.** I'll generate the code and instructions; you push the `php-api/` folder to a Railway service and paste its URL back so I can wire `VITE_RAILWAY_API_BASE_URL`.
4. **Workspace rule conflict:** your workspace memory says "use ONLY Claude Opus 4.7" but you've asked for Qwen. I'm following your direct request (Qwen) and ignoring the workspace memory rule for this build. Say the word if you'd rather honor the memory.

## Build order

1. Migration: add `notes.search_tsv` + index.
2. Auth + `_authenticated` gate + app shell + responsive nav.
3. Notes CRUD (list, editor, tags, links) wired straight to Supabase.
4. PHP API scaffold (`php-api/` in repo) with all 5 endpoints + auth middleware + Dockerfile + README.
5. Frontend `apiClient` + summarize button + insights page + graph page + command-palette search.
6. Polish: empty states, loading skeletons, keyboard shortcuts, mobile sheet nav.

Approve this and I'll start with steps 1–3 (frontend usable end-to-end against Supabase), then drop the PHP folder so you can deploy it on Railway in parallel.
