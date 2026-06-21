# noted — PHP API (Railway)

A small Slim 4 PHP API that powers AI summaries, insights, search, knowledge-graph
queries, and link suggestions for the **noted** app. Deploy this folder to Railway
as its own service and point your Lovable frontend at the resulting URL.

## Endpoints

All endpoints (except `/health`) require an `Authorization: Bearer <supabase_jwt>`
header. The middleware verifies the JWT against `SUPABASE_JWT_SECRET` and extracts
`user_id` from the `sub` claim.

| Method | Path                  | Purpose                                        |
| ------ | --------------------- | ---------------------------------------------- |
| GET    | `/health`             | Liveness check                                 |
| POST   | `/summarize`          | `{ note_id }` → writes `notes.summary`         |
| POST   | `/insights/generate`  | Recompute and store study insights             |
| GET    | `/graph`              | Returns `{ nodes, edges }` for the user        |
| GET    | `/search?q=…`         | Full-text search across the user's notes       |
| POST   | `/suggest-links`      | `{ note_id }` → AI-suggested related notes     |

## Environment variables

Set these on Railway (Project → Variables):

| Var                         | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`              | `https://<ref>.supabase.co`                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret, server-only)                     |
| `SUPABASE_JWT_SECRET`       | JWT secret from Supabase → Project Settings → API          |
| `DASHSCOPE_API_KEY`         | Your Alibaba Cloud DashScope (Qwen) API key                |
| `QWEN_MODEL`                | e.g. `qwen-max`, `qwen-plus`, `qwen3-235b-a22b`            |
| `ALLOWED_ORIGIN`            | Your Lovable frontend origin (e.g. `https://…lovable.app`) |

## Deploy on Railway

1. Push this `php-api/` folder to its own GitHub repo (or a subdirectory of an
   existing one with the root path set to `php-api/`).
2. In Railway → **New → Deploy from GitHub** → select that repo.
3. Railway auto-detects the `Dockerfile` and builds.
4. Add the environment variables above.
5. Generate a public domain (Settings → Networking → Generate Domain).
6. Copy that URL and, in Lovable Project Settings → Environment, set
   `VITE_RAILWAY_API_BASE_URL=https://<your-railway-url>`.

## Local dev

```bash
composer install
php -S 0.0.0.0:8080 -t public public/index.php
```

## Why a separate service?

Lovable apps run on Cloudflare Workers — no PHP runtime. Railway runs the PHP
container; the browser talks to Supabase directly for CRUD and to Railway only
for AI / aggregation work. The Qwen key and Supabase service role key live only
on Railway and never reach the browser.