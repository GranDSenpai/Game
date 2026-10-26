// Fogline Tactics — online server.
// Serves the game page and runs every match. Each player is sent only what
// their own base and units can see. A room can also hold an AI opponent (from ./bots.js),
// which the server plays through the same fog-of-war view a person would get.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const G = require("./public/game.js");

const PORT = process.env.PORT || 3000;
const SERVER_VERSION = "2026-10-26b (AI opponents + GitHub log saving)";
const STARTED_AT = new Date().toISOString();
let lastSave = null;   // result of the most recent GitHub save, shown at /api/status
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };

/* ---------- AI opponents (optional: the site works without bots.js) ---------- */
const AI_STEP_MS = 120;          // pause between an AI's moves so the player can follow its visible actions
const AI_MAX_CMDS = 400;         // safety limits per AI turn, as in the lab runner
const AI_MAX_ERRORS = 25;
let BOTS = null;
try { BOTS = require("./bots.js"); console.log(`AI opponents loaded: ${BOTS.CHOICES.map(c => c.label).join(", ")}`); }
catch (e) { console.error("bots.js not loaded (Play vs AI is off):", e.message); }
function botList() { return BOTS ? BOTS.CHOICES.map(c => ({ id: c.id, label: c.label, description: c.description || "" })) : []; }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    return res.end(JSON.stringify({ server: SERVER_VERSION, rules: G.CONFIG.rules, startedAt: STARTED_AT, bots: botList().map(b => b.label),
      logSaving: LOG_REPO && GITHUB_TOKEN ? `on: github.com/${LOG_REPO}` : `off (${!LOG_REPO ? "LOG_REPO" : ""}${!LOG_REPO && !GITHUB_TOKEN ? " and " : ""}${!GITHUB_TOKEN ? "GITHUB_TOKEN" : ""} not set)`,
      lastSave }, null, 2));
  }
  if (url.pathname === "/api/bots") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    return res.end(JSON.stringify({ bots: botList() }));
  }
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

/* rooms: code -> { state, seats: {1: {token, ws} | {ai: true}, 2: ...}, ai: {seat, bot, revealed, busy} | null, touched } */
const rooms = new Map();
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
function newCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(""); } while (rooms.has(code));
  return code;
}
const token = () => crypto.randomBytes(16).toString("hex");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room) {
  for (const seat of [1, 2]) {
    const s = room.seats[seat];
    if (!s || s.ai || !s.ws) continue;
    const other = room.seats[3 - seat];
    const ai = room.ai ? { label: room.ai.revealed || room.state.winner ? room.ai.bot.label : null, thinking: room.ai.busy } : null;
    send(s.ws, {
      type: "state", room: room.code, view: G.viewFor(room.state, seat),
      opponent: other ? (other.ai ? "ai" : other.ws ? "online" : "offline") : "waiting", ai,
    });
  }
}

const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    try { handle(ws, raw); }
    catch (e) { console.error("Error handling a message:", e); send(ws, { type: "error", msg: "Something went wrong with that move. Try again." }); }
  });
  ws.on("close", () => {
    const room = ws.room;
    if (room && room.seats[ws.seat] && room.seats[ws.seat].ws === ws) { room.seats[ws.seat].ws = null; broadcast(room); }
  });
});

