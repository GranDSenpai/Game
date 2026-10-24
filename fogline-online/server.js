// Fogline Tactics — online server.
// Serves the game page and runs every match. Each player is sent only what
// their own base and units can see.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const G = require("./public/game.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

/* rooms: code -> { state, seats: {1: {token, ws}, 2: {token, ws}}, touched } */
const rooms = new Map();
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
function newCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(""); } while (rooms.has(code));
  return code;
}
const token = () => crypto.randomBytes(16).toString("hex");

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room) {
  for (const seat of [1, 2]) {
    const s = room.seats[seat];
    if (!s || !s.ws) continue;
    const other = room.seats[3 - seat];
    send(s.ws, {
      type: "state", room: room.code, view: G.viewFor(room.state, seat),
      opponent: other ? (other.ws ? "online" : "offline") : "waiting",
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
      const room = { code, state: G.newGame(), seats: { 1: { token: t, ws } }, touched: Date.now() };
      rooms.set(code, room);
      ws.room = room; ws.seat = 1;
      send(ws, { type: "joined", room: code, seat: 1, token: t });
      return broadcast(room);
    }
    if (msg.type === "join") {
      const room = rooms.get(String(msg.room || "").toUpperCase());
      if (!room) return send(ws, { type: "error", fatal: true, msg: "That game doesn't exist any more. Start a new one." });
      let seat = [1, 2].find(s => room.seats[s] && room.seats[s].token === msg.token);
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
      if (!room.state.winner) return;
      room.state = G.newGame();
      return broadcast(room);
    }
    const err = G.apply(room.state, ws.seat, msg);
    if (err) send(ws, { type: "error", msg: err });
    broadcast(room);
}

// last line of defence: log unexpected errors instead of shutting the server down
process.on("uncaughtException", e => console.error("Unexpected error:", e));

// keep connections healthy and forget games idle for 6 hours
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
  const cutoff = Date.now() - 6 * 3600 * 1000;
  for (const [code, room] of rooms) if (room.touched < cutoff) rooms.delete(code);
}, 30000);

server.listen(PORT, () => console.log(`Fogline Tactics running on http://localhost:${PORT}`));
