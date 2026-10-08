# قفشة (Afsha) — Egyptian meme-caption party game

Friends join a private room with a 6-digit code, everyone captions the same meme, captions are revealed anonymously, everyone votes for the funniest, and points add up over the rounds. Arabic-first, right-to-left, built for phones, 2–10 players.

**Everything runs on free plans with no credit card:**

| Part | Runs on | What it does |
|---|---|---|
| `client/` | **Vercel** (Hobby, free) | The website your friends open |
| `server/` | **Cloudflare Workers + Durable Objects** (Workers Free) | The game server: rooms, timers, captions, votes, scores |
| `shared/` | — | Code and data used by both (rules config, message types, **meme templates**) |

```
browser ──HTTPS──▶ Vercel (static site)
   │
   └──WebSocket──▶ Cloudflare Worker ──▶ Durable Object "room 482731"  (one per room, authoritative)
```

Why this setup: a Vercel site alone can't hold live multiplayer state. Each room on Cloudflare is its own small server that keeps every player's connection, runs the timers on the server clock, validates every action and deletes itself when the room is empty. If you ever pass the free daily limit (around a thousand games a day), Cloudflare blocks requests until midnight UTC. It never bills you.

---

## 1. Project structure

```
afsha/
├── client/                    Vite + React + TypeScript website
│   ├── public/templates/      ← meme images go here
│   ├── src/
│   │   ├── screens/           one file per game phase (Home, Lobby, Caption, Voting, Results…)
│   │   ├── components/        reusable UI (MemeCard, Timer, PlayerList, Leaderboard…)
│   │   ├── hooks/useRoom.ts   WebSocket connection + auto-reconnect
│   │   ├── i18n/ar.ts         every piece of interface text (Arabic)
│   │   ├── lib/               server URL, HTTP API, session storage
│   │   └── styles/global.css  visual identity
│   └── .env.example
├── server/                    Cloudflare Worker
│   ├── src/index.ts           HTTP router (create / join / websocket)
│   ├── src/room.ts            Durable Object = one room (sockets, alarms, storage)
│   ├── src/game/engine.ts     the rules: state machine, validation, timers
│   ├── src/game/scoring.ts    scoring rules (easy to extend)
│   ├── src/game/view.ts       what each player is allowed to see (anti-cheat)
│   ├── test/engine.test.ts    unit tests
│   └── wrangler.jsonc         Cloudflare config
├── shared/
│   ├── config.ts              player limits, timers, round options, caption length
│   ├── templates.json         ← the meme list
│   ├── templates.ts           template loader (swap for a DB later)
│   ├── protocol.ts            messages between browser and server
│   ├── moderation.ts          optional blocked-words list
│   └── text.ts                Arabic text helpers
├── scripts/
│   ├── simulate.mjs           automated multiplayer test (10 players, 11th rejected, …)
│   └── make-placeholder-templates.mjs
└── vercel.json
```

Game phases (server state machine): `LOBBY → COUNTDOWN → CAPTION → REVEAL → VOTING → ROUND_RESULTS → (next round | FINAL_RESULTS)`.

---

## 2. Run it on your computer

Requires **Node.js 20+** (22 recommended).

```bash
npm run setup          # installs server + client dependencies
npm run dev:server     # terminal 1 — local Cloudflare runtime on http://localhost:8787
npm run dev:client     # terminal 2 — website on http://localhost:5173
```

No environment variables are needed locally: the website automatically talks to `localhost:8787` in development.

**Test multiplayer alone:** open `http://localhost:5173` in several tabs or windows. Each tab is a separate player, because the seat is stored per tab. Create the room in one tab and join from the others.

**Test with phones on the same Wi-Fi:** `dev:client` prints a "Network" address (e.g. `http://192.168.1.20:5173`). Open it on your phone. Online play is covered in section 5.

**Automated tests:**

```bash
npm test               # rule/engine unit tests (no server needed)
npm run simulate       # live multiplayer test against the running dev server
```

---

## 3. Deploy the game server to Cloudflare (free)

You need a free Cloudflare account. **Do not add a payment method.**