function handle(ws, raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "create") {
      const code = newCode(), t = token();
      const room = { code, state: G.newGame(), seats: {}, ai: null, touched: Date.now() };
      let seat = 1;
      if (msg.ai) {
        if (!BOTS) return send(ws, { type: "error", fatal: true, msg: "AI opponents aren't available on this server." });
        const want = msg.seat === 1 || msg.seat === 2 ? msg.seat : (crypto.randomInt(2) + 1);
        seat = want;
        const bot = BOTS.create(msg.ai, 3 - seat);
        room.ai = { seat: 3 - seat, choice: msg.ai, bot, revealed: msg.ai !== "random", busy: false };
        room.seats[3 - seat] = { ai: true };
      }
      room.seats[seat] = { token: t, ws };
      rooms.set(code, room);
      ws.room = room; ws.seat = seat;
      send(ws, { type: "joined", room: code, seat, token: t });
      if (room.ai) aiPlace(room);
      return broadcast(room);
    }
    if (msg.type === "join") {
      const room = rooms.get(String(msg.room || "").toUpperCase());
      if (!room) return send(ws, { type: "error", fatal: true, msg: "That game doesn't exist any more. Start a new one." });
      let seat = [1, 2].find(s => room.seats[s] && !room.seats[s].ai && room.seats[s].token === msg.token);
      if (!seat && room.ai) return send(ws, { type: "error", fatal: true, msg: "That game is someone's match against the AI." });
      if (!seat && !room.seats[2]) { seat = 2; room.seats[2] = { token: token() }; }
      if (!seat) return send(ws, { type: "error", fatal: true, msg: "This game already has two players." });
      const old = room.seats[seat].ws;
      if (old && old !== ws) { send(old, { type: "error", fatal: true, msg: "You opened this game in another tab." }); old.close(); }
      room.seats[seat].ws = ws; ws.room = room; ws.seat = seat; room.touched = Date.now();
      send(ws, { type: "joined", room: room.code, seat, token: room.seats[seat].token });
      return broadcast(room);
    }
    const room = ws.room;
    if (!room) return;
    room.touched = Date.now();
    if (msg.type === "rematch") {
      if (!room.state.winner || (room.ai && room.ai.busy)) return;
      room.state = G.newGame(); room.logged = false;
      if (room.ai) { room.ai.bot = BOTS.create(room.ai.choice, room.ai.seat); aiPlace(room); }
      return broadcast(room);
    }
    if (room.ai && room.ai.busy) return send(ws, { type: "error", msg: "The AI is still taking its turn." });
    const err = G.apply(room.state, ws.seat, msg);
    if (err) send(ws, { type: "error", msg: err });
    if (room.state.winner && !room.logged) { room.logged = true; saveLog(room); }
    broadcast(room);
    if (room.ai && !room.state.winner && room.state.phase === "play" && room.state.current === room.ai.seat) runAiTurn(room);
}

/* ---------- playing the AI seat ---------- */
// Bots get a deep copy of their own fog-of-war view and nothing else (same as the lab runner).
function cloneView(v) {
  const out = Object.assign({}, v);
  out.pieces = v.pieces.map(p => Object.assign({}, p));
  out.feed = v.feed.map(f => Object.assign({}, f));
  out.pings = v.pings.map(x => (typeof x === "object" && x ? Object.assign({}, x) : x));
  out.seenBase = v.seenBase ? Object.assign({}, v.seenBase) : null;
  out.history = v.history ? JSON.parse(JSON.stringify(v.history)) : null;
  return out;
}
// Blind placement: the AI picks its square from an empty view before the person places.
function aiPlace(room) {
  const { seat, bot } = room.ai, S = room.state;
  let cmd = null;
  try { const c = bot.place(cloneView(G.viewFor(S, seat))); if (c && Number.isInteger(c.r) && Number.isInteger(c.c)) cmd = { type: "place", r: c.r, c: c.c }; }
  catch (e) { console.error(`AI ${bot.label} failed to place:`, e); }
  if (!cmd || G.apply(S, seat, cmd)) {
    // fall back to a legal square near the middle of the AI's back rows
    const [r0, r1] = G.placeRows(seat), rows = seat === 1 ? [r1, r0] : [r0, r1];
    outer: for (let r = rows[0]; seat === 1 ? r >= rows[1] : r <= rows[1]; r += seat === 1 ? -1 : 1)
      for (let d = 0; d < G.N; d++) { const c = d % 2 ? G.N / 2 - 1 - (d >> 1) : G.N / 2 + (d >> 1); if (c >= 0 && c < G.N && !G.apply(S, seat, { type: "place", r, c })) break outer; }
  }
  if (S.phase === "play" && S.current === seat) runAiTurn(room);
}
async function runAiTurn(room) {
  const ai = room.ai, S = room.state, seat = ai.seat;
  if (!ai || ai.busy || S.winner || S.current !== seat) return;
  ai.busy = true; broadcast(room);
  let cmds = 0, errs = 0;
  try {
    while (room.state === S && !S.winner && S.current === seat) {
      let cmd;
      try { cmd = ai.bot.act(cloneView(G.viewFor(S, seat))); }
      catch (e) { console.error(`AI ${ai.bot.label} error on turn ${S.turn}:`, e); cmd = { type: "end" }; }
      if (!cmd || typeof cmd !== "object" || typeof cmd.type !== "string" || cmd.type === "place") errs++;
      else {
        const err = G.apply(S, seat, cmd);
        if (err) errs++;
        else if (cmd.type !== "end") { broadcast(room); await sleep(AI_STEP_MS); }
      }
      if (!S.winner && S.current === seat && (++cmds >= AI_MAX_CMDS || errs >= AI_MAX_ERRORS)) G.apply(S, seat, { type: "end" });
    }
  } finally { ai.busy = false; }
  if (room.state !== S) return;
  if (S.winner && !room.logged) { room.logged = true; saveLog(room); }
  broadcast(room);
}

