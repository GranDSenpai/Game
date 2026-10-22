/* Fogline Tactics — shared game rules.
   The server runs these to decide what really happens; the browser uses the
   same functions to highlight moves. Edit CONFIG and UNITS to rebalance. */
(function (root) {

/* =====================================================================
   BALANCE KNOBS
   ===================================================================== */
const CONFIG = {
  boardSize: 20,          // board is boardSize x boardSize
  startGold: 2,           // gold before your first turn's income
  secondPlayerBonus: 1,   // extra starting gold for player 2
  baseIncome: 2,              // gold every turn
  interestSteps: [4, 8, 12],  // +1 income for each threshold you hold at turn start
  baseHp: 25,
  baseVision: 4,          // squares the base reveals (any direction)
  unitVision: 3,          // default squares a unit reveals
  spawnRadius: 2,         // how far from your base you can place recruits
  spawnsPerTurn: 0,       // recruits per turn (0 = no limit)
  maxUnits: 20,           // units on the board at once
};

/* Move types:   step (walks around obstacles), rook, bishop, queen (slide in lines, blocked),
                 knight (L-jump over anything), fly (lands anywhere within range).
   Attack types: melee (one adjacent), cleave (all adjacent enemies), ranged (any within range),
                 line (first piece along rook/bishop/queen lines), knight (L squares),
                 blast (3x3 area centred on an enemy within range).
   heal: optional, used instead of attacking. siege: damage multiplier vs bases. */
const UNITS = {
  footman:   { name: "Footman",   abbr: "Ft", cost: 1, hp: 4,  atk: 1, move: { type: "step", range: 2 }, attack: { type: "melee" } },
  slinger:   { name: "Slinger",   abbr: "Sl", cost: 1, hp: 3,  atk: 1, move: { type: "step", range: 1 }, attack: { type: "ranged", range: 2 } },
  scout:     { name: "Scout",     abbr: "Sc", cost: 1, hp: 3,  atk: 1, move: { type: "rook", range: 3 }, attack: { type: "melee" }, vision: 5 },
  spearman:  { name: "Spearman",  abbr: "Sp", cost: 2, hp: 6,  atk: 2, move: { type: "step", range: 1 }, attack: { type: "line", dirs: "rook", range: 2 } },
  rider:     { name: "Rider",     abbr: "Rd", cost: 2, hp: 5,  atk: 2, move: { type: "knight" },         attack: { type: "melee" } },
  acolyte:   { name: "Acolyte",   abbr: "Ac", cost: 2, hp: 4,  atk: 1, move: { type: "step", range: 2 }, attack: { type: "melee" }, heal: { amount: 2, range: 2 } },
  berserker: { name: "Berserker", abbr: "Bz", cost: 3, hp: 8,  atk: 2, move: { type: "step", range: 2 }, attack: { type: "cleave" } },
  ballista:  { name: "Ballista",  abbr: "Bl", cost: 3, hp: 5,  atk: 3, move: { type: "step", range: 1 }, attack: { type: "line", dirs: "rook", range: 6 }, siege: 2 },
  hexer:     { name: "Hexer",     abbr: "Hx", cost: 3, hp: 5,  atk: 3, move: { type: "bishop", range: 3 }, attack: { type: "line", dirs: "bishop", range: 4 } },
  warden:    { name: "Warden",    abbr: "Wd", cost: 4, hp: 15, atk: 2, move: { type: "step", range: 2 }, attack: { type: "cleave" } },
  pyromancer:{ name: "Pyromancer",abbr: "Py", cost: 4, hp: 6,  atk: 3, move: { type: "step", range: 1 }, attack: { type: "blast", range: 3 } },
  assassin:  { name: "Assassin",  abbr: "As", cost: 4, hp: 6,  atk: 5, move: { type: "queen", range: 4 }, attack: { type: "knight" }, vision: 4 },
  titan:     { name: "Titan",     abbr: "Ti", cost: 5, hp: 22, atk: 4, move: { type: "step", range: 2 }, attack: { type: "cleave" }, siege: 2 },
  dragon:    { name: "Dragon",    abbr: "Dr", cost: 5, hp: 14, atk: 4, move: { type: "fly", range: 4 },  attack: { type: "line", dirs: "queen", range: 3 }, vision: 5 },
  archmage:  { name: "Archmage",  abbr: "Am", cost: 5, hp: 8,  atk: 4, move: { type: "step", range: 1 }, attack: { type: "blast", range: 5 }, heal: { amount: 3, range: 3 } },
};
const TIER = { 1: ["Common", "#9ea7a3"], 2: ["Uncommon", "#5fb46a"], 3: ["Rare", "#4f8fd9"], 4: ["Epic", "#a96ddc"], 5: ["Legendary", "#e3b23c"] };

/* ===================================================================== */
const N = CONFIG.boardSize;
const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK = [[1,0],[-1,0],[0,1],[0,-1]];
const BISHOP = [[1,1],[1,-1],[-1,1],[-1,-1]];
const DIRS = { rook: ROOK, bishop: BISHOP, queen: ROOK.concat(BISHOP) };
const KNIGHT = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
const key = (r, c) => r * N + c;
const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));

