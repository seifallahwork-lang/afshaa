// End-to-end multiplayer test against a running game server.
//   cd server && npm run dev          (in one terminal)
//   node scripts/simulate.mjs         (in another)
// Or against the deployed server:
//   SERVER=https://afsha-server.<you>.workers.dev node scripts/simulate.mjs
// Requires Node 22+ (built-in WebSocket).

const SERVER = (process.env.SERVER ?? "http://localhost:8787").replace(/\/$/, "");
const WS = SERVER.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(label, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} ${extra}`);
  }
}

/** One-text-box meme. */
const meme = (text) => ({ boxes: [{ id: "a", text, x: 5, y: 70, w: 90, h: 25, color: "#FFFFFF", bg: "transparent", rounded: false, size: 7 }], strokes: [] });
const AVATAR = { bg: 1, skin: 2, hair: 3, hairColor: 1, eyes: 1, eyeColor: 2, mouth: 1, beard: 0, glasses: 1, hat: 2 };

async function api(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

class Player {
  constructor(name, session) {
    this.name = name;
    this.session = session;
    this.state = null;
    this.errors = [];
    this.closed = null;
    this.log = [];
  }
  connect() {
    return new Promise((resolve) => {
      const { code, token } = this.session;
      this.ws = new WebSocket(`${WS}/api/rooms/${code}/ws?token=${token}`);
      this.ws.onmessage = (e) => {
        this.log.push(e.data);
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
          this.state = msg.state;
          resolve();
        } else if (msg.type === "error") this.errors.push(msg.code);
        else if (msg.type === "closed") {
          this.closed = msg.reason;
          resolve();
        }
      };
      this.ws.onclose = (e) => {
        this.closeCode = e.code;
        resolve();
      };
    });
  }
  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }
  close() {
    this.ws.close();
  }
  get id() {
    return this.session.playerId;
  }
}

async function until(fn, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await sleep(50);
  }
  console.log(`  ⏱  timed out waiting for: ${label}`);
  return false;
}

async function createRoom(hostName, n) {
  const host = await api("/api/rooms", { name: hostName, avatar: AVATAR });
  const players = [new Player(hostName, host.data)];
  for (let i = 1; i < n; i++) {
    const r = await api(`/api/rooms/${host.data.code}/join`, { name: `لاعب${i}`, avatar: AVATAR });
    players.push(new Player(`لاعب${i}`, r.data));
  }
  await Promise.all(players.map((p) => p.connect()));
  return { code: host.data.code, players, hostRes: host };
}

/** Rate every meme that isn't mine. */
function rateAll(p, stars = 3) {
  for (const s of p.state.submissions) {
    if (s.id !== p.state.you.mySubmissionId && !p.state.you.myRatings[s.id]) p.send({ type: "rate", submissionId: s.id, stars });
  }
}

async function playRound(players, { captions = true } = {}) {
  const [host] = players;
  await until(() => players.every((p) => p.state?.phase === "CAPTION"), "CAPTION");
  if (captions) players.forEach((p, i) => p.send({ type: "submitMeme", design: meme(`${p.name}: لما الدكتور يقول ده سهل 😂 #${i}`) }));
  await until(() => players.every((p) => p.state?.phase === "REVEAL"), "REVEAL");
  await until(() => players.every((p) => p.state?.phase === "VOTING"), "VOTING", 10000);
  for (const p of players) rateAll(p, 4);
  await until(() => players.every((p) => p.state?.phase === "ROUND_RESULTS"), "ROUND_RESULTS");
  host.send({ type: "skip" });
}