### Option A — from the Cloudflare dashboard (no terminal; auto-deploys on every push)

1. Push this project to a GitHub repository (see section 6).
2. Go to **dash.cloudflare.com** → sign up or log in.
3. Open **Workers & Pages** → **Create application** → **Get started** next to **Import a repository**.
4. Select your GitHub account (click **Connect GitHub** and authorise Cloudflare the first time), then pick your repository.
5. Configure the project:
   - **Project name:** `afshaa`. It must match `"name"` in `server/wrangler.jsonc`, or the build fails.
   - **Build command:** `npm install`
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Root directory** (under advanced/build settings): `server`
6. Click **Save and Deploy**. Wait for the build log to finish (about a minute).
7. If this is your first Worker, Cloudflare asks you to choose a **workers.dev subdomain** (e.g. `seif`). Pick any free name.
8. Open the Worker's page. Copy its URL, which looks like **`https://afshaa.seifallah-work.workers.dev`**. Opening it in a browser should show *"Afsha game server is running ✔"*.

From now on, every push to GitHub redeploys the server automatically.

### Option B — from your terminal

```bash
cd server
npm install
npx wrangler login     # opens the browser to authorise; one time only
npx wrangler deploy    # prints your URL: https://afshaa.<subdomain>.workers.dev
```

### Lock the server to your website (recommended, after section 4)

By default, any website may connect (`"ALLOWED_ORIGINS": "*"`). Once you know your Vercel URL, edit `server/wrangler.jsonc`:

```jsonc
"vars": { "ALLOWED_ORIGINS": "https://afsha.vercel.app" }
```

Push again (Option A) or run `npx wrangler deploy` (Option B).

**Free-plan notes:** Durable Objects are free only with SQLite storage. That's why `wrangler.jsonc` uses `"new_sqlite_classes"`; don't change it. Free limits reset every day at 00:00 UTC (3 AM Cairo).

---

## 4. Deploy the website to Vercel (free)

1. Go to **vercel.com** → sign up with GitHub (Hobby plan, free).
2. **Add New → Project** → import your repository.
3. Leave **Root Directory** as the repository root. `vercel.json` already tells Vercel how to build `client/`.
4. Open **Environment Variables** and add:
   - **Name:** `VITE_GAME_SERVER_URL`
   - **Value:** your Worker URL from step 3, e.g. `https://afshaa.seifallah-work.workers.dev` (no trailing slash)
5. Click **Deploy**. You get a URL like `https://afsha.vercel.app`.

If you change the environment variable later, go to **Deployments → ⋯ → Redeploy**, because Vite bakes it in at build time.

If the website shows *"السيرفر مش متظبط"*, the variable is missing. Add it and redeploy.

---

## 5. Play / test the deployed version

1. Open your Vercel URL → type your name → **إنشاء لعبة**.
2. Tap **ابعت للشلة** (shares an invite link, e.g. `https://afsha.vercel.app/?room=482731`) or **انسخ الكود**.
3. Friends open the link (the code is pre-filled), or open the site and type the code → **انضم للعبة**.
4. When at least 2 players are in, the host taps **ابدأ اللعبة**.

To test online alone: open the URL on your phone (mobile data) and on your laptop, or in several browser tabs. To run the automated test against the live server:

```bash
SERVER=https://afshaa.seifallah-work.workers.dev npm run simulate
```

---

## 6. Put it on GitHub