function newGame() {
  return {
    phase: "place", current: 1, turn: 0, pieces: [], nextId: 1,
    gold: { 1: CONFIG.startGold, 2: CONFIG.startGold + CONFIG.secondPlayerBonus },
    spawnsLeft: 0, seenBase: { 1: null, 2: null }, pings: { 1: [], 2: [] },
    news: { 1: [], 2: [] }, report: { 1: [], 2: [] }, log: { 1: [], 2: [] }, winner: null,
  };
}

/* ---------- queries (work on full state or on a player's view) ---------- */
const pieceAt = (S, r, c) => S.pieces.find(p => p.r === r && p.c === c);
const byId = (S, id) => S.pieces.find(p => p.id === id);
const visionOf = p => p.kind === "base" ? CONFIG.baseVision : (UNITS[p.type].vision ?? CONFIG.unitVision);
function visibleSet(S, pl) {
  const s = new Set();
  for (const p of S.pieces) if (p.owner === pl) {
    const v = visionOf(p);
    for (let r = p.r - v; r <= p.r + v; r++) for (let c = p.c - v; c <= p.c + v; c++) if (inB(r, c)) s.add(key(r, c));
  }
  return s;
}
const unitCount = (S, pl) => S.pieces.filter(p => p.owner === pl && p.kind === "unit").length;
const baseOf = (S, pl) => S.pieces.find(p => p.owner === pl && p.kind === "base");
const incomeFor = (gold) => CONFIG.baseIncome + CONFIG.interestSteps.filter(t => gold >= t).length;
const defOf = p => p.kind === "base" ? { name: "Base", atk: 0 } : UNITS[p.type];
const placeZone = (pl, r) => pl === 1 ? r >= N / 2 : r < N / 2;

function knownBlocked(S, r, c, pl, vis) {
  const q = pieceAt(S, r, c);
  return !!q && (q.owner === pl || vis.has(key(r, c)));
}

function computeMoves(S, p, vis) {
  const out = new Map();
  if (p.kind !== "unit" || p.moved || p.fresh) return out;
  const m = UNITS[p.type].move;
  if (m.type === "step") {
    const seen = new Set([key(p.r, p.c)]);
    let frontier = [{ r: p.r, c: p.c, path: [] }];
    for (let d = 0; d < m.range; d++) {
      const next = [];
      for (const f of frontier) for (const [dr, dc] of KING) {
        const r = f.r + dr, c = f.c + dc, k = key(r, c);
        if (!inB(r, c) || seen.has(k) || knownBlocked(S, r, c, p.owner, vis)) continue;
        seen.add(k);
        const path = f.path.concat([[r, c]]);
        out.set(k, path); next.push({ r, c, path });
      }
      frontier = next;
    }
  } else if (DIRS[m.type]) {
    for (const [dr, dc] of DIRS[m.type]) {
      const path = [];
      for (let i = 1; i <= m.range; i++) {
        const r = p.r + dr * i, c = p.c + dc * i;
        if (!inB(r, c) || knownBlocked(S, r, c, p.owner, vis)) break;
        path.push([r, c]); out.set(key(r, c), path.slice());
      }
    }
  } else if (m.type === "knight") {
    for (const [dr, dc] of KNIGHT) {
      const r = p.r + dr, c = p.c + dc;
      if (inB(r, c) && !knownBlocked(S, r, c, p.owner, vis)) out.set(key(r, c), [[r, c]]);
    }
  } else if (m.type === "fly") {
    for (let r = p.r - m.range; r <= p.r + m.range; r++) for (let c = p.c - m.range; c <= p.c + m.range; c++)
      if (inB(r, c) && !(r === p.r && c === p.c) && !knownBlocked(S, r, c, p.owner, vis)) out.set(key(r, c), [[r, c]]);
  }
  return out;
}