async function main() {
  console.log(`Server: ${SERVER}\n`);

  console.log("1) Room codes & joining");
  const bad = await api("/api/rooms/12ab/join", { name: "x" });
  check("invalid room code rejected", bad.data.error === "INVALID_CODE");
  const missing = await api("/api/rooms/000001/join", { name: "x" });
  check("unknown room → ROOM_NOT_FOUND", missing.data.error === "ROOM_NOT_FOUND" && missing.status === 404);

  const big = await createRoom("سيف", 10);
  check("room code is exactly 6 digits", /^\d{6}$/.test(big.code), big.code);
  check("10 players connected", big.players[0].state.players.length === 10);
  check("host is the creator", big.players[0].state.you.isHost && !big.players[1].state.you.isHost);
  const eleventh = await api(`/api/rooms/${big.code}/join`, { name: "الحادي عشر" });
  check("11th player → ROOM_FULL", eleventh.data.error === "ROOM_FULL" && eleventh.status === 409);
  const dup = await api(`/api/rooms/${big.code}/join`, { name: "سيف" });
  check("duplicate name rejected", dup.data.error === "NAME_TAKEN" || dup.data.error === "ROOM_FULL");

  const intruder = new Player("x", { code: big.code, token: "not-a-real-token" });
  await intruder.connect();
  await until(() => intruder.closeCode, "intruder close");
  check("WebSocket with a fake token is refused", intruder.closed === "INVALID_TOKEN" && intruder.closeCode === 4001);
  big.players.forEach((p) => p.close());

  console.log("\n2) Three-player game, full flow");
  const g = await createRoom("عمر", 3);
  const [host, p1, p2] = g.players;
  const late = await api(`/api/rooms/${g.code}/join`, { name: "قبل البداية" });
  check("player can join before the game starts", late.status === 200);
  const lateP = new Player("قبل البداية", late.data);
  await lateP.connect();
  const all = [host, p1, p2, lateP];

  p1.send({ type: "start" });
  await until(() => p1.errors.includes("NOT_HOST"), "NOT_HOST");
  check("non-host cannot start", p1.errors.includes("NOT_HOST"));

  host.send({ type: "start" });
  await until(() => all.every((p) => p.state.phase === "COUNTDOWN"), "COUNTDOWN");
  check("host start moves everyone to the game", all.every((p) => p.state.phase === "COUNTDOWN"));
  const afterStart = await api(`/api/rooms/${g.code}/join`, { name: "متأخر" });
  check("join after start → GAME_STARTED", afterStart.data.error === "GAME_STARTED");

  await until(() => all.every((p) => p.state.phase === "CAPTION"), "CAPTION");
  check("caption phase has a meme template", Boolean(host.state.template?.image));
  const msgsBefore = p1.log.length;
  host.send({ type: "submitMeme", design: meme("سر_الكابشن_السري 🤫") });
  await until(() => p1.state.players.find((p) => p.id === host.id)?.hasSubmitted, "submitted flag");
  check("others see THAT host submitted", true);
  check("…but never the caption text", !p1.log.slice(msgsBefore).some((m) => m.includes("سر_الكابشن_السري")));
  host.send({ type: "submitMeme", design: meme("تاني") });
  await until(() => host.errors.includes("ALREADY_SUBMITTED"), "dup");
  check("duplicate submission prevented", host.errors.includes("ALREADY_SUBMITTED"));

  p1.send({ type: "submitMeme", design: { boxes: [{ text: "   " }], strokes: [] } });
  await until(() => p1.errors.includes("EMPTY_CAPTION"), "empty");
  check("empty meme is rejected", p1.errors.includes("EMPTY_CAPTION"));
  p1.send({ type: "requestHint" });
  await until(() => p1.errors.includes("HINT_UNAVAILABLE"), "hint");
  check("AI hint safely unavailable for built-in templates (no charge)", p1.errors.includes("HINT_UNAVAILABLE") && p1.state.players.find((p) => p.id === p1.id).score === 0);
  for (const p of [p1, p2, lateP]) p.send({ type: "submitMeme", design: meme(`كابشن ${p.name} 😂 English mix ١٢٣`) });
  await until(() => all.every((p) => p.state.phase === "REVEAL"), "REVEAL");
  check("all submitted → reveal early", all.every((p) => p.state.phase === "REVEAL"));
  check("reveal is anonymous", !JSON.stringify(p1.state.submissions).includes(host.id));

  await until(() => all.every((p) => p.state.phase === "VOTING"), "VOTING", 10000);
  host.send({ type: "rate", submissionId: host.state.you.mySubmissionId, stars: 5 });
  await until(() => host.errors.includes("CANNOT_VOTE_SELF"), "self vote");
  check("cannot rate own meme", host.errors.includes("CANNOT_VOTE_SELF"));
  const firstOther = (p) => p.state.submissions.find((s) => s.id !== p.state.you.mySubmissionId).id;
  host.send({ type: "rate", submissionId: firstOther(host), stars: 5, comment: "جامد 😂" });
  await sleep(200);
  host.send({ type: "rate", submissionId: firstOther(host), stars: 1 });
  await until(() => host.errors.includes("ALREADY_VOTED"), "dup vote");
  check("rating the same meme twice is prevented", host.errors.includes("ALREADY_VOTED"));
  host.send({ type: "rate", submissionId: firstOther(host), stars: 9 });
  await sleep(150);

  // Player disconnects during voting → round still finishes.
  lateP.close();
  await until(() => host.state.players.find((p) => p.id === lateP.id)?.connected === false, "disconnect seen");
  check("disconnect is visible to others", host.state.players.find((p) => p.id === lateP.id)?.connected === false);
  // host: 😡 on the next meme, stars on the rest
  const hostOthers = host.state.submissions.filter((s) => s.id !== host.state.you.mySubmissionId && !host.state.you.myRatings[s.id]);
  host.send({ type: "rate", submissionId: hostOthers[0].id, angry: true, comment: "مش ظريف" });
  for (const s of hostOthers.slice(1)) host.send({ type: "rate", submissionId: s.id, stars: 2 });
  await sleep(200);
  rateAll(p1, 3);
  rateAll(p2, 3);
  await until(() => host.state.phase === "ROUND_RESULTS", "results");
  check("round results after everyone rated", host.state.phase === "ROUND_RESULTS");
  const entries = host.state.lastRound.entries;
  const angryTotal = entries.reduce((a, e) => a + e.angry, 0);
  const commentFound = entries.some((e) => e.comments.some((c) => c.text === "جامد 😂"));
  check("😡 recorded and comments shown with names", angryTotal === 1 && commentFound);
  const pointsSum = entries.reduce((a, e) => a + e.points, 0);
  const starsSum = entries.reduce((a, e) => a + e.stars, 0);
  check("points = stars − 2 per 😡", pointsSum === starsSum - 2, `${pointsSum} vs ${starsSum}`);
  check("avatars travel with players", JSON.stringify(host.state.players[0].avatar) === JSON.stringify(AVATAR));

  // Refresh: reconnect with the same token keeps the seat and score.
  const scoreBefore = host.state.players.find((p) => p.id === lateP.id).score;
  await lateP.connect();
  check("refresh/reconnect keeps seat and score", lateP.state.players.find((p) => p.id === lateP.id).score === scoreBefore && lateP.state.players.find((p) => p.id === lateP.id).connected);

  host.send({ type: "skip" });
  await until(() => all.every((p) => p.state.round === 2 && p.state.phase === "COUNTDOWN"), "round 2");
  check("round transition to round 2", host.state.round === 2);
  await playRound(all);
  await until(() => all.every((p) => p.state.round === 3), "round 3");
  await playRound(all);
  await until(() => all.every((p) => p.state.phase === "FINAL_RESULTS"), "final");
  check("final results after 3 rounds", host.state.phase === "FINAL_RESULTS");
  check("highlights collected", host.state.highlights.length >= 1);

  host.send({ type: "playAgain" });
  await until(() => all.every((p) => p.state.phase === "COUNTDOWN" && p.state.round === 1), "restart");
  check("play again restarts with same players, scores reset", host.state.players.every((p) => p.score === 0) && host.state.players.length === 4);
  all.forEach((p) => p.close());

  console.log("\n3) Host disconnect → host migration");
  const h = await createRoom("هوست", 3);
  h.players[0].close();
  await until(() => h.players[1].state.hostId === h.players[1].id, "host migration", 25000);
  check("host rights move to the next player (~15s)", h.players[1].state.you.isHost);
  h.players.slice(1).forEach((p) => p.close());

  console.log("\n4) Caption timer expiry (30s, 2 players)");
  const t = await createRoom("تايمر", 2);
  t.players[0].send({ type: "updateSettings", settings: { captionSeconds: 30, rounds: 3 } });
  await until(() => t.players[1].state.settings.captionSeconds === 30, "settings");
  check("host settings sync to everyone", t.players[1].state.settings.captionSeconds === 30);
  t.players[0].send({ type: "start" });
  await until(() => t.players[0].state.phase === "CAPTION", "caption");
  t.players[0].send({ type: "submitMeme", design: meme("أنا بس اللي كتبت") });
  const endsAt = t.players[0].state.phaseEndsAt;
  await until(() => t.players.every((p) => p.state.phase === "REVEAL"), "timer expiry", 40000);
  check("timer expiry closes captions (server-side)", t.players[1].state.phase === "REVEAL" && Date.now() >= endsAt - 1500);
  t.players[1].send({ type: "submitMeme", design: meme("متأخر") });
  await until(() => t.players[1].errors.includes("WRONG_PHASE"), "late");
  check("late submission rejected", t.players[1].errors.includes("WRONG_PHASE"));
  t.players.forEach((p) => p.close());

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