// Save every finished game to the logs folder (and print it to the server log, which Render keeps for a while).
// Note: Render's free plan wipes this folder whenever the server restarts or sleeps.
function saveLog(room) {
  try {
    const dir = path.join(__dirname, "logs");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = path.join(dir, `${stamp}-${room.code}`);
    const meta = { room: room.code, rules: room.state.rules || G.CONFIG.rules, startedAt: room.state.startedAt, winner: room.state.winner, turns: room.state.turn };
    if (room.ai) meta.ai = { seat: room.ai.seat, id: room.ai.bot.id, label: room.ai.bot.label, bot: room.ai.bot.bot, params: room.ai.bot.params, seed: room.ai.bot.seed };
    fs.writeFileSync(base + ".json", JSON.stringify({ ...meta, config: G.CONFIG, units: G.UNITS, moves: room.state.history }, null, 2));
    const text = G.formatLog(room.state.history, meta);
    fs.writeFileSync(base + ".txt", text);
    console.log(`Game ${room.code} finished: Player ${room.state.winner} won on turn ${room.state.turn}${room.ai ? ` (AI ${room.ai.bot.label} was Player ${room.ai.seat})` : ""}. Log saved to ${base}.txt\n` + text);
    const day = stamp.slice(0, 10), name = `${stamp}-${room.code}${room.ai ? "-vs-" + room.ai.bot.id : ""}`;
    pushToGitHub(`games/${day}/${name}.json`, fs.readFileSync(base + ".json", "utf8"), `Game ${room.code}: P${room.state.winner} won on turn ${room.state.turn}`);
    pushToGitHub(`games/${day}/${name}.txt`, text, `Game ${room.code} (readable log)`);
  } catch (e) { console.error("Couldn't save game log:", e); }
}

/* Permanent copies: if LOG_REPO ("owner/repo") and GITHUB_TOKEN are set, every finished game is also
   committed to that (separate, private) repository. Never point this at the game's own repo: a commit
   there would make Render redeploy and drop every game in progress. */
const LOG_REPO = process.env.LOG_REPO, GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (LOG_REPO && GITHUB_TOKEN) console.log(`Finished games will be saved to github.com/${LOG_REPO}`);
else console.log("LOG_REPO / GITHUB_TOKEN not set: game logs are only kept until the server restarts.");
async function pushToGitHub(file, content, message, attempt = 1) {
  if (!LOG_REPO || !GITHUB_TOKEN) { lastSave = { file, at: new Date().toISOString(), result: "skipped: LOG_REPO / GITHUB_TOKEN not set" }; return console.log(`Not saved to GitHub (LOG_REPO / GITHUB_TOKEN not set): ${file}`); }
  try {
    const res = await fetch(`${process.env.GITHUB_API || "https://api.github.com"}/repos/${LOG_REPO}/contents/${file}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "fogline-server", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64") }),
    });
    if (res.ok) { lastSave = { file, at: new Date().toISOString(), result: "saved" }; return console.log(`Saved ${file} to ${LOG_REPO}`); }
    const body = await res.text();
    if (attempt < 3 && (res.status === 409 || res.status >= 500)) { await sleep(2000 * attempt); return pushToGitHub(file, content, message, attempt + 1); }
    lastSave = { file, at: new Date().toISOString(), result: `failed: GitHub said ${res.status} ${body.slice(0, 160)}` };
    console.error(`GitHub save failed for ${file}: ${res.status} ${body.slice(0, 200)}`);
  } catch (e) {
    if (attempt < 3) { await sleep(2000 * attempt); return pushToGitHub(file, content, message, attempt + 1); }
    lastSave = { file, at: new Date().toISOString(), result: `failed: ${e.message}` };
    console.error(`GitHub save failed for ${file}:`, e.message);
  }
}

// last line of defence: log unexpected errors instead of shutting the server down
process.on("uncaughtException", e => console.error("Unexpected error:", e));
process.on("unhandledRejection", e => console.error("Unexpected error (async):", e));

// keep connections healthy and forget games idle for 6 hours
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
  const cutoff = Date.now() - 6 * 3600 * 1000;
  for (const [code, room] of rooms) if (room.touched < cutoff) rooms.delete(code);
}, 30000);

server.listen(PORT, () => console.log(`Fogline Tactics server ${SERVER_VERSION} running on port ${PORT}`));