function computeActions(S, p, vis) {
  const out = new Map();
  if (p.kind !== "unit" || p.acted || p.fresh) return out;
  const d = UNITS[p.type], a = d.attack;
  const enemy = (r, c) => { const q = pieceAt(S, r, c); return q && q.owner !== p.owner && vis.has(key(r, c)); };
  const add = (r, c, kind) => out.set(key(r, c), { kind, r, c });
  if (a.type === "melee" || a.type === "cleave") {
    for (const [dr, dc] of KING) { const r = p.r + dr, c = p.c + dc; if (inB(r, c) && enemy(r, c)) add(r, c, "attack"); }
  } else if (a.type === "ranged" || a.type === "blast") {
    for (let r = p.r - a.range; r <= p.r + a.range; r++) for (let c = p.c - a.range; c <= p.c + a.range; c++)
      if (inB(r, c) && enemy(r, c)) add(r, c, "attack");
  } else if (a.type === "knight") {
    for (const [dr, dc] of KNIGHT) { const r = p.r + dr, c = p.c + dc; if (inB(r, c) && enemy(r, c)) add(r, c, "attack"); }
  } else if (a.type === "line") {
    for (const [dr, dc] of DIRS[a.dirs]) for (let i = 1; i <= a.range; i++) {
      const r = p.r + dr * i, c = p.c + dc * i;
      if (!inB(r, c)) break;
      if (knownBlocked(S, r, c, p.owner, vis)) { if (enemy(r, c)) add(r, c, "attack"); break; }
    }
  }
  if (d.heal) {
    for (const q of S.pieces) if (q.owner === p.owner && q.kind === "unit" && q !== p && q.hp < q.maxHp && cheb(p.r, p.c, q.r, q.c) <= d.heal.range)
      if (!out.has(key(q.r, q.c))) add(q.r, q.c, "heal");
  }
  return out;
}

function spawnTiles(S, pl) {
  const b = baseOf(S, pl), s = new Set();
  if (!b) return s;
  const R = CONFIG.spawnRadius;
  for (let r = b.r - R; r <= b.r + R; r++) for (let c = b.c - R; c <= b.c + R; c++)
    if (inB(r, c) && !pieceAt(S, r, c)) s.add(key(r, c));
  return s;
}

/* ---------- state changes (server only) ---------- */
function updateSeen(S) {
  for (const pl of [1, 2]) {
    const eb = baseOf(S, 3 - pl);
    if (eb && visibleSet(S, pl).has(key(eb.r, eb.c))) S.seenBase[pl] = { r: eb.r, c: eb.c };
  }
}

function startTurn(S, pl) {
  S.current = pl;
  if (pl === 1) S.turn++;
  const inc = incomeFor(S.gold[pl]);
  S.gold[pl] += inc;
  for (const p of S.pieces) if (p.owner === pl) { p.moved = false; p.acted = false; p.fresh = false; }
  S.spawnsLeft = CONFIG.spawnsPerTurn;
  S.log[pl] = [`Turn ${S.turn}: collected ${inc} gold.`];
  S.report[pl] = S.news[pl];
  S.news[pl] = [];
}

function damage(S, target, amt, attacker) {
  const victim = target.owner, an = UNITS[attacker.type].name, tn = defOf(target).name;
  target.hp -= amt;
  if (!visibleSet(S, victim).has(key(attacker.r, attacker.c))) S.pings[victim].push({ r: attacker.r, c: attacker.c });
  if (target.hp <= 0) {
    S.pieces = S.pieces.filter(q => q !== target);
    S.log[attacker.owner].push(`Your ${an} destroyed an enemy ${tn}.`);
    S.news[victim].push(`Your ${tn} was destroyed by an enemy ${an}.`);
    if (target.kind === "base") S.winner = attacker.owner;
  } else {
    S.log[attacker.owner].push(`Your ${an} hit an enemy ${tn} for ${amt}.`);
    S.news[victim].push(`Your ${tn} took ${amt} damage from an enemy ${an} (${target.hp} HP left).`);
  }
}