```bash
cd afsha
git add .
git commit -m "Afsha meme game"
git branch -M main
git remote add origin https://github.com/<you>/afsha.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, builds and `.env` files. The project has **no secrets**: the only setting, `VITE_GAME_SERVER_URL`, is a public URL.

---

## 7. Add meme templates (Google Drive)

The game takes its memes from this Google Drive folder:
https://drive.google.com/drive/folders/1IFlNv8pigQ6cqRXfIeUT06edaT4GlZDy
The folder ID is set in `server/wrangler.jsonc` → `DRIVE_FOLDER_ID`.

**To add a meme, upload the image to the folder.** It appears in the next game within about 5 minutes. Nothing else to edit and no redeploy.

| You want… | Do this |
|---|---|
| Caption at the top of the image | Start the file name with `top` or `فوق`, e.g. `top - الواد بيبص.jpg` |
| Caption at the bottom (default) | Any other name, e.g. `مراتي بتسألني.jpg` |
| A category | Put the image in a sub-folder; the folder name is the category (`كورة`, `أفلام`, …) |
| Hide a meme without deleting it | Move it into a sub-folder named `مخفي` |

Formats: JPG, PNG or WebP. Images under ~1 MB load fastest on phones.

**Check what the server sees:** open `https://afshaa.seifallah-work.workers.dev/api/templates`. It shows `"source": "google-drive"` and the number of memes found.

### One-time setup: Google API key (free, ~10 minutes)

1. Go to https://console.cloud.google.com and sign in with the Google account that owns the folder.
2. At the top, click the project picker → **New project** → name it `afsha` → **Create**, and select it.
3. Go to **APIs & Services → Library**, search **Google Drive API**, and click **Enable**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**. Copy the key.
5. Recommended: click the new key → **API restrictions → Restrict key → Google Drive API → Save**.
6. In Cloudflare, go to **Workers & Pages → afshaa → Settings → Variables and Secrets → Add**:
   - Type: **Secret**
   - Name: `GOOGLE_API_KEY`
   - Value: the key

   Then click **Deploy** (or Save).
7. Open `/api/templates` (see above) to confirm the server sees your memes.

The folder must stay shared as **"Anyone with the link → Viewer"**.

**Fallback:** if the key is missing, Drive is unreachable, or the folder is empty, the game uses the built-in templates in `shared/templates.json` (images in `client/public/templates/`), so it never stops working.

## 8. Change the rules

| What | Where |
|---|---|
| Max players, caption length, name length, countdown/reveal/results durations, disconnect grace periods, room expiry | `shared/config.ts` → `GAME_CONFIG` |
| Round choices (3/5/7/10), caption timer choices, voting timer choices, defaults | `shared/config.ts` |
| Scoring (add a winner bonus, streaks, …) | `server/src/game/scoring.ts` → add a rule to `SCORING_RULES` |
| Words to block in names/captions | `shared/moderation.ts` → `BLOCKED_WORDS` (empty by default) |
| Interface text | `client/src/i18n/ar.ts` |
| Colours, fonts, look | `client/src/styles/global.css` (tokens at the top) |

---

## 9. How the hard parts work

- **Authoritative server:** browsers only send *intentions* ("start", "submit this caption", "vote for meme X"). The room validates host rights, phase, timer, room membership, ownership and capacity, and computes all scores. A client cannot give itself points.
- **No peeking:** during the caption phase other players only receive *who* submitted (`hasSubmitted`), never the text. Captions are shuffled and sent anonymously at the reveal. Authors appear only on the results screen.
- **Server timers:** each phase has a deadline (`phaseEndsAt`) enforced by a Durable Object alarm. Browsers show a countdown corrected for clock differences. Late captions and votes are rejected.
- **Early advance:** if every connected player has submitted (or voted), the phase ends immediately.
- **Refresh / disconnects:** each tab keeps a secret seat token. Reconnecting with it restores the seat and score. In the lobby, a player who is gone for 30 s is removed. In a game they stay on the scoreboard and can rejoin any time.
- **Host leaves:** after 15 s offline, or immediately on "leave", host rights pass to the next player who joined.
- **Room cleanup:** a room with nobody connected deletes itself after 10 minutes (an empty lobby after about 1 minute). Every room is closed after 3 hours.
- **Joining:** room code must be 6 digits (Arabic-Indic digits like ٤٨٢ are accepted). Joining is refused for unknown rooms, full rooms (10) and games already in progress.

---

## 10. Ideas already prepared for later

Categories (data and settings already exist), host-chosen categories, more scoring rules, avatars, sound, emoji reactions, spectator mode, custom uploads, persistent stats. Each slots into a specific file listed above rather than requiring a rewrite.