/* Apply one player command. Returns an error string, or null on success. */
function apply(S, pl, cmd) {
  if (S.winner) return "The game is over.";
  if (cmd.type === "place") {
    if (S.phase !== "place") return "Bases are already placed.";
    if (baseOf(S, pl)) return "You already placed your base.";
    const { r, c } = cmd;
    if (!Number.isInteger(r) || !Number.isInteger(c) || !inB(r, c) || !placeZone(pl, r) || pieceAt(S, r, c)) return "Place your base in your own half.";
    S.pieces.push({ id: S.nextId++, owner: pl, kind: "base", type: "base", r, c, hp: CONFIG.baseHp, maxHp: CONFIG.baseHp });
    if (baseOf(S, 1) && baseOf(S, 2)) { S.phase = "play"; startTurn(S, 1); }
    return null;
  }
  if (S.phase !== "play") return "Waiting for both bases.";
  if (S.current !== pl) return "It's not your turn.";
  const vis = visibleSet(S, pl);

  if (cmd.type === "end") {
    S.pings[pl] = [];
    startTurn(S, 3 - pl);
    return null;
  }
  if (cmd.type === "recruit") {
    const d = UNITS[cmd.unit];
    if (!d) return "Unknown unit.";
    if (S.gold[pl] < d.cost) return "Not enough gold.";
    if (CONFIG.spawnsPerTurn && S.spawnsLeft <= 0) return "No recruits left this turn.";
    if (unitCount(S, pl) >= CONFIG.maxUnits) return "Unit limit reached.";
    if (!spawnTiles(S, pl).has(key(cmd.r, cmd.c))) return "Recruit next to your base on an empty square.";
    S.gold[pl] -= d.cost; S.spawnsLeft--;
    S.pieces.push({ id: S.nextId++, owner: pl, kind: "unit", type: cmd.unit, r: cmd.r, c: cmd.c, hp: d.hp, maxHp: d.hp, moved: true, acted: true, fresh: true });
    S.log[pl].push(`Recruited a ${d.name} for ${d.cost} gold.`);
    updateSeen(S);
    return null;
  }
  const p = byId(S, cmd.id);
  if (!p || p.owner !== pl || p.kind !== "unit") return "That isn't your unit.";
  const nm = UNITS[p.type].name;

  if (cmd.type === "move") {
    const path = computeMoves(S, p, vis).get(key(cmd.r, cmd.c));
    if (!path) return "That unit can't move there.";
    let last = null, blocker = null;
    for (const [r, c] of path) { const q = pieceAt(S, r, c); if (q) { blocker = q; break; } last = [r, c]; }
    if (last) { p.r = last[0]; p.c = last[1]; }
    p.moved = true;
    if (blocker) {
      S.log[pl].push(`Your ${nm} ran into a hidden enemy and stopped short.`);
      S.pings[pl].push({ r: blocker.r, c: blocker.c });
      S.news[blocker.owner].push(`An enemy ${nm} bumped into your ${defOf(blocker).name}.`);
      S.pings[blocker.owner].push({ r: p.r, c: p.c });
    } else S.log[pl].push(`Moved ${nm}.`);
    updateSeen(S);
    return null;
  }
  if (cmd.type === "act") {
    const act = computeActions(S, p, vis).get(key(cmd.r, cmd.c));
    if (!act) return "No valid target there.";
    const d = UNITS[p.type], a = d.attack;
    p.acted = true;
    if (act.kind === "heal") {
      const q = pieceAt(S, act.r, act.c), before = q.hp;
      q.hp = Math.min(q.maxHp, q.hp + d.heal.amount);
      S.log[pl].push(`${d.name} healed ${UNITS[q.type].name} for ${q.hp - before}.`);
      return null;
    }
    const targets = [];
    if (a.type === "cleave") {
      for (const [dr, dc] of KING) { const q = pieceAt(S, p.r + dr, p.c + dc); if (q && q.owner !== pl) targets.push(q); }
    } else if (a.type === "blast") {
      for (const [dr, dc] of KING.concat([[0, 0]])) { const q = pieceAt(S, act.r + dr, act.c + dc); if (q && q.owner !== pl) targets.push(q); }
    } else if (a.type === "line") {
      const dr = Math.sign(act.r - p.r), dc = Math.sign(act.c - p.c);
      for (let i = 1; i <= a.range; i++) { const q = pieceAt(S, p.r + dr * i, p.c + dc * i); if (q) { if (q.owner !== pl) targets.push(q); break; } }
    } else {
      const q = pieceAt(S, act.r, act.c); if (q) targets.push(q);
    }
    for (const t of targets) {
      if (S.winner) break;
      damage(S, t, d.atk * (t.kind === "base" ? (d.siege || 1) : 1), p);
    }
    updateSeen(S);
    return null;
  }
  return "Unknown command.";
}

/* What one player is allowed to know. Hidden enemies never leave the server. */
function viewFor(S, pl) {
  const reveal = !!S.winner;
  const vis = visibleSet(S, pl);
  const eb = baseOf(S, 3 - pl);
  return {
    you: pl, phase: S.phase, current: S.current, turn: S.turn, winner: S.winner,
    gold: S.gold[pl], spawnsLeft: S.current === pl ? S.spawnsLeft : 0,
    youPlaced: !!baseOf(S, pl),
    pieces: S.pieces.filter(p => reveal || p.owner === pl || vis.has(key(p.r, p.c))),
    seenBase: S.seenBase[pl] && eb ? S.seenBase[pl] : null,
    pings: S.pings[pl], log: S.log[pl], news: S.news[pl], report: S.report[pl],
    reveal,
  };
}

const api = { CONFIG, UNITS, TIER, N, key, inB, newGame, pieceAt, byId, visibleSet, unitCount, baseOf, incomeFor,
  placeZone, computeMoves, computeActions, spawnTiles, apply, viewFor };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Fogline = api;
})(typeof window !== "undefined" ? window : globalThis);
