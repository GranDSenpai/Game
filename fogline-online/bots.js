/* Fogline Tactics — AI opponents (one file). Generated 2026-10-26 by build/build_bots.py from lab
   (pool: g3_agg_creep_t, g3_agg_battery_t, g2_eco_aegis_t).
   The server loads this with require("./bots.js"). Edit CHOICES to change what the lobby offers, or rebuild
   from a newer lab folder. Everything below CHOICES is the lab's own code, bundled unchanged except for
   the base-placement clamp noted in _common.js. */
"use strict";

const CHOICES = [
  {
    "id": "g3_agg_creep_t",
    "label": "Creep (Gen 3 champion)",
    "bot": "g3_agg_creep",
    "params": {
      "baseDepth": 8,
      "baseJitter": 2,
      "scouts": 1,
      "spotters": 0,
      "spotDist": 7,
      "columnSnipers": 10,
      "escorts": 0,
      "goTurn": 48,
      "leash": 5,
      "frontBand": 2,
      "escortMin": 9,
      "escortFire": 1.584,
      "engageMin": 9.917,
      "artyMin": 5,
      "rallyDist": 5,
      "keep": 16,
      "allInTurn": 33,
      "basePriority": 8.371,
      "killBonus": 1.097,
      "defendRadius": 3,
      "auraMin": 15,
      "visAvoid": 9.147,
      "threatW": 0,
      "coverW": 5.101,
      "searchDepth": 2.645
    },
    "description": "Back-row base; a Sniper column escorted by walking Archmages marches to 6 squares from the enemy base and grinds it down.",
    "note": "tuned (pool + peers), holdout +38.4 pts vs defaults"
  },
  {
    "id": "g3_agg_battery_t",
    "label": "Battery (Gen 3)",
    "bot": "g3_agg_battery",
    "params": {
      "baseDepth": 8,
      "baseJitter": 1,
      "scouts": 2,
      "spotters": 0,
      "spotDist": 7,
      "artyMin": 5,
      "artyMax": 6,
      "keep": 16,
      "allInTurn": 60,
      "basePriority": 4,
      "killBonus": 1.065,
      "defendRadius": 6,
      "auraMin": 3,
      "probe": true,
      "guessDepth": 3,
      "engageR": 8,
      "strikeAvoid": true,
      "visAvoid": 2,
      "threatW": 1.992,
      "coverW": 14,
      "searchDepth": 1.73
    },
    "description": "Midline base, Sniper battery 6 squares from the enemy base (self-spotting, unseen by on-arrival recruits), own Archmage umbrella.",
    "note": "tuned (pool + peers), holdout +14.7 pts vs defaults"
  },
  {
    "id": "g2_eco_aegis_t",
    "label": "Aegis (Gen 2)",
    "bot": "g2_eco_aegis",
    "params": {
      "baseDepth": 0,
      "baseJitter": 6,
      "bank": 33,
      "mages": 0,
      "screen": 6,
      "slingerShare": 0.419,
      "scouts": 2,
      "auraMin": 6.3,
      "defendRadius": 5,
      "guardRadius": 2,
      "pushMages": 2,
      "pushTurn": 8,
      "homeKeep": 39,
      "homeMages": 1,
      "escortDist": 2,
      "hunters": 10,
      "hunter": "assassin",
      "sniperPush": 2,
      "huntRadius": 10,
      "engageRadius": 8,
      "threatW": 2.199,
      "basePriority": 6.669,
      "chaseMin": 0,
      "depthBias": 0,
      "heatBias": 0.257
    },
    "description": "Bank = instant Archmage auras vs swarms; build a mage core, then walk it onto the enemy base.",
    "note": "tuned (pass 1 + co-evolution), holdout +8.2 pts vs defaults"
  }
];

/* ---- bundled lab modules ---- */
const NODE_REQUIRE = typeof require === "function" ? require : null;
const ENGINE_PATH = typeof __dirname !== "undefined" ? NODE_REQUIRE("path").join(__dirname, "public", "game.js") : "./public/game.js";
const LAB = (() => {
  const defs = {
"public/game.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
module.exports = typeof window !== "undefined" && window.Fogline ? window.Fogline : __nodeRequire__(__ENGINE__);
},
"lab/runner/rng.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
// Small deterministic RNG helpers shared by the runner, bots and tools.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mix several integers / strings into one 32-bit seed.
function mix(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// A friendlier wrapper: rng() -> [0,1), plus int / pick / shuffle / chance.
function makeRng(seed) {
  const f = mulberry32(seed);
  const rng = () => f();
  rng.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));        // inclusive
  rng.pick = arr => arr.length ? arr[Math.floor(f() * arr.length)] : undefined;
  rng.chance = p => f() < p;
  rng.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return rng;
}

module.exports = { mulberry32, mix, makeRng };

},
"lab/toolkit/index.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
/* Fogline bot toolkit.
   Everything here works on a bot's VIEW (G.viewFor output), never on the true state.
   Main pieces:
     board(view)                  -> per-call snapshot with lookups (see BOT_API.md)
     Memory                       -> fog memory: explored tiles, last-known enemies, danger spots, enemy-base deduction
     threatMap(b, mem)            -> how much damage known enemies could deal to each square next enemy turn
     distanceField(b, type, goals)-> turns-to-goal for a unit type, optionally threat-weighted (pathing)
     bestMove / bestAttack        -> legal command choosers
     Commander                    -> generic per-turn unit controller used by the baseline bots */
const G = require('../../public/game.js');
const { N, UNITS, CONFIG } = G;

const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS = { rook: ROOK, bishop: BISHOP, queen: ROOK.concat(BISHOP) };
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const key = (r, c) => r * N + c;
const rowOf = k => Math.floor(k / N), colOf = k => k % N;
const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const chebK = (k1, k2) => cheb(rowOf(k1), colOf(k1), rowOf(k2), colOf(k2));
const INF = 1e9;

const unitDef = t => UNITS[t];
const actionsOf = p => (p.kind === 'unit' && UNITS[p.type].actions) || 1;
const actionsLeft = p => actionsOf(p) - (p.used || 0);
const canAct = p => p.kind === 'unit' && actionsLeft(p) > 0;
const canMove = p => canAct(p) && !p.fresh;

/* "Forward" for a seat: P1 starts at the bottom (high rows) and attacks upward. */
const forwardDir = seat => (seat === 1 ? -1 : 1);
const inEnemyHalf = (seat, r) => (seat === 1 ? r < N / 2 : r >= N / 2);
// depth 0 = own back row, 9 = the row touching the midline
const rowForDepth = (seat, depth) => (seat === 1 ? N - 1 - depth : depth);
/* Seat-symmetric tie-break key for a square (lower = preferred): more forward first, then lower
   column. Without it, ties fall to the engine's row-major scan order, which means "forward" for
   one seat and "backward" for the other, and the bots stop being mirror images of each other. */
const tieKey = (seat, r, c) => (seat === 1 ? r : N - 1 - r) * N + c;

/* ------------------------------------------------------------------ board */
/* board(view, mem?): pass the bot's Memory to share expensive caches (threat map, distance
   fields) across calls within a turn. The cache resets whenever anything other than my own
   units changes (enemy pieces, bases, wards, turn), so it never goes stale on enemy info. */
function board(view, mem) {
  const me = view.you, foe = 3 - me;
  const vis = G.visibleSet(view, me);
  const at = new Map();
  for (const p of view.pieces) at.set(key(p.r, p.c), p);
  const mine = view.pieces.filter(p => p.owner === me);
  const enemies = view.pieces.filter(p => p.owner !== me);
  return {
    view, me, foe, turn: view.turn, gold: view.gold, vis, at,
    mine, myUnits: mine.filter(p => p.kind === 'unit'), myBase: mine.find(p => p.kind === 'base'),
    myWards: mine.filter(p => p.kind === 'ward'),
    enemies, enemyUnits: enemies.filter(p => p.kind === 'unit'),
    enemyBase: enemies.find(p => p.kind === 'base') || null,
    enemyWards: enemies.filter(p => p.kind === 'ward'),
    cache: mem ? mem.cacheFor(view) : {},
  };
}

/* ------------------------------------------------------------- legal lists */
function legalMoves(b, p) {
  if (!canMove(p)) return [];
  const m = G.computeMoves(b.view, p, b.vis);
  return [...m.keys()];
}
function legalActions(b, p) {
  if (!canAct(p)) return [];
  return [...G.computeActions(b.view, p, b.vis).values()];
}
function spawnTiles(b) { return [...G.spawnTiles(b.view, b.me)]; }
function canRecruit(b, type) {
  const d = UNITS[type];
  return !!d && b.view.gold >= d.cost && b.myUnits.length < CONFIG.maxUnits && spawnTiles(b).length > 0;
}
function wardTiles(b, p) { return [...G.wardTiles(b.view, p)]; }

/* Spawn square closest to a point (default: furthest forward). */
function pickSpawn(b, toward) {
  const tiles = spawnTiles(b);
  if (!tiles.length) return null;
  let tr, tc;
  if (toward) { tr = toward.r; tc = toward.c; }
  else { tr = b.me === 1 ? 0 : N - 1; tc = b.myBase ? b.myBase.c : N / 2; }
  let best = null, bs = INF, bt = INF;
  for (const k of tiles) {
    const s = cheb(rowOf(k), colOf(k), tr, tc) + 0.01 * Math.abs(colOf(k) - tc);
    const t = tieKey(b.me, rowOf(k), colOf(k));
    if (s < bs - 1e-9 || (Math.abs(s - bs) <= 1e-9 && t < bt)) { bs = s; bt = t; best = k; }
  }
  return { r: rowOf(best), c: colOf(best) };
}

/* ---------------------------------------------------------- attack shapes */
const offsetCache = new Map();
// Offsets (dr,dc) of every square a unit type's attack can reach from its own square (ignores blocking).
function attackOffsets(type) {
  if (offsetCache.has(type)) return offsetCache.get(type);
  const d = UNITS[type], a = d.attack, out = [];
  const square = R => { for (let r = -R; r <= R; r++) for (let c = -R; c <= R; c++) if (r || c) out.push([r, c]); };
  if (a) {
    if (a.type === 'melee' || a.type === 'cleave') square(1);
    else if (a.type === 'ranged' || a.type === 'blast' || a.type === 'aura') square(a.range);
    else if (a.type === 'knight') out.push(...KNIGHT);
    else if (a.type === 'line') for (const [dr, dc] of DIRS[a.dirs]) for (let i = 1; i <= a.range; i++) out.push([dr * i, dc * i]);
  }
  offsetCache.set(type, out);
  return out;
}
/* Squares from which a unit of `type` could hit (tr,tc). All shapes are symmetric. */
function attackPositions(type, tr, tc) {
  const out = [];
  for (const [dr, dc] of attackOffsets(type)) { const r = tr + dr, c = tc + dc; if (inB(r, c)) out.push(key(r, c)); }
  return out;
}

/* ------------------------------------------------------- attack prediction */
// Mirrors the engine's target rules using only what the bot can see.
function predictHits(b, p, act) {
  const d = UNITS[p.type], a = d.attack, out = [];
  if (act.kind === 'heal') return out;
  const enemyAt = (r, c) => { const q = b.at.get(key(r, c)); return q && q.owner !== p.owner ? q : null; };
  if (a.type === 'aura') {
    for (const q of b.enemies) if (cheb(q.r, q.c, p.r, p.c) <= a.range) out.push(q);
  } else if (a.type === 'cleave') {
    for (const [dr, dc] of KING) { const q = enemyAt(p.r + dr, p.c + dc); if (q) out.push(q); }
  } else if (a.type === 'blast') {
    for (const [dr, dc] of KING.concat([[0, 0]])) { const q = enemyAt(act.r + dr, act.c + dc); if (q) out.push(q); }
  } else if (a.type === 'line') {
    const dr = Math.sign(act.r - p.r), dc = Math.sign(act.c - p.c);
    for (let i = 1; i <= a.range; i++) { const q = b.at.get(key(p.r + dr * i, p.c + dc * i)); if (q) { if (q.owner !== p.owner) out.push(q); break; } }
  } else { const q = enemyAt(act.r, act.c); if (q) out.push(q); }
  return out.map(q => {
    const dmg = d.atk * (q.kind === 'base' ? (d.siege || 1) : 1);
    return { q, dmg, eff: Math.min(dmg, q.hp), kill: dmg >= q.hp };
  });
}

// How much a piece is worth killing. Units: cost plus a bit for hitting power.
function pieceValue(q) {
  if (q.kind === 'ward') return 1.5;
  if (q.kind === 'base') return 0;
  const d = UNITS[q.type];
  return d.cost + 1 + d.atk * 0.15;
}

const DEFAULT_WEIGHTS = { basePriority: 2, killBonus: 1, healWeight: 0.8, wardValue: 1 };
function scoreAction(b, p, act, w) {
  w = w || DEFAULT_WEIGHTS;
  if (act.kind === 'heal') {
    const q = b.at.get(key(act.r, act.c));
    const amt = Math.min(UNITS[p.type].heal.amount, q.maxHp - q.hp);
    return w.healWeight * pieceValue(q) * amt / q.maxHp;
  }
  let s = 0;
  for (const h of predictHits(b, p, act)) {
    if (h.q.kind === 'base') { s += h.kill ? 1e6 : (w.basePriority * h.eff) / 3; continue; }
    const v = h.q.kind === 'ward' ? (w.wardValue ?? 1) * pieceValue(h.q) : pieceValue(h.q);
    s += v * h.eff / h.q.maxHp + (h.kill ? v * w.killBonus : 0);
  }
  return s;
}
function bestAttack(b, p, w) {
  let best = null;
  for (const act of legalActions(b, p)) {
    const s = scoreAction(b, p, act, w), t = tieKey(b.me, act.r, act.c);
    if (!best || s > best.score + 1e-9 || (Math.abs(s - best.score) <= 1e-9 && t < best.tie))
      best = { score: s, tie: t, cmd: { type: 'act', id: p.id, r: act.r, c: act.c }, act };
  }
  return best;
}

/* ------------------------------------------------------------ fog memory */
class Memory {
  constructor(seat, opts) {
    this.me = seat; this.foe = 3 - seat;
    this.opts = Object.assign({}, Memory.DEFAULTS, opts || {});
    this.lastSeen = new Int16Array(N * N).fill(-1);
    this.enemies = new Map();     // id -> {id, kind, type, r, c, hp, maxHp, seen}
    this.enemyBase = null;        // {r,c} once seen (bases never move)
    this.spawnHints = [];         // enemy recruits seen while still "fresh" -> base within spawnRadius
    this.danger = [];             // {r,c,turn,dmg}: where my units took damage or died
    this.myHp = new Map(); this.myPos = new Map();
    this.enemyRecruitsSeen = {};  // type -> count of distinct enemy units ever seen
    this._seenIds = new Set();
    this.heat = new Float32Array(N * N); // enemy-unit sightings (one per unit per turn): armies gather near their base
    this._heatSeen = new Set();
    this.lastTurn = -1;
    this.version = 0;
    this._cacheSig = null; this._cache = {};
  }
  cacheFor(view) {
    let sig = view.turn + '|' + view.gold;
    for (const p of view.pieces) if (p.owner !== this.me || p.kind !== 'unit') sig += '|' + p.id + ',' + p.r + ',' + p.c + ',' + p.hp;
    if (sig !== this._cacheSig) { this._cacheSig = sig; this._cache = {}; }
    return this._cache;
  }
  update(b) {
    const t = b.turn;
    for (const k of b.vis) this.lastSeen[k] = t;
    if (b.view.seenBase) this.enemyBase = { r: b.view.seenBase.r, c: b.view.seenBase.c };
    const visIds = new Set();
    for (const q of b.enemies) {
      visIds.add(q.id);
      const prev = this.enemies.get(q.id);
      if (!prev || prev.r !== q.r || prev.c !== q.c || prev.hp !== q.hp) this.version++;
      this.enemies.set(q.id, { id: q.id, owner: q.owner, kind: q.kind, type: q.type, r: q.r, c: q.c, hp: q.hp, maxHp: q.maxHp, seen: t });
      if (q.kind === 'base') this.enemyBase = { r: q.r, c: q.c };
      if (q.kind === 'unit' && !this._seenIds.has(q.id)) { this._seenIds.add(q.id); this.enemyRecruitsSeen[q.type] = (this.enemyRecruitsSeen[q.type] || 0) + 1; }
      if (q.kind === 'unit' && !this._heatSeen.has(q.id + ':' + t)) { this._heatSeen.add(q.id + ':' + t); this.heat[key(q.r, q.c)] += 1; }
      if (this.opts.useFreshHint && q.kind === 'unit' && q.fresh && !this.spawnHints.some(h => h.id === q.id)) this.spawnHints.push({ id: q.id, r: q.r, c: q.c, turn: t });
    }
    for (const [id, e] of this.enemies) {
      if (visIds.has(id)) continue;
      // last known square is in sight but the piece isn't there: it moved or died
      if (b.vis.has(key(e.r, e.c)) || (e.kind === 'unit' && t - e.seen > this.opts.forgetAfter)) { this.enemies.delete(id); this.version++; }
    }
    if (t !== this.lastTurn) {
      // damage / losses suffered since my last turn mark danger spots (catches unseen attackers)
      const alive = new Set();
      for (const p of b.myUnits) {
        alive.add(p.id);
        const prev = this.myHp.get(p.id);
        if (prev !== undefined && p.hp < prev) this.danger.push({ r: p.r, c: p.c, turn: t, dmg: prev - p.hp });
      }
      for (const [id, pos] of this.myPos) if (!alive.has(id)) this.danger.push({ r: pos.r, c: pos.c, turn: t, dmg: pos.hp });
      this.danger = this.danger.filter(d => t - d.turn <= this.opts.dangerTurns);
      this._heatSeen.clear();
      this.lastTurn = t; this.version++;
    }
    this.myHp.clear(); this.myPos.clear();
    for (const p of b.myUnits) { this.myHp.set(p.id, p.hp); this.myPos.set(p.id, { r: p.r, c: p.c, hp: p.hp }); }
  }
  /* Squares that could still hold the enemy base: enemy half, never seen, and (if any
     fresh enemy recruit was spotted) within spawnRadius of one. */
  baseCandidates() {
    if (this.enemyBase) return [key(this.enemyBase.r, this.enemyBase.c)];
    const all = [];
    for (let r = 0; r < N; r++) if (inEnemyHalf(this.me, r)) for (let c = 0; c < N; c++) if (this.lastSeen[key(r, c)] < 0) all.push(key(r, c));
    if (this.spawnHints.length) {
      const R = CONFIG.spawnRadius;
      const near = all.filter(k => this.spawnHints.some(h => cheb(rowOf(k), colOf(k), h.r, h.c) <= R));
      if (near.length) return near;
    }
    return all;
  }
  /* Best single guess for where to go looking, from square `from`.
     score = distance - depthBias * depth (prefer their back rows) - heatBias * nearby sightings
             + small pull toward the centre column. Lower is better. */
  baseGuess(from, depthBias, heatBias) {
    if (this.enemyBase) return this.enemyBase;
    const cands = this.baseCandidates();
    if (!cands.length) return null;
    depthBias = depthBias === undefined ? 0.5 : depthBias;
    heatBias = heatBias === undefined ? 0.4 : heatBias;
    const cover = this.opts.searchCover || 0, centre = this.opts.searchCentre ?? 0.15;
    // coverage: how many still-possible base squares a unit standing on (r,c) would rule in or out
    // (within 3 = ordinary unit vision). Pulls the search toward big unexplored pockets.
    let isCand = null;
    if (cover) { isCand = new Uint8Array(N * N); for (const k of cands) isCand[k] = 1; }
    const coverOf = (r, c) => {
      let n = 0;
      for (let rr = Math.max(0, r - 3); rr <= Math.min(N - 1, r + 3); rr++) for (let cc = Math.max(0, c - 3); cc <= Math.min(N - 1, c + 3); cc++) n += isCand[rr * N + cc];
      return n;
    };
    let best = null, bs = INF;
    for (const k of cands) {
      const r = rowOf(k), c = colOf(k);
      const depth = this.me === 1 ? (N / 2 - 1 - r) : (r - N / 2); // 0 at midline .. 9 at their back row
      // last two terms are seat-symmetric tie-breaks (deeper first, then lower column): scan
      // order is row-major, which would otherwise favour deep rows for P1 and shallow for P2
      let s = cheb(r, c, from.r, from.c) - depthBias * depth + centre * Math.abs(c - (N - 1) / 2) - 1e-4 * depth + 1e-6 * c;
      if (heatBias) {
        let h = 0;
        for (let rr = Math.max(0, r - 3); rr <= Math.min(N - 1, r + 3); rr++) for (let cc = Math.max(0, c - 3); cc <= Math.min(N - 1, c + 3); cc++) h += this.heat[rr * N + cc];
        s -= heatBias * Math.min(h, 15);
      }
      if (cover) s -= cover * coverOf(r, c) / 49;
      if (s < bs) { bs = s; best = k; }
    }
    return { r: rowOf(best), c: colOf(best) };
  }
  /* Where a searcher should stand next to rule out the most possible base squares (no leaks:
     uses only what has been seen). Scores every square g on the board:
       score = cheb(from, g) / speed  -  coverW * (unseen candidates within `radius` of g) / (2*radius+1)^2
               - depthBias * (mean depth of those candidates) / 9
     Lower is better; ties go to tieKey. radius should be the searcher's vision (Scout 5).
     Returns {r, c, cover} or null when nothing is left to search (or the base is known). */
  searchTarget(from, opts) {
    if (this.enemyBase) return null;
    const o = Object.assign({ radius: 3, speed: 1, coverW: 12, depthBias: 0, minCover: 1 }, opts || {});
    const cands = this.baseCandidates();
    if (!cands.length) return null;
    const R = o.radius, isCand = new Uint8Array(N * N);
    for (const k of cands) isCand[k] = 1;
    // 2-D prefix sums of candidate count and candidate depth
    const W = N + 1, PC = new Float64Array(W * W), PD = new Float64Array(W * W);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = key(r, c), v = isCand[k];
      const depth = v ? (this.me === 1 ? (N / 2 - 1 - r) : (r - N / 2)) : 0;
      PC[(r + 1) * W + c + 1] = v + PC[r * W + c + 1] + PC[(r + 1) * W + c] - PC[r * W + c];
      PD[(r + 1) * W + c + 1] = depth + PD[r * W + c + 1] + PD[(r + 1) * W + c] - PD[r * W + c];
    }
    const box = (P, r0, c0, r1, c1) => P[(r1 + 1) * W + c1 + 1] - P[r0 * W + c1 + 1] - P[(r1 + 1) * W + c0] + P[r0 * W + c0];
    const area = (2 * R + 1) * (2 * R + 1);
    let best = null, bs = INF, bt = INF;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const r0 = Math.max(0, r - R), r1 = Math.min(N - 1, r + R), c0 = Math.max(0, c - R), c1 = Math.min(N - 1, c + R);
      const n = box(PC, r0, c0, r1, c1);
      if (n < o.minCover) continue;
      const md = box(PD, r0, c0, r1, c1) / n;
      const s = cheb(r, c, from.r, from.c) / o.speed - o.coverW * n / area - o.depthBias * md / 9;
      const t = tieKey(this.me, r, c);
      if (s < bs - 1e-9 || (Math.abs(s - bs) <= 1e-9 && t < bt)) { bs = s; bt = t; best = { r, c, cover: n }; }
    }
    return best;
  }
  knownEnemyUnits(maxAge, turn) {
    return [...this.enemies.values()].filter(e => e.kind === 'unit' && (maxAge === undefined || turn - e.seen <= maxAge));
  }
}

/* Memory defaults. useFreshHint is inert since the Phase 1 engine stopped sending enemy turn
   flags (kept so old param sets still load). searchCover / searchCentre shape baseGuess. */
Memory.DEFAULTS = { forgetAfter: 4, dangerTurns: 3, useFreshHint: true, searchCover: 0, searchCentre: 0.15 };

/* ------------------------------------------------------------- threat map */
const ALL_VISIBLE = { has: () => true };
/* threat[k] = summed attack of known enemy units that could hit square k on their next turn
   (one move then attack; a 2-action unit can also attack twice without moving).
   Remembered (not currently visible) enemies count at `staleWeight`. Danger spots add `dangerValue`. */
function threatMap(b, mem, opts) {
  opts = Object.assign({ staleWeight: 0.6, maxAge: 3, dangerValue: 2, dangerRadius: 2 }, opts || {});
  const ck = 'threat:' + JSON.stringify(opts) + ':' + (mem ? mem.version : 0) + ':' + b.enemies.length;
  if (b.cache[ck]) return b.cache[ck];
  const T = new Float32Array(N * N);
  const known = mem ? mem.knownEnemyUnits(opts.maxAge, b.turn) : b.enemyUnits.map(q => ({ ...q, seen: b.turn }));
  // synthetic board: visible pieces plus remembered enemies, everything treated as visible (blocks movement)
  const pieces = b.view.pieces.slice();
  const visibleIds = new Set(b.view.pieces.map(p => p.id));
  for (const e of known) if (!visibleIds.has(e.id)) pieces.push(e);
  const S2 = { pieces };
  for (const e of known) {
    const d = UNITS[e.type];
    if (!d || !d.attack || !d.atk) continue;
    const w = e.seen === b.turn ? 1 : opts.staleWeight;
    const ghost = { ...e, kind: 'unit', owner: b.foe, fresh: false, used: 0 };
    const reach = [key(e.r, e.c), ...G.computeMoves(S2, ghost, ALL_VISIBLE, true).keys()];
    const offs = attackOffsets(e.type);
    const hit = new Uint8Array(N * N);
    for (const k of reach) {
      const r0 = rowOf(k), c0 = colOf(k);
      for (const [dr, dc] of offs) { const r = r0 + dr, c = c0 + dc; if (inB(r, c)) hit[key(r, c)] = 1; }
    }
    if (actionsOf(ghost) > 1) for (const [dr, dc] of offs) { const r = e.r + dr, c = e.c + dc; if (inB(r, c)) T[key(r, c)] += d.atk * w; }
    for (let k = 0; k < N * N; k++) if (hit[k]) T[k] += d.atk * w;
  }
  if (mem && opts.dangerValue) for (const dz of mem.danger) {
    const R = opts.dangerRadius;
    for (let r = dz.r - R; r <= dz.r + R; r++) for (let c = dz.c - R; c <= dz.c + R; c++) if (inB(r, c)) T[key(r, c)] += opts.dangerValue;
  }
  b.cache[ck] = T;
  return T;
}

/* -------------------------------------------------------------- vision map
   Requested by the Gen 1 fog strategist. vis[k] = 1 if a known enemy piece can see square k:
   the enemy base and wards (vision 4) plus enemy units seen within maxAge turns (each at its
   type's vision, from its last known square). Use it to stay out of sight or pick ambush squares. */
function visionMap(b, mem, opts) {
  opts = Object.assign({ maxAge: 2 }, opts || {});
  const ck = 'vision:' + opts.maxAge + ':' + (mem ? mem.version : 0) + ':' + b.enemies.length;
  if (b.cache[ck]) return b.cache[ck];
  const V = new Uint8Array(N * N);
  const mark = (r0, c0, R) => { for (let r = Math.max(0, r0 - R); r <= Math.min(N - 1, r0 + R); r++) for (let c = Math.max(0, c0 - R); c <= Math.min(N - 1, c0 + R); c++) V[key(r, c)] = 1; };
  const done = new Set();
  for (const q of b.enemies) { done.add(q.id); mark(q.r, q.c, q.kind === 'base' ? CONFIG.baseVision : q.kind === 'ward' ? CONFIG.wardVision : (UNITS[q.type].vision ?? CONFIG.unitVision)); }
  if (mem) {
    if (mem.enemyBase) mark(mem.enemyBase.r, mem.enemyBase.c, CONFIG.baseVision);
    for (const e of mem.enemies.values()) {
      if (done.has(e.id) || b.turn - e.seen > opts.maxAge) continue;
      mark(e.r, e.c, e.kind === 'ward' ? CONFIG.wardVision : e.kind === 'base' ? CONFIG.baseVision : (UNITS[e.type].vision ?? CONFIG.unitVision));
    }
  }
  b.cache[ck] = V;
  return V;
}

/* ------------------------------------------------------------- strike map
   Requested by the Gen 2 fog strategist. Exact one-turn version of threatMap: S[k] = summed attack of
   known enemies that could hit square k on their NEXT turn under the real action rules.
     - 1-action units can move OR attack, so they count only from the square they stand on
       (threatMap instead adds one move, i.e. it looks two enemy turns ahead for them);
     - 2-action units (Assassin) count move range + attack range, and twice their attack from where they stand;
     - the known enemy base adds `spawnDmg` to every square within spawnRadius + spawnReach (recruits
       attack on arrival). Remembered (not visible) enemies count at `staleWeight`. Line attacks ignore blocking. */
function strikeMap(b, mem, opts) {
  opts = Object.assign({ maxAge: 2, staleWeight: 1, spawnDmg: 3, spawnReach: 1 }, opts || {});
  const ck = 'strike:' + JSON.stringify(opts) + ':' + (mem ? mem.version : 0) + ':' + b.enemies.length;
  if (b.cache[ck]) return b.cache[ck];
  const S = new Float32Array(N * N);
  const known = mem ? mem.knownEnemyUnits(opts.maxAge, b.turn) : b.enemyUnits.map(q => ({ ...q, seen: b.turn }));
  const pieces = b.view.pieces.slice(), visibleIds = new Set(b.view.pieces.map(p => p.id));
  for (const e of known) if (!visibleIds.has(e.id)) pieces.push(e);
  const S2 = { pieces };
  for (const e of known) {
    const d = UNITS[e.type];
    if (!d || !d.attack || !d.atk) continue;
    const w = e.seen === b.turn ? 1 : opts.staleWeight, offs = attackOffsets(e.type);
    const hit = new Uint8Array(N * N);
    const from = [key(e.r, e.c)];
    if ((d.actions || 1) > 1) {
      const ghost = { ...e, kind: 'unit', owner: b.foe, fresh: false, used: 0 };
      from.push(...G.computeMoves(S2, ghost, ALL_VISIBLE, true).keys());
      for (const [dr, dc] of offs) { const r = e.r + dr, c = e.c + dc; if (inB(r, c)) S[key(r, c)] += d.atk * w; } // second shot from where it stands
    }
    for (const k of from) { const r0 = rowOf(k), c0 = colOf(k); for (const [dr, dc] of offs) { const r = r0 + dr, c = c0 + dc; if (inB(r, c)) hit[key(r, c)] = 1; } }
    for (let k = 0; k < N * N; k++) if (hit[k]) S[k] += d.atk * w;
  }
  const eb = (mem && mem.enemyBase) || b.enemyBase;
  if (eb && opts.spawnDmg) {
    const R = CONFIG.spawnRadius + opts.spawnReach;
    for (let r = Math.max(0, eb.r - R); r <= Math.min(N - 1, eb.r + R); r++) for (let c = Math.max(0, eb.c - R); c <= Math.min(N - 1, eb.c + R); c++) S[key(r, c)] += opts.spawnDmg;
  }
  b.cache[ck] = S;
  return S;
}

/* --------------------------------------------------------- distance field */
// Static move geometry: for each square, the "rays" a mover can travel along in one move.
// A ray is a list of squares; a blocked square ends the ray (sliders). Step/knight/fly rays have length 1.
const rayCache = new Map();
function raysFor(m) {
  const sig = m.type + ':' + m.range;
  if (rayCache.has(sig)) return rayCache.get(sig);
  const all = new Array(N * N);
  for (let r0 = 0; r0 < N; r0++) for (let c0 = 0; c0 < N; c0++) {
    const rays = [];
    if (m.type === 'step') { for (const [dr, dc] of KING) if (inB(r0 + dr, c0 + dc)) rays.push([key(r0 + dr, c0 + dc)]); }
    else if (DIRS[m.type]) for (const [dr, dc] of DIRS[m.type]) {
      const ray = []; for (let i = 1; i <= m.range; i++) { const r = r0 + dr * i, c = c0 + dc * i; if (!inB(r, c)) break; ray.push(key(r, c)); }
      if (ray.length) rays.push(ray);
    } else if (m.type === 'knight') { for (const [dr, dc] of KNIGHT) if (inB(r0 + dr, c0 + dc)) rays.push([key(r0 + dr, c0 + dc)]); }
    else if (m.type === 'fly') for (let r = r0 - m.range; r <= r0 + m.range; r++) for (let c = c0 - m.range; c <= c0 + m.range; c++) if (inB(r, c) && !(r === r0 && c === c0)) rays.push([key(r, c)]);
    all[key(r0, c0)] = rays;
  }
  rayCache.set(sig, all);
  return all;
}

// Reusable binary min-heap on typed arrays (cost, square).
let HC = new Float64Array(1 << 15), HK = new Int32Array(1 << 15), HN = 0;
function hpush(c, k) {
  if (HN >= HC.length) { const c2 = new Float64Array(HC.length * 2); c2.set(HC); HC = c2; const k2 = new Int32Array(HK.length * 2); k2.set(HK); HK = k2; }
  let i = HN++;
  while (i > 0) { const j = (i - 1) >> 1; if (HC[j] <= c) break; HC[i] = HC[j]; HK[i] = HK[j]; i = j; }
  HC[i] = c; HK[i] = k;
}
function hpop() { // returns square; cost in HPOPC
  const k = HK[0]; HPOPC = HC[0];
  const lc = HC[--HN], lk = HK[HN];
  let i = 0;
  for (;;) { let m = 2 * i + 1; if (m >= HN) break; if (m + 1 < HN && HC[m + 1] < HC[m]) m++; if (HC[m] >= lc) break; HC[i] = HC[m]; HK[i] = HK[m]; i = m; }
  HC[i] = lc; HK[i] = lk;
  return k;
}
let HPOPC = 0;
const STATS = { fields: 0, pops: 0 };  // profiling counters (read-only for bots)

/* Turns needed for a unit of `type` to reach any goal square (Float64Array, INF = unreachable).
   Enemy pieces and all bases/wards block; my own units are treated as passable (they will move).
   opts.threat + opts.threatW: landing on square k costs an extra threatW * threat[k] / hp, so the
   cheapest route detours around danger when the detour is short enough. Step movers pay per king
   step (1/range of a turn). Cached per board (and across calls when board(view, mem) is used). */
function distanceField(b, type, goals, opts) {
  opts = opts || {};
  const tw = opts.threatW || 0, threat = tw ? opts.threat : null, hp = opts.hp || UNITS[type].hp;
  const m = UNITS[type].move;
  let gh = 7; for (const g of goals) gh = (Math.imul(gh, 31) + g + 1) >>> 0;
  const ck = `df:${m.type}${m.range}:${tw}:${hp}:${goals.length}:${gh}:${threat ? 'T' : ''}`;
  if (b.cache[ck]) return b.cache[ck];
  let blocked = b.cache.__blocked;
  if (!blocked) {
    blocked = b.cache.__blocked = new Uint8Array(N * N);
    for (const p of b.view.pieces) if (p.owner !== b.me || p.kind !== 'unit') blocked[key(p.r, p.c)] = 1;
  }
  const dist = new Float64Array(N * N).fill(INF); // must match the float64 costs exactly (float32 here caused endless re-relaxation)
  const rays = raysFor(m);
  const per = m.type === 'step' ? 1 / m.range : 1;
  HN = 0; STATS.fields++;
  for (const g of goals) if (!blocked[g] && dist[g] > 0) { dist[g] = 0; hpush(0, g); }
  while (HN) {
    const u = hpop(), cu = HPOPC; STATS.pops++;
    if (cu > dist[u]) continue;
    const step = per * (threat ? 1 + tw * threat[u] / hp : 1);
    const nc = cu + step;
    const ru = rays[u];
    for (let i = 0; i < ru.length; i++) {
      const ray = ru[i];
      for (let j = 0; j < ray.length; j++) {
        const v = ray[j];
        if (blocked[v]) break;
        if (nc < dist[v]) { dist[v] = nc; hpush(nc, v); }
      }
    }
  }
  b.cache[ck] = dist;
  return dist;
}

/* Choose this turn's move for p toward lower `dist`.
   Threat avoidance belongs in the field itself (distanceField with threat/threatW), which
   routes around danger. Here we only add `lethalPenalty` (default 0.5, keep it < 1 so units
   never freeze at the edge of danger) for landing where known enemies could kill p outright.
   Returns a move command or null if staying is at least as good.
   opts: threat, lethalPenalty, allowed (key=>bool), fallbackGoal (key, used when dist is INF), stayBonus */
function bestMove(b, p, dist, opts) {
  opts = opts || {};
  const moves = legalMoves(b, p);
  if (!moves.length) return null;
  const T = opts.threat, lp = opts.lethalPenalty ?? 0.5;
  const cost = k => {
    let s = dist[k] >= INF ? 1000 + chebK(k, opts.fallbackGoal ?? k) : dist[k];
    if (T && T[k] >= p.hp) s += lp;
    if (opts.allowed && !opts.allowed(k)) s += 500;
    return s;
  };
  const here = key(p.r, p.c);
  // best move by (cost, tieKey); then move only if it beats staying put
  let best = null, bs = INF, bt = INF;
  for (const k of moves) {
    const s = cost(k), t = tieKey(b.me, rowOf(k), colOf(k));
    if (s < bs - 1e-9 || (Math.abs(s - bs) <= 1e-9 && t < bt)) { bs = s; bt = t; best = k; }
  }
  if (best === null || !(bs < cost(here) - (opts.stayBonus || 0) - 1e-6)) return null;
  return { type: 'move', id: p.id, r: rowOf(best), c: colOf(best) };
}

/* ------------------------------------------------------------- commander
   A reusable turn controller. Each call to next(b) returns ONE command or null (nothing
   left for units to do). Order: best attack/heal anywhere (focus fire, kills first) ->
   moves (units closest to their goal first) -> null.
   cfg.goalFor(p, b) -> { goals: [keys], threatW?, lethalPenalty?, allowed?, stayBonus? }  (per unit)
   cfg.minAttack (default 0.05) or cfg.minAttackFor(p, b) -> threshold score for attacking (Infinity = never)
   cfg.wardPolicy(p, b) -> ward command or null (Scouts only) */
class Commander {
  constructor(mem, cfg) {
    this.mem = mem; this.cfg = Object.assign({ minAttack: 0.05, weights: DEFAULT_WEIGHTS, threatOpts: {} }, cfg);
    this.turn = -1; this.skip = new Set();
  }
  next(b) {
    if (b.turn !== this.turn) { this.turn = b.turn; this.skip.clear(); }
    const units = b.myUnits.filter(p => canAct(p) && !this.skip.has(p.id));
    if (!units.length) return null;
    // 1) attacks
    let best = null;
    for (const p of units) {
      // per-unit threshold: cfg.minAttackFor(p, b) lets attackers ignore low-value targets while en route
      const th = this.cfg.minAttackFor ? this.cfg.minAttackFor(p, b) : this.cfg.minAttack;
      if (th === null || th === undefined || th === Infinity) continue;
      const a = bestAttack(b, p, this.cfg.weights);
      if (a && a.score >= th && (!best || a.score > best.score)) best = a;
    }
    if (best) return best.cmd;
    // 2) wards (scouts)
    if (this.cfg.wardPolicy) for (const p of units) {
      if (p.type !== 'scout' || !canMove(p)) continue;
      const w = this.cfg.wardPolicy(p, b);
      if (w) return w;
    }
    // 3) moves
    const threat = threatMap(b, this.mem, this.cfg.threatOpts);
    const plans = [];
    for (const p of units) {
      if (!canMove(p)) { this.skip.add(p.id); continue; }
      const g = this.cfg.goalFor(p, b);
      if (!g || !g.goals || !g.goals.length) { this.skip.add(p.id); continue; }
      const dist = distanceField(b, p.type, g.goals, { threat: g.threatW ? threat : null, threatW: g.threatW || 0 });
      plans.push({ p, g, dist, d: dist[key(p.r, p.c)] });
    }
    plans.sort((x, y) => x.d - y.d || x.p.id - y.p.id);
    for (const { p, g, dist } of plans) {
      const mv = bestMove(b, p, dist, { threat, lethalPenalty: g.lethalPenalty, fallbackGoal: g.goals[0], allowed: g.allowed, stayBonus: g.stayBonus });
      if (mv) { if (actionsOf(p) - (p.used || 0) <= 1) this.skip.add(p.id); return mv; }
      this.skip.add(p.id);
    }
    return null;
  }
}

/* --------------------------------------------------------------- economy */
const incomeFor = gold => G.incomeFor(gold);
// Gold you can spend now and still hold `keep` at the start of next turn (interest is checked then).
const spendable = (b, keep) => Math.max(0, b.view.gold - (keep || 0));
function armyValue(units) { return units.reduce((s, p) => s + (p.kind === 'unit' ? UNITS[p.type].cost * p.hp / p.maxHp : 0), 0); }

/* Weighted composition picker: choose the affordable unit type whose share of my army is most
   below its target weight. weights: {type: weight}. Returns a type or null. */
function pickByComposition(b, weights, budget) {
  const counts = {}; let total = 0;
  for (const p of b.myUnits) { counts[p.type] = (counts[p.type] || 0) + UNITS[p.type].cost; total += UNITS[p.type].cost; }
  const wsum = Object.values(weights).reduce((s, w) => s + Math.max(0, w), 0) || 1;
  let best = null, bs = -INF;
  for (const [t, w] of Object.entries(weights)) {
    if (w <= 0 || !UNITS[t] || UNITS[t].cost > budget) continue;
    const deficit = w / wsum - (total ? (counts[t] || 0) / total : 0);
    if (deficit > bs) { bs = deficit; best = t; }
  }
  return best;
}

/* Requested by the Gen 2 economist: the attack score an Archmage-like aura would get if recruited on
   (r,c) and fired at once (recruits may attack on arrival). Sums over visible enemies within `range`,
   scored like scoreAction: unit value x share of HP removed + kill bonus; base = basePriority x dmg / 3. */
function auraValueAt(b, r, c, range, dmg, weights) {
  range = range ?? 4; dmg = dmg ?? 3; const w = weights || DEFAULT_WEIGHTS;
  let s = 0;
  for (const q of b.enemies) {
    if (cheb(q.r, q.c, r, c) > range) continue;
    const eff = Math.min(dmg, q.hp), kill = dmg >= q.hp;
    if (q.kind === 'base') { s += kill ? 1e6 : (w.basePriority * eff) / 3; continue; }
    const v = q.kind === 'ward' ? (w.wardValue ?? 1) * pieceValue(q) : pieceValue(q);
    s += v * eff / q.maxHp + (kill ? v * w.killBonus : 0);
  }
  return s;
}
/* Requested by the Gen 2 aggressor: the set of recruits, placed this turn on free spawn squares, that
   deals the most damage to the visible enemy base on arrival, within `budget` gold and the unit cap.
   Melee/cleave need an adjacent square, ranged/aura need range, line units need a straight line to the base
   whose squares are empty and not spawn squares (so other planned recruits can't block it: conservative).
   Exact 0/1 knapsack over (square, unit) choices. Returns {dmg, cost, list: [{type, r, c, dmg}]}. */
function maxStrikePlan(b, budget, types) {
  const base = b.enemyBase; const out = { dmg: 0, cost: 0, list: [] };
  if (!base) return out;
  budget = Math.max(0, Math.floor(budget ?? b.view.gold));
  const slots = Math.max(0, CONFIG.maxUnits - b.myUnits.length);
  const tiles = spawnTiles(b).sort((x, y) => tieKey(b.me, rowOf(x), colOf(x)) - tieKey(b.me, rowOf(y), colOf(y)));
  const spawnSet = new Set(tiles);
  types = types || Object.keys(UNITS);
  const opts = tiles.map(k => {
    const r = rowOf(k), c = colOf(k), d0 = cheb(r, c, base.r, base.c), list = [];
    for (const t of types) {
      const d = UNITS[t], a = d.attack; if (!a || !d.atk) continue;
      let ok = false;
      if (a.type === 'melee' || a.type === 'cleave') ok = d0 === 1;
      else if (a.type === 'ranged' || a.type === 'aura' || a.type === 'blast') ok = d0 <= a.range;
      else if (a.type === 'line') {
        const dr = base.r - r, dc = base.c - c, n = Math.max(Math.abs(dr), Math.abs(dc));
        const straight = dr === 0 || dc === 0, diag = Math.abs(dr) === Math.abs(dc);
        const dirOk = a.dirs === 'queen' ? (straight || diag) : a.dirs === 'rook' ? straight : diag;
        if (dirOk && n <= a.range) {
          ok = true;
          for (let i = 1; i < n; i++) { const kk = key(r + Math.sign(dr) * i, c + Math.sign(dc) * i); if (b.at.has(kk) || spawnSet.has(kk)) { ok = false; break; } }
        }
      }
      if (ok) list.push({ type: t, cost: d.cost, dmg: d.atk * (d.siege || 1) });
    }
    return { r, c, list };
  });
  // DP over tiles: best[g][n] = max damage using g gold and n units; keep choices for reconstruction
  const G = budget, M = Math.min(slots, tiles.length), NEG = -1;
  let best = Array.from({ length: G + 1 }, () => new Array(M + 1).fill(NEG)); best[0][0] = 0;
  const choice = [];
  for (const o of opts) {
    const nb = best.map(row => row.slice()), ch = Array.from({ length: G + 1 }, () => new Array(M + 1).fill(null));
    for (let g = 0; g <= G; g++) for (let n = 0; n < M; n++) if (best[g][n] >= 0) for (const u of o.list) {
      const g2 = g + u.cost; if (g2 > G) continue;
      const v = best[g][n] + u.dmg;
      if (v > nb[g2][n + 1]) { nb[g2][n + 1] = v; ch[g2][n + 1] = { u, g, n }; }
    }
    choice.push(ch); best = nb;
  }
  let bg = 0, bn = 0, bv = 0;
  for (let g = 0; g <= G; g++) for (let n = 0; n <= M; n++) if (best[g][n] > bv || (best[g][n] === bv && bv > 0 && g < bg)) { bv = best[g][n]; bg = g; bn = n; }
  // walk back
  let g = bg, n = bn;
  for (let i = opts.length - 1; i >= 0 && n > 0; i--) {
    const c = choice[i][g][n];
    if (c) { out.list.push({ type: c.u.type, r: opts[i].r, c: opts[i].c, dmg: c.u.dmg }); g = c.g; n = c.n; }
  }
  out.list.reverse(); out.dmg = bv; out.cost = bg;
  return out;
}

/* Requested by Gen 3 strategists. */
// id of the unit I recruited most recently (my own pieces carry turn flags), or null
function lastRecruitId(view) {
  let best = null;
  for (const p of view.pieces) if (p.owner === view.you && p.kind === 'unit' && p.fresh && (best === null || p.id > best)) best = p.id;
  return best;
}
/* Squares a recruit placed by the owner of `base` could see (spawnRadius + vision) or aura-hit
   (spawnRadius + aura) on the turn it arrives. Returns {see: Uint8Array, hit: Uint8Array}.
   A square with hit = 0 is out of reach of on-arrival Archmages; with see = 0 it is also unseen by them. */
function recruitReach(base, opts) {
  const o = Object.assign({ vision: CONFIG.unitVision, aura: 4 }, opts || {});
  const see = new Uint8Array(N * N), hit = new Uint8Array(N * N), R = CONFIG.spawnRadius;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const d = cheb(r, c, base.r, base.c);
    if (d <= R + o.vision) see[key(r, c)] = 1;
    if (d <= R + o.aura) hit[key(r, c)] = 1;
  }
  return { see, hit };
}
/* Squares unit p could move to on its NEXT turn from where it stands now (pieces I know about block,
   my own included; works for a unit recruited this turn or one that already acted). */
function slideReach(b, p) {
  const ghost = { ...p, fresh: false, used: 0, moved: false, acted: false };
  return [...G.computeMoves(b.view, ghost, b.vis).keys()];
}
/* Free squares at Chebyshev distance dMin..dMax from centre, sorted by
   visW * (known enemy vision) + strikeW * strikeMap value, then tieKey. Cached per board. */
function ringSquares(b, mem, centre, dMin, dMax, opts) {
  const o = Object.assign({ visW: 1, strikeW: 1 }, opts || {});
  const ck = 'ring:' + centre.r + ',' + centre.c + ':' + dMin + ':' + dMax + ':' + o.visW + ':' + o.strikeW;
  if (b.cache[ck]) return b.cache[ck];
  const V = o.visW ? visionMap(b, mem) : null, S = o.strikeW ? strikeMap(b, mem) : null, out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const d = cheb(r, c, centre.r, centre.c), k = key(r, c);
    if (d < dMin || d > dMax || b.at.has(k)) continue;
    out.push({ k, s: (V ? o.visW * V[k] : 0) + (S ? o.strikeW * S[k] : 0), t: tieKey(b.me, r, c) });
  }
  out.sort((x, y) => x.s - y.s || x.t - y.t);
  return (b.cache[ck] = out.map(x => x.k));
}

/* Requested by the Gen 1 aggressor: share (0..1) of distinct enemy units ever seen that cost <= maxCost (default 1). */
function enemyCheapShare(mem, maxCost) {
  maxCost = maxCost ?? 1;
  let n = 0, cheap = 0;
  for (const [t, k] of Object.entries(mem.enemyRecruitsSeen)) { n += k; if (UNITS[t] && UNITS[t].cost <= maxCost) cheap += k; }
  return n ? cheap / n : 0;
}
/* Requested by the Gen 1 economist: unit-slot bookkeeping. free = slots left under the unit cap,
   avgCost = mean cost of my units, upgradeBudget = gold I can spend now and still keep `bank`. */
function slotValue(b, bank) {
  const n = b.myUnits.length;
  return { free: Math.max(0, CONFIG.maxUnits - n), avgCost: n ? b.myUnits.reduce((s, p) => s + UNITS[p.type].cost, 0) / n : 0, upgradeBudget: Math.max(0, b.view.gold - (bank || 0)) };
}

module.exports = {
  G, N, UNITS, CONFIG, KING, ROOK, BISHOP, KNIGHT, DIRS, INF,
  key, rowOf, colOf, inB, cheb, chebK, unitDef, actionsOf, actionsLeft, canAct, canMove,
  forwardDir, inEnemyHalf, rowForDepth, tieKey,
  board, legalMoves, legalActions, spawnTiles, canRecruit, pickSpawn, wardTiles,
  attackOffsets, attackPositions, predictHits, pieceValue, scoreAction, bestAttack, DEFAULT_WEIGHTS,
  Memory, threatMap, distanceField, STATS, bestMove, Commander,
  incomeFor, spendable, armyValue, pickByComposition,
  visionMap, strikeMap, lastRecruitId, recruitReach, slideReach, ringSquares, enemyCheapShare, slotValue, auraValueAt, maxStrikePlan,
};

},
"lab/bots/_common.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
/* Helpers shared by the baseline bots (not a bot itself: files starting with "_" are skipped). */
const T = require('../toolkit');
const { N, UNITS, CONFIG, key, rowOf, colOf, inB, cheb } = T;

/* Base placement: depth 0 = own back row ... 9 = touching the midline; column = centre +/- jitter. */
function placeBase(view, rng, depth, jitter) {
  const seat = view.you;
  const r = T.rowForDepth(seat, Math.max(0, Math.min(N / 2 - 1 - (CONFIG.baseMinDepth || 0), depth)));
  const c0 = rng.chance(0.5) ? N / 2 - 1 : N / 2;
  const c = Math.max(0, Math.min(N - 1, c0 + rng.int(-jitter, jitter)));
  return { type: 'place', r, c };
}

/* Where an attacking unit should head: squares it could hit the enemy base from if the base
   is known, otherwise a search square. spread=false: one guess for the whole army (from its
   centroid); spread=true: each unit guesses from its own square, so the army fans out. */
function attackGoals(b, mem, p, depthBias, heatBias, spread) {
  if (mem.enemyBase) return T.attackPositions(p.type, mem.enemyBase.r, mem.enemyBase.c);
  let g;
  if (spread) {
    const ck = 'guess:' + p.r + ',' + p.c;
    g = b.cache[ck] !== undefined ? b.cache[ck] : (b.cache[ck] = mem.baseGuess(p, depthBias, heatBias));
  } else {
    g = b.cache.guess;
    if (g === undefined) {
      const us = b.myUnits;
      // centroid; rows are rounded in the seat's own frame so P1 and P2 behave as mirror images
      const ar = us.reduce((s, u) => s + u.r, 0) / us.length;
      const from = us.length
        ? { r: b.me === 1 ? Math.round(ar) : N - 1 - Math.round(N - 1 - ar), c: Math.round(us.reduce((s, u) => s + u.c, 0) / us.length) }
        : b.myBase;
      g = b.cache.guess = mem.baseGuess(from, depthBias, heatBias);
    }
  }
  if (!g) return [];
  return [key(g.r, g.c)];
}

/* Search goal for a unit hunting the enemy base: the square from which its own vision would rule
   out the most still-possible base squares, discounted by distance (Memory.searchTarget). */
function searchGoals(b, mem, p, coverW, depthBias) {
  const d = UNITS[p.type];
  const ck = 'search:' + p.type + ':' + p.r + ',' + p.c + ':' + coverW + ':' + (depthBias || 0);
  let g = b.cache[ck];
  if (g === undefined) g = b.cache[ck] = mem.searchTarget(p, { radius: d.vision ?? CONFIG.unitVision, speed: d.move.range || 1, coverW, depthBias: depthBias || 0 });
  return g ? [key(g.r, g.c)] : [];
}

/* Attack threshold for a unit on the offensive: full willingness once it stands where it could
   hit the enemy base (or can't move anyway), otherwise only attacks worth >= chaseMin. */
function offensiveThreshold(b, mem, p, chaseMin) {
  if (!T.canMove(p)) return 0.05;
  const base = mem.enemyBase;
  if (base && T.attackPositions(p.type, base.r, base.c).includes(key(p.r, p.c))) return 0.05;
  return chaseMin;
}

/* Known enemy units within `radius` of my base (visible or remembered recently). */
function intruders(b, mem, radius) {
  if (!b.myBase) return [];
  return mem.knownEnemyUnits(2, b.turn).filter(e => cheb(e.r, e.c, b.myBase.r, b.myBase.c) <= radius);
}

/* Defensive goals: engage intruders if any, otherwise stand on the forward arc at guardRadius. */
function defendGoals(b, mem, p, guardRadius, engageRadius) {
  const base = b.myBase;
  if (!base) return [];
  const intr = b.cache.intr || (b.cache.intr = intruders(b, mem, engageRadius));
  if (intr.length && UNITS[p.type].attack) {
    const out = new Set();
    for (const e of intr) for (const k of T.attackPositions(p.type, e.r, e.c)) out.add(k);
    return [...out];
  }
  const fwd = T.forwardDir(b.me), out = [];
  const R = guardRadius;
  for (let r = base.r - R; r <= base.r + R; r++) for (let c = base.c - R; c <= base.c + R; c++) {
    if (!inB(r, c) || cheb(r, c, base.r, base.c) !== R) continue;
    if ((r - base.r) * fwd < 0) continue; // only the forward half of the ring
    out.push(key(r, c));
  }
  if (!out.length) out.push(key(base.r, base.c)); // degenerate; distanceField skips blocked goals
  return out;
}

/* Scout ward policy: drop a ward when no friendly ward/base already watches that area. */
function wardPolicy(minGap) {
  return (p, b) => {
    if (p.moved || p.acted || p.fresh) return null;
    const tiles = T.wardTiles(b, p);
    if (!tiles.length) return null;
    const watchers = b.myWards.concat(b.myBase ? [b.myBase] : []);
    if (watchers.some(w => cheb(w.r, w.c, p.r, p.c) < minGap)) return null;
    tiles.sort((x, y) => T.tieKey(b.me, rowOf(x), colOf(x)) - T.tieKey(b.me, rowOf(y), colOf(y)));  // most forward, then lower column
    return { type: 'ward', id: p.id, r: rowOf(tiles[0]), c: colOf(tiles[0]) };
  };
}

/* Watch-post goal for scouts: a square `dist` rows forward of base, spread across columns. */
function watchPostGoal(b, idx, dist, spread) {
  const base = b.myBase; if (!base) return [];
  const fwd = T.forwardDir(b.me);
  const r = Math.max(0, Math.min(N - 1, base.r + fwd * dist));
  const offs = [0, -spread, spread, -2 * spread, 2 * spread];
  const c = Math.max(0, Math.min(N - 1, base.c + offs[idx % offs.length]));
  return [key(r, c)];
}

/* A short row of squares `dist` rows ahead of my base (where waves gather). */
function rallyGoals(b, dist, halfWidth) {
  const base = b.myBase; if (!base) return [];
  const r = Math.max(0, Math.min(N - 1, base.r + T.forwardDir(b.me) * dist)), out = [];
  for (let c = base.c - halfWidth; c <= base.c + halfWidth; c++) if (inB(r, c)) out.push(key(r, c));
  return out;
}

/* Recruit one unit of `type` on the spawn square closest to `toward` (default: forward). */
function recruit(b, type, toward) {
  if (!T.canRecruit(b, type)) return null;
  const t = T.pickSpawn(b, toward);
  return t ? { type: 'recruit', unit: type, r: t.r, c: t.c } : null;
}

/* Composition picker that can insist on a type it can't afford yet (so the bot saves for it). */
function desiredType(b, weights) {
  const counts = {}; let total = 0;
  for (const p of b.myUnits) { const v = UNITS[p.type].cost; counts[p.type] = (counts[p.type] || 0) + v; total += v; }
  const wsum = Object.values(weights).reduce((s, w) => s + Math.max(0, w), 0);
  if (!wsum) return null;
  let best = null, bs = -Infinity;
  for (const [t, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    const deficit = w / wsum - (total ? (counts[t] || 0) / total : 0);
    if (deficit > bs + 1e-9) { bs = deficit; best = t; }
  }
  return best;
}

module.exports = { placeBase, attackGoals, searchGoals, offensiveThreshold, intruders, defendGoals, wardPolicy, watchPostGoal, rallyGoals, recruit, desiredType };

},
"lab/bots/g3_agg_creep.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
/* g3_agg_creep — siege column: Snipers marching under a moving Archmage umbrella from a safe back-row base.
   Where g3_agg_battery parks its base on the midline and fights inside its own spawn zone, this bot keeps
   its base on the back row (no rush or midline gamble can reach it early) and takes the umbrella with it:
     1. gather a column of `columnSnipers` Snipers and `escorts` escort Archmages in front of the base;
     2. march it across the board as one block: Snipers may not step more than `leash` from an escort,
        escorts walk beside the Snipers and fire their aura (range 4, hits unseen units too) at anything
        that closes in, so Assassin hunters and screens die before they reach the Snipers;
     3. set up on the ring `artyMin` (6) from the enemy base: Sniper vision 6 sees the base, while the base
        (vision 4) and its on-arrival recruits (2 + vision 3) can't see the column, and the escorts stay
        `escortMin` (7+) away, beyond an on-arrival aura (2 + 4). Snipers grind the defenders first
        (attrition-weighted targeting), then the base.
   Late Snipers / escorts walk up to join the column; a banked `keep` buys an on-arrival Archmage at home.
   A kill check (T.maxStrikePlan + units in reach) spends everything when the base can die this turn. */
const T = require('../toolkit');
const C = require('./_common');
const { UNITS, key, rowOf, colOf, inB, cheb } = T;

module.exports = {
  name: 'g3_agg_creep',
  description: 'Back-row base; a Sniper column escorted by walking Archmages marches to 6 squares from the enemy base and grinds it down.',
  params: {
    baseDepth:     { type: 'int',   default: 0,  min: 0, max: 9,  help: 'base row depth (0 = own back row)' },
    baseJitter:    { type: 'int',   default: 4,  min: 0, max: 8,  help: 'random column offset of the base' },
    scouts:        { type: 'int',   default: 2,  min: 1, max: 6,  help: 'scouts kept while the base is unknown' },
    spotters:      { type: 'int',   default: 1,  min: 0, max: 4,  help: 'scouts kept as watchers once the base is known' },
    spotDist:      { type: 'int',   default: 7,  min: 5, max: 10, help: 'watcher distance from the enemy base' },
    columnSnipers: { type: 'int',   default: 3,  min: 1, max: 10, help: 'Snipers gathered before the column marches' },
    escorts:       { type: 'int',   default: 2,  min: 0, max: 5,  help: 'escort Archmages in the column' },
    goTurn:        { type: 'int',   default: 16, min: 4, max: 50, help: 'march with whatever is gathered by this turn' },
    leash:         { type: 'int',   default: 3,  min: 1, max: 6,  help: 'max distance of a marching Sniper from an escort' },
    frontBand:     { type: 'int',   default: 0,  min: 0, max: 4,  help: 'escorts walk beside Snipers within this many squares of the front' },
    escortMin:     { type: 'int',   default: 7,  min: 5, max: 10, help: 'escorts stay at least this far from the enemy base' },
    escortFire:    { type: 'float', default: 1,  min: 0, max: 6, help: 'min aura score for a marching escort to fire instead of walking' },
    engageMin:     { type: 'float', default: 2,  min: 0.5, max: 10, help: 'one-turn enemy reach on a column member that makes the column stop and fight' },
    artyMin:       { type: 'int',   default: 6,  min: 5, max: 8,  help: 'sniper post distance from the enemy base' },
    rallyDist:     { type: 'int',   default: 3,  min: 1, max: 6,  help: 'gathering row ahead of my base' },
    keep:          { type: 'int',   default: 14, min: 0, max: 40, help: 'gold banked (interest + home Archmage)' },
    allInTurn:     { type: 'int',   default: 45, min: 10, max: 60, help: 'from this turn keep nothing back' },
    basePriority:  { type: 'float', default: 2,  min: 0, max: 12, help: 'attack weight of base damage (low = grind units first)' },
    killBonus:     { type: 'float', default: 1.5, min: 0, max: 4, help: 'attack weight of kills' },
    defendRadius:  { type: 'int',   default: 6,  min: 2, max: 9,  help: 'enemies this close to my base trigger defence' },
    auraMin:       { type: 'float', default: 3,  min: 0.5, max: 15, help: 'min aura score to recruit a home Archmage' },
    visAvoid:      { type: 'float', default: 2,  min: 0, max: 10, help: 'goal penalty for squares in known enemy vision' },
    threatW:       { type: 'float', default: 1,  min: 0, max: 4,  help: 'path threat weight' },
    coverW:        { type: 'float', default: 14, min: 2, max: 30, help: 'scout search coverage weight' },
    searchDepth:   { type: 'float', default: 2,  min: 0, max: 8,  help: 'scout search bias toward the enemy back rows' },
  },
  create({ seat, params: P, rng }) {
    const mem = new T.Memory(seat, { forgetAfter: 4 });
    const W = { basePriority: P.basePriority, killBonus: P.killBonus, healWeight: 0.8, wardValue: 1.2 };
    let turn = -1, marching = false, escortAt = null;
    const done = new Set();
    const escortIds = new Set();
    const byTie = b => (x, y) => T.tieKey(b.me, rowOf(x), colOf(x)) - T.tieKey(b.me, rowOf(y), colOf(y));
    const byId = (x, y) => x.id - y.id;

    function killCheck(b) {
      const eb = b.enemyBase; if (!eb) return null;
      let dmg = 0;
      for (const p of b.myUnits) {
        if (!T.canAct(p)) continue;
        if (!T.legalActions(b, p).some(a => a.r === eb.r && a.c === eb.c)) continue;
        const d = UNITS[p.type];
        dmg += d.atk * (d.siege || 1) * T.actionsLeft(p);
      }
      if (dmg >= eb.hp) return { plan: null };
      const plan = T.maxStrikePlan(b, b.gold);
      return dmg + plan.dmg >= eb.hp ? { plan } : null;
    }

    const snipers = b => b.myUnits.filter(u => u.type === 'sniper').sort(byId);
    const escorts = b => b.myUnits.filter(u => escortIds.has(u.id)).sort(byId);

    // the point the column works toward: the known base, else the best deep guess
    function target(b) {
      if (mem.enemyBase) return mem.enemyBase;
      if (b.cache.guess !== undefined) return b.cache.guess;
      const sn = snipers(b);
      return (b.cache.guess = mem.baseGuess(sn.length ? sn[0] : (b.myBase || { r: 10, c: 10 }), 3, 0.3));
    }

    // best-scoring squares (lower score) on a ring around `centre`
    function ring(b, centre, dMin, dMax) {
      const ck = 'ring:' + centre.r + ',' + centre.c + ':' + dMin + ':' + dMax;
      if (b.cache[ck]) return b.cache[ck];
      const vis = T.visionMap(b, mem, { maxAge: 2 });
      const sm = T.strikeMap(b, mem, { spawnDmg: 0 });
      let best = 1e9, list = [];
      for (let r = centre.r - dMax; r <= centre.r + dMax; r++) for (let c = centre.c - dMax; c <= centre.c + dMax; c++) {
        if (!inB(r, c)) continue;
        const d = cheb(r, c, centre.r, centre.c);
        if (d < dMin || d > dMax) continue;
        const k = key(r, c), q = b.at.get(k);
        if (q && (q.owner !== b.me || q.kind !== 'unit')) continue;
        const s = (vis[k] ? P.visAvoid : 0) + (sm[k] > 0 ? 5 + sm[k] / 10 : 0);
        if (s < best - 1e-9) { best = s; list = [k]; } else if (Math.abs(s - best) <= 1e-9) list.push(k);
      }
      return (b.cache[ck] = list);
    }

    function sniperPlan(b, p) {
      if (!marching) return { goals: C.rallyGoals(b, P.rallyDist, 4), settled: false };
      const tg = target(b);
      if (!tg) return { goals: C.rallyGoals(b, P.rallyDist, 4), settled: true };
      const g = ring(b, tg, P.artyMin, P.artyMin, p.id);
      return { goals: g, settled: !!mem.enemyBase && g.includes(key(p.r, p.c)) };
    }

    function escortGoals(b, p) {
      if (!marching) return C.rallyGoals(b, P.rallyDist + 1, 4);
      const tg = target(b), sn = snipers(b);
      if (!tg || !sn.length) return C.rallyGoals(b, P.rallyDist + 1, 4);
      // squares next to a Sniper, no closer than escortMin to the target
      // ... the most forward Snipers (ties by id), so the escort leads and the leash pulls the column on
      const dmin = Math.min(...sn.map(s => cheb(s.r, s.c, tg.r, tg.c)));
      const front = sn.filter(s => cheb(s.r, s.c, tg.r, tg.c) <= dmin + P.frontBand);
      const out = new Set();
      for (const s of front) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = s.r + dr, c = s.c + dc;
        if (!inB(r, c) || (!dr && !dc)) continue;
        if (cheb(r, c, tg.r, tg.c) < P.escortMin) continue;
        out.add(key(r, c));
      }
      if (!out.size) return ring(b, tg, P.escortMin, P.escortMin, p.id);
      return [...out];
    }

    function moveUnit(b, p, goals, threatW, allowed) {
      if (!goals.length) return null;
      const threat = T.threatMap(b, mem);
      const dist = T.distanceField(b, p.type, goals, { threat, threatW });
      return T.bestMove(b, p, dist, { threat, lethalPenalty: 0.5, fallbackGoal: goals[0], allowed });
    }

    // a known enemy could hit p (or, for an escort, a Sniper next to it) on its next turn
    function threatened(b, p) {
      const sm = T.strikeMap(b, mem, { spawnDmg: 0 });
      if (sm[key(p.r, p.c)] >= P.engageMin) return true;
      if (!escortIds.has(p.id)) return false;
      return b.myUnits.some(u => u.type === 'sniper' && cheb(u.r, u.c, p.r, p.c) <= 2 && sm[key(u.r, u.c)] >= P.engageMin);
    }
    const predictKill = (b, p, act) => T.predictHits(b, p, act).some(h => h.kill && h.q.kind === 'unit' && UNITS[h.q.type].cost >= 1);

    function attacks(b, allIn) {
      const w = allIn ? { ...W, basePriority: 1000 } : W;
      let best = null;
      for (const p of b.myUnits) {
        if (!T.canAct(p)) continue;
        // cached per board snapshot (my own moves only change line attacks, which are never cached)
        const ck = 'ba:' + p.id + ':' + p.r + ',' + p.c + ':' + (p.used || 0) + ':' + (allIn ? 1 : 0);
        const line = UNITS[p.type].attack && UNITS[p.type].attack.type === 'line';
        const a = line ? T.bestAttack(b, p, w) : b.cache[ck] !== undefined ? b.cache[ck] : (b.cache[ck] = T.bestAttack(b, p, w));
        if (!a || a.score <= 0.05) continue;
        const q = b.at.get(key(a.act.r, a.act.c));
        if (p.type === 'scout' && (!q || !(q.kind === 'ward' || (q.type === 'scout' && q.hp <= 1)))) continue;
        if (!allIn && T.canMove(p) && !done.has(p.id) && marching && q && q.kind !== 'base') {
          // a marching column keeps walking unless something can hit it next turn (or the shot kills)
          const kill = predictKill(b, p, a.act);
          if (escortIds.has(p.id) && !kill && (a.score < P.escortFire || !threatened(b, p))) continue;
          if (p.type === 'sniper' && !kill && !threatened(b, p) && !sniperPlan(b, p).settled) continue;
        }
        if (!best || a.score > best.score + 1e-9) best = a;
      }
      return best ? best.cmd : null;
    }

    function controlScouts(b) {
      for (const p of b.myUnits.filter(u => u.type === 'scout' && T.canMove(u) && !done.has(u.id)).sort(byId)) {
        done.add(p.id);
        let goals;
        if (mem.enemyBase) {
          goals = ring(b, mem.enemyBase, P.spotDist, P.spotDist, p.id);
          if (goals.includes(key(p.r, p.c))) continue;
        } else goals = C.searchGoals(b, mem, p, P.coverW, P.searchDepth);
        const mv = moveUnit(b, p, goals, P.threatW);
        if (mv) return mv;
      }
      return null;
    }

    function moveOthers(b) {
      const es = escorts(b);
      const units = b.myUnits.filter(u => u.type !== 'scout' && T.canMove(u) && !done.has(u.id)).sort(byId);
      // escorts first, so the Snipers' leash is measured from where the escorts end up
      units.sort((x, y) => (escortIds.has(y.id) ? 1 : 0) - (escortIds.has(x.id) ? 1 : 0) || x.id - y.id);
      for (const p of units) {
        done.add(p.id);
        let goals, allowed;
        if (p.type === 'sniper') {
          const g = sniperPlan(b, p);
          if (g.settled) continue;
          goals = g.goals;
          if (marching && es.length && es.some(e => cheb(e.r, e.c, p.r, p.c) <= P.leash + 1)) {
            const tg = target(b);
            // the leash binds only on the way in; on the ring, Snipers spread freely
            allowed = k => es.some(e => cheb(e.r, e.c, rowOf(k), colOf(k)) <= P.leash) || (tg && cheb(rowOf(k), colOf(k), tg.r, tg.c) <= P.artyMin);
          }
        } else if (escortIds.has(p.id)) goals = escortGoals(b, p);
        else goals = C.rallyGoals(b, 2, 3);   // home guards
        if (!goals.length || goals.includes(key(p.r, p.c))) continue;
        const mv = moveUnit(b, p, goals, P.threatW, allowed);
        if (mv) return mv;
      }
      return null;
    }

    function recruitStep(b, kill) {
      if (!b.myBase) return null;
      if (b.myUnits.length >= T.CONFIG.maxUnits || !T.spawnTiles(b).length) return null;
      if (kill && kill.plan) {
        for (const s of kill.plan.list) if (!b.at.has(key(s.r, s.c)) && b.gold >= UNITS[s.type].cost) return { type: 'recruit', unit: s.type, r: s.r, c: s.c };
      }
      const intr = C.intruders(b, mem, P.defendRadius).filter(e => b.vis.has(key(e.r, e.c)));
      if (intr.length) {
        if (b.gold >= 12) {
          let bs = -1, bk = null;
          for (const k of T.spawnTiles(b).sort(byTie(b))) {
            const s = T.auraValueAt(b, rowOf(k), colOf(k), 4, 3, W);
            if (s > bs + 1e-9) { bs = s; bk = k; }
          }
          if (bk !== null && bs >= P.auraMin) return { type: 'recruit', unit: 'archmage', r: rowOf(bk), c: colOf(bk) };
        }
        const e = intr.slice().sort((x, y) => cheb(x.r, x.c, b.myBase.r, b.myBase.c) - cheb(y.r, y.c, b.myBase.r, b.myBase.c) || T.tieKey(b.me, x.r, x.c) - T.tieKey(b.me, y.r, y.c))[0];
        const at = T.pickSpawn(b, e), d = cheb(at.r, at.c, e.r, e.c);
        if (d <= 1 && b.gold >= 1) return { type: 'recruit', unit: 'footman', r: at.r, c: at.c };
        if (d <= 3 && b.gold >= 1) return { type: 'recruit', unit: 'slinger', r: at.r, c: at.c };
      }
      const sc = b.myUnits.filter(u => u.type === 'scout').length;
      if (sc < (mem.enemyBase ? P.spotters : P.scouts) && b.gold >= 1) {
        const at = T.pickSpawn(b, mem.enemyBase || undefined);
        return { type: 'recruit', unit: 'scout', r: at.r, c: at.c };
      }
      const keep = b.turn >= P.allInTurn ? 0 : P.keep;
      const ne = escorts(b).length, ns = snipers(b).length;
      // first escort, then Snipers, keeping one escort per columnSnipers/escorts Snipers
      const wantEscort = ne < P.escorts && (ne === 0 || ns >= Math.ceil(P.columnSnipers * ne / Math.max(1, P.escorts)));
      const type = wantEscort ? 'archmage' : 'sniper';
      if (b.gold - UNITS[type].cost >= keep) {
        const at = T.pickSpawn(b, mem.enemyBase || undefined);
        if (type === 'archmage') escortAt = key(at.r, at.c);
        return { type: 'recruit', unit: type, r: at.r, c: at.c };
      }
      return null;
    }

    return {
      place(view) { return C.placeBase(view, rng, P.baseDepth, P.baseJitter); },
      act(view) {
        const b = T.board(view, mem);
        mem.update(b);
        if (escortAt !== null) {
          const q = b.at.get(escortAt);
          if (q && q.owner === b.me && q.type === 'archmage') escortIds.add(q.id);
          escortAt = null;
        }
        if (b.turn !== turn) {
          turn = b.turn; done.clear();
          if (!marching && (snipers(b).length >= P.columnSnipers && escorts(b).length >= P.escorts || (b.turn >= P.goTurn && snipers(b).length > 0))) marching = true;
        }
        const kill = killCheck(b);
        const a = attacks(b, !!kill);
        if (a) return a;
        if (kill) { const r = recruitStep(b, kill); if (r) return r; }
        const m = moveOthers(b); if (m) return m;
        const s = controlScouts(b); if (s) return s;
        const r = recruitStep(b, null); if (r) return r;
        return { type: 'end' };
      },
    };
  },
};

},
"lab/bots/g3_agg_battery.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
/* g3_agg_battery — forward Sniper battery that outranges on-arrival Archmages.
   The base goes on (or near) the midline, so its spawn zone is ~8 rows from a back-row enemy base.
   Scouts find the base, then pull back to watch posts `spotDist` (7) away. Snipers walk to the ring
   `artyMin..artyMax` (6) squares from the enemy base: Sniper vision 6 sees the base from there, while
   the base (vision 4) and anything recruited on its spawn zone (2 + vision 3 = 5) cannot see them, so
   an on-arrival Archmage has nothing to aim at. Snipers further back (up to range 8) also fire once
   the base is in view, and new Snipers recruited within 8 fire on arrival.
   The battery stands inside my own spawn umbrella: a banked `keep` pays for an on-arrival Archmage
   when hunters (Assassins) come for the Snipers. A kill check (T.maxStrikePlan plus every unit that
   can already hit) spends everything when the base can die this turn. */
const T = require('../toolkit');
const C = require('./_common');
const { UNITS, key, rowOf, colOf, inB, cheb } = T;

module.exports = {
  name: 'g3_agg_battery',
  description: 'Midline base, Sniper battery 6 squares from the enemy base (self-spotting, unseen by on-arrival recruits), own Archmage umbrella.',
  params: {
    baseDepth:    { type: 'int',   default: 9,  min: 0, max: 9,  help: 'base row depth (9 = touching the midline)' },
    baseJitter:   { type: 'int',   default: 1,  min: 0, max: 6,  help: 'random column offset of the base' },
    scouts:       { type: 'int',   default: 2,  min: 1, max: 6,  help: 'scouts kept while the base is unknown' },
    spotters:     { type: 'int',   default: 1,  min: 0, max: 4,  help: 'scouts kept as watchers once the base is known' },
    spotDist:     { type: 'int',   default: 7,  min: 5, max: 10, help: 'watcher distance from the enemy base' },
    artyMin:      { type: 'int',   default: 6,  min: 5, max: 8,  help: 'closest a sniper stands to the enemy base' },
    artyMax:      { type: 'int',   default: 6,  min: 5, max: 8,  help: 'farthest goal square for a sniper' },
    keep:         { type: 'int',   default: 16, min: 0, max: 40, help: 'gold banked (interest + on-arrival Archmage) when buying snipers' },
    allInTurn:    { type: 'int',   default: 45, min: 10, max: 60, help: 'from this turn keep nothing back' },
    basePriority: { type: 'float', default: 4,  min: 0, max: 12, help: 'attack weight of base damage' },
    killBonus:    { type: 'float', default: 1,  min: 0, max: 4 },
    defendRadius: { type: 'int',   default: 6,  min: 2, max: 9,  help: 'enemies this close to my base trigger defence' },
    auraMin:      { type: 'float', default: 3,  min: 0.5, max: 15, help: 'min aura score to recruit a defending Archmage' },
    probe:        { type: 'bool',  default: true, help: 'snipers advance to search while the base is unknown' },
    guessDepth:   { type: 'float', default: 3,  min: 0, max: 8,  help: 'depth bias of the snipers\' base guess' },
    engageR:      { type: 'int',   default: 5,  min: 0, max: 8,  help: 'a sniper on the way shoots targets this close' },
    strikeAvoid:  { type: 'bool',  default: true, help: 'sniper goal squares avoid known one-turn enemy reach' },
    visAvoid:     { type: 'float', default: 2,  min: 0, max: 10, help: 'goal penalty for squares in known enemy vision' },
    threatW:      { type: 'float', default: 1,  min: 0, max: 4,  help: 'path threat weight' },
    coverW:       { type: 'float', default: 14, min: 2, max: 30, help: 'scout search coverage weight' },
    searchDepth:  { type: 'float', default: 2,  min: 0, max: 8,  help: 'scout search bias toward the enemy back rows' },
  },
  create({ seat, params: P, rng }) {
    const mem = new T.Memory(seat, { forgetAfter: 4 });
    const W = { basePriority: P.basePriority, killBonus: P.killBonus, healWeight: 0.8, wardValue: 1.2 };
    const artyMin = Math.min(P.artyMin, P.artyMax), artyMax = Math.max(P.artyMin, P.artyMax);
    let turn = -1;
    const done = new Set();
    const byTie = b => (x, y) => T.tieKey(b.me, rowOf(x), colOf(x)) - T.tieKey(b.me, rowOf(y), colOf(y));

    function killCheck(b) {
      const eb = b.enemyBase; if (!eb) return null;
      let dmg = 0;
      for (const p of b.myUnits) {
        if (!T.canAct(p)) continue;
        if (!T.legalActions(b, p).some(a => a.r === eb.r && a.c === eb.c)) continue;
        const d = UNITS[p.type];
        dmg += d.atk * (d.siege || 1) * T.actionsLeft(p);
      }
      if (dmg >= eb.hp) return { plan: null };
      const plan = T.maxStrikePlan(b, b.gold);
      return dmg + plan.dmg >= eb.hp ? { plan } : null;
    }

    // best-scoring squares (lower score) among a ring around the enemy base
    function ringGoals(b, p, dMin, dMax, avoidStrike, centre) {
      const eb = centre || mem.enemyBase;
      const vis = T.visionMap(b, mem, { maxAge: 2 });
      const sm = avoidStrike ? T.strikeMap(b, mem, { spawnDmg: 0 }) : null;
      let best = 1e9, list = [];
      for (let r = eb.r - dMax; r <= eb.r + dMax; r++) for (let c = eb.c - dMax; c <= eb.c + dMax; c++) {
        if (!inB(r, c)) continue;
        const d = cheb(r, c, eb.r, eb.c);
        if (d < dMin || d > dMax) continue;
        const k = key(r, c), q = b.at.get(k);
        if (q && q.id !== p.id && (q.owner !== b.me || q.kind !== 'unit')) continue;
        const s = (vis[k] ? P.visAvoid : 0) + (sm && sm[k] > 0 ? 5 + sm[k] / p.hp : 0);
        if (s < best - 1e-9) { best = s; list = [k]; } else if (Math.abs(s - best) <= 1e-9) list.push(k);
      }
      return { list, best };
    }

    function moveUnit(b, p, goals, threatW) {
      if (!goals.length) return null;
      const threat = T.threatMap(b, mem);
      const dist = T.distanceField(b, p.type, goals, { threat, threatW });
      return T.bestMove(b, p, dist, { threat, lethalPenalty: 0.5, fallbackGoal: goals[0] });
    }

    function controlScouts(b) {
      const scouts = b.myUnits.filter(u => u.type === 'scout' && !done.has(u.id) && T.canMove(u)).sort((x, y) => x.id - y.id);
      for (const p of scouts) {
        done.add(p.id);
        let goals;
        if (mem.enemyBase) {
          const g = ringGoals(b, p, P.spotDist, P.spotDist, true);
          const here = cheb(p.r, p.c, mem.enemyBase.r, mem.enemyBase.c) === P.spotDist;
          if (here && g.list.includes(key(p.r, p.c))) continue;
          goals = g.list;
        } else goals = C.searchGoals(b, mem, p, P.coverW, P.searchDepth);
        const mv = moveUnit(b, p, goals, P.threatW);
        if (mv) return mv;
      }
      return null;
    }

    function attacks(b, allIn) {
      const w = allIn ? { ...W, basePriority: 1000 } : W;
      let best = null;
      for (const p of b.myUnits) {
        if (!T.canAct(p)) continue;
        // cached per board snapshot (my own moves only change line attacks, which are never cached)
        const ck = 'ba:' + p.id + ':' + p.r + ',' + p.c + ':' + (p.used || 0) + ':' + (allIn ? 1 : 0);
        const line = UNITS[p.type].attack && UNITS[p.type].attack.type === 'line';
        const a = line ? T.bestAttack(b, p, w) : b.cache[ck] !== undefined ? b.cache[ck] : (b.cache[ck] = T.bestAttack(b, p, w));
        if (!a || a.score <= 0.05) continue;
        if (p.type === 'scout') {
          // scouts only finish wards / scouts: anything else gives them away
          const q = b.at.get(key(a.act.r, a.act.c));
          if (!q || !(q.kind === 'ward' || (q.type === 'scout' && q.hp <= 1))) continue;
        }
        if (p.type === 'sniper' && !allIn && T.canMove(p) && !done.has(p.id)) {
          // a sniper still walking to its post only shoots the base, kills, or nearby threats
          const q = b.at.get(key(a.act.r, a.act.c));
          const urgent = !q || q.kind === 'base' || q.hp <= UNITS.sniper.atk || cheb(q.r, q.c, p.r, p.c) <= P.engageR ||
            (b.myBase && cheb(q.r, q.c, b.myBase.r, b.myBase.c) <= P.defendRadius);
          if (!urgent && !sniperGoals(b, p).settled) continue;
        }
        if (!best || a.score > best.score + 1e-9) best = a;
      }
      return best ? best.cmd : null;
    }

    // where a sniper wants to stand; settled = already on a good square
    function sniperGoals(b, p) {
      if (mem.enemyBase) {
        const g = ringGoals(b, p, artyMin, artyMax, P.strikeAvoid);
        const d = cheb(p.r, p.c, mem.enemyBase.r, mem.enemyBase.c);
        return { goals: g.list, settled: d >= artyMin && d <= artyMax && g.list.includes(key(p.r, p.c)) };
      }
      if (P.probe) {
        // base unknown: walk to the ring around the best guess (deep rows); vision 6 will find it
        const g = b.cache.sguess !== undefined ? b.cache.sguess : (b.cache.sguess = mem.baseGuess(b.myBase || p, P.guessDepth, 0.3));
        if (g) return { goals: ringGoals(b, p, artyMin, artyMin, P.strikeAvoid, g).list, settled: false };
      }
      return { goals: C.rallyGoals(b, 3, 3), settled: true };
    }

    function moveOthers(b) {
      const units = b.myUnits.filter(u => u.type !== 'scout' && T.canMove(u) && !done.has(u.id)).sort((x, y) => x.id - y.id);
      for (const p of units) {
        done.add(p.id);
        let goals;
        if (p.type === 'sniper') {
          const g = sniperGoals(b, p);
          if (g.settled && mem.enemyBase) continue;
          goals = g.goals;
        } else if (p.type === 'archmage') {
          // defenders stay home: step off the spawn squares toward the front of the base
          goals = C.rallyGoals(b, 3, 3);
        } else if (mem.enemyBase) goals = T.attackPositions(p.type, mem.enemyBase.r, mem.enemyBase.c);
        else goals = C.rallyGoals(b, 3, 3);
        const mv = moveUnit(b, p, goals, P.threatW);
        if (mv) return mv;
      }
      return null;
    }

    function recruitStep(b, kill) {
      if (!b.myBase) return null;
      if (b.myUnits.length >= T.CONFIG.maxUnits || !T.spawnTiles(b).length) return null;
      if (kill && kill.plan) {
        for (const s of kill.plan.list) if (!b.at.has(key(s.r, s.c)) && b.gold >= UNITS[s.type].cost) return { type: 'recruit', unit: s.type, r: s.r, c: s.c };
      }
      // defence: visible intruders near my base (they are usually hunting the battery)
      const intr = C.intruders(b, mem, P.defendRadius).filter(e => b.vis.has(key(e.r, e.c)));
      if (intr.length) {
        if (b.gold >= 12) {
          let bs = -1, bk = null;
          for (const k of T.spawnTiles(b).sort(byTie(b))) {
            const s = T.auraValueAt(b, rowOf(k), colOf(k), 4, 3, W);
            if (s > bs + 1e-9) { bs = s; bk = k; }
          }
          if (bk !== null && bs >= P.auraMin) return { type: 'recruit', unit: 'archmage', r: rowOf(bk), c: colOf(bk) };
        }
        const e = intr.slice().sort((x, y) => cheb(x.r, x.c, b.myBase.r, b.myBase.c) - cheb(y.r, y.c, b.myBase.r, b.myBase.c) || T.tieKey(b.me, x.r, x.c) - T.tieKey(b.me, y.r, y.c))[0];
        const at = T.pickSpawn(b, e), d = cheb(at.r, at.c, e.r, e.c);
        if (d <= 1 && b.gold >= 1) return { type: 'recruit', unit: 'footman', r: at.r, c: at.c };
        if (d <= 3 && b.gold >= 1) return { type: 'recruit', unit: 'slinger', r: at.r, c: at.c };
      }
      const sc = b.myUnits.filter(u => u.type === 'scout').length;
      const wantSc = mem.enemyBase ? P.spotters : P.scouts;
      if (sc < wantSc && b.gold >= 1) {
        const at = T.pickSpawn(b, mem.enemyBase || undefined);
        return { type: 'recruit', unit: 'scout', r: at.r, c: at.c };
      }
      const keep = b.turn >= P.allInTurn ? 0 : P.keep;
      if (b.gold - 8 >= keep) {
        let at = null;
        if (b.enemyBase) {
          // a square the base is in range of, so the new Sniper fires on arrival
          const tiles = T.spawnTiles(b).filter(k => cheb(rowOf(k), colOf(k), b.enemyBase.r, b.enemyBase.c) <= 8).sort(byTie(b));
          if (tiles.length) at = { r: rowOf(tiles[0]), c: colOf(tiles[0]) };
        }
        if (!at) at = T.pickSpawn(b, mem.enemyBase || undefined);
        return { type: 'recruit', unit: 'sniper', r: at.r, c: at.c };
      }
      return null;
    }

    return {
      place(view) { return C.placeBase(view, rng, P.baseDepth, P.baseJitter); },
      act(view) {
        const b = T.board(view, mem);
        mem.update(b);
        if (b.turn !== turn) { turn = b.turn; done.clear(); }
        const kill = killCheck(b);
        const a = attacks(b, !!kill);
        if (a) return a;
        if (kill) { const r = recruitStep(b, kill); if (r) return r; }
        const m = moveOthers(b); if (m) return m;   // snipers step into the ring first (they reveal the base)
        const s = controlScouts(b); if (s) return s;
        const r = recruitStep(b, null); if (r) return r;
        return { type: 'end' };
      },
    };
  },
};

},
"lab/bots/g2_eco_aegis.js": function (require, module, exports, __ENGINE__, __nodeRequire__) {
'use strict';
/* g2_eco_aegis — ECONOMIST. Banks gold as an "instant aura": a recruit can attack on arrival, and an
   Archmage's aura (3 dmg to EVERY enemy within 4) one-shots every Slinger near it. So the bank is the
   defence: whenever visible enemies come within reach of the spawn zone, the bot buys an Archmage on
   the spawn square that catches the most of them and wipes the wave the turn it is bought. Gold not
   needed for that sits at 16+ for full interest. Once a core of Archmages plus a Footman screen is
   built (or a turn deadline passes) the whole block walks on the enemy base, the Archmages auraing
   everything around them (base included) while a home reserve keeps one instant Archmage in the bank.
   Walk-1 mages cannot catch range-8 Snipers, so once Snipers are seen the surplus also buys an
   Assassin hunter pack (move 3 + shoot 3 in one turn) that chases shooters near the base or army. */
const T = require('../toolkit');
const C = require('./_common');
const { N, UNITS, CONFIG, key, rowOf, colOf, cheb } = T;

module.exports = {
  name: 'g2_eco_aegis',
  description: 'Bank = instant Archmage auras vs swarms; build a mage core, then walk it onto the enemy base.',
  params: {
    baseDepth:   { type: 'int',   default: 1,   min: 0, max: 9, help: 'base row depth (0 = back row)' },
    baseJitter:  { type: 'int',   default: 3,   min: 0, max: 8, help: 'random column offset from centre' },
    bank:        { type: 'int',   default: 16,  min: 0, max: 40, help: 'gold kept in reserve while building' },
    mages:       { type: 'int',   default: 3,   min: 0, max: 10, help: 'Archmages in the core' },
    screen:      { type: 'int',   default: 6,   min: 0, max: 16, help: 'cheap screen units (Footman/Slinger)' },
    slingerShare:{ type: 'float', default: 0.35, min: 0, max: 1, help: 'share of the screen that are Slingers' },
    scouts:      { type: 'int',   default: 1,   min: 0, max: 4, help: 'Scouts (vision for auras + search)' },
    auraMin:     { type: 'float', default: 2.5, min: 0, max: 12, help: 'min aura value to buy an emergency Archmage' },
    defendRadius:{ type: 'int',   default: 5,   min: 2, max: 9, help: 'enemies this close to base trigger arrival defenders' },
    guardRadius: { type: 'int',   default: 2,   min: 1, max: 5, help: 'ring the home block stands on' },
    pushMages:   { type: 'int',   default: 3,   min: 1, max: 10, help: 'Archmages needed before marching' },
    pushTurn:    { type: 'int',   default: 26,  min: 8, max: 60, help: 'march anyway from this turn' },
    homeKeep:    { type: 'int',   default: 12,  min: 0, max: 40, help: 'gold kept at home once marching' },
    homeMages:   { type: 'int',   default: 1,   min: 0, max: 4, help: 'Archmages that stay at home during the march' },
    escortDist:  { type: 'int',   default: 1,   min: 0, max: 4, help: 'how far ahead of the mages the escort walks' },
    hunters:     { type: 'int',   default: 12,  min: 0, max: 16, help: 'hunters bought once long-range enemies (Snipers) show up' },
    hunter:      { type: 'choice', default: 'assassin', choices: ['assassin', 'dragon', 'cavalry'], help: 'hunter unit type' },
    sniperPush:  { type: 'int',   default: 3,   min: 1, max: 12, help: 'Archmages needed to march once enemy Snipers are seen' },
    huntRadius:  { type: 'int',   default: 9,   min: 3, max: 19, help: 'hunters chase known enemies this close to my base or army' },
    engageRadius:{ type: 'int',   default: 3,   min: 0, max: 12, help: 'marching mages divert to known enemies this close' },
    threatW:     { type: 'float', default: 0.6, min: 0, max: 4 },
    basePriority:{ type: 'float', default: 3,   min: 0, max: 8 },
    chaseMin:    { type: 'float', default: 0.3, min: 0, max: 4, help: 'min attack score while on the move' },
    depthBias:   { type: 'float', default: 0.3, min: 0, max: 2, help: 'base search: prefer deep squares' },
    heatBias:    { type: 'float', default: 0.6, min: 0, max: 2, help: 'base search: prefer where enemies were seen' },
  },
  create({ seat, params: P, rng }) {
    const mem = new T.Memory(seat, { forgetAfter: 3 });
    const W = Object.assign({}, T.DEFAULT_WEIGHTS, { basePriority: P.basePriority });
    let marching = false;
    const role = new Map();   // id -> 'home' | 'army'
    const fwd = T.forwardDir(seat);

    const auraValueAt = (b, r, c) => {
      let v = 0, n = 0;
      for (const q of b.enemies) {
        if (cheb(q.r, q.c, r, c) > 4) continue;
        if (q.kind === 'base') { v += P.basePriority; n++; continue; }
        const pv = q.kind === 'ward' ? 1.5 : T.pieceValue(q);
        const eff = Math.min(3, q.hp);
        v += pv * eff / q.maxHp + (3 >= q.hp ? pv : 0); n++;
      }
      return { v, n };
    };

    function homeGoals(b, p) {
      const base = b.myBase;
      if (!base) return [];
      // long-range shooters parked around my base: the home block walks out and auras them
      const far = mem.knownEnemyUnits(2, b.turn).filter(e => e.type !== 'scout' && cheb(e.r, e.c, base.r, base.c) <= P.huntRadius);
      if (far.length && (p.type === 'archmage' || p.type === 'footman') && far.some(e => e.type === 'sniper')) {
        const out = new Set();
        for (const e of far) for (const k of T.attackPositions(p.type, e.r, e.c)) out.add(k);
        if (out.size) return [...out];
      }
      const intr = C.intruders(b, mem, P.defendRadius + 2);
      if (intr.length && UNITS[p.type].attack) {
        const out = new Set();
        for (const e of intr) for (const k of T.attackPositions(p.type, e.r, e.c)) if (cheb(rowOf(k), colOf(k), base.r, base.c) <= P.defendRadius + 1) out.add(k);
        if (out.size) return [...out];
      }
      const R = p.type === 'archmage' ? 1 : P.guardRadius;
      return C.defendGoals(b, mem, p, R, 0);
    }

    function enemyBaseTarget(b, from) {
      if (mem.enemyBase) return mem.enemyBase;
      return mem.baseGuess(from, P.depthBias, P.heatBias);
    }

    // known enemy units near my base or my army (fresh sightings + danger spots)
    function huntTargets(b) {
      if (b.cache.hunt) return b.cache.hunt;
      const anchors = b.myUnits.filter(u => u.type !== 'scout' && u.type !== P.hunter).map(u => ({ r: u.r, c: u.c }));
      if (b.myBase) anchors.push(b.myBase);
      const known = mem.knownEnemyUnits(2, b.turn).filter(e => anchors.some(a => cheb(a.r, a.c, e.r, e.c) <= P.huntRadius));
      return (b.cache.hunt = known);
    }
    function huntGoals(b, p) {
      const ts = huntTargets(b);
      if (!ts.length) return [];
      // prefer long-range shooters (they are what the mage block cannot catch), then nearest
      let best = null, bs = 1e9;
      for (const e of ts) {
        const s = cheb(e.r, e.c, p.r, p.c) - (e.type === 'sniper' ? 6 : e.type === 'scout' ? 2 : 0) + T.tieKey(seat, e.r, e.c) / 1e4;
        if (s < bs) { bs = s; best = e; }
      }
      return T.attackPositions(p.type, best.r, best.c);
    }

    function armyGoals(b, p) {
      if (p.type === 'archmage' && P.engageRadius > 0) {
        const near = mem.knownEnemyUnits(1, b.turn).filter(e => e.type !== 'scout' && e.type !== 'sniper' && cheb(e.r, e.c, p.r, p.c) <= P.engageRadius);
        if (near.length) {
          const out = new Set();
          for (const e of near) for (const k of T.attackPositions('archmage', e.r, e.c)) out.add(k);
          return [...out];
        }
      }
      const mages = b.myUnits.filter(u => u.type === 'archmage' && role.get(u.id) === 'army');
      const tgt = enemyBaseTarget(b, mages[0] || p);
      if (!tgt) return [];
      if (p.type === 'archmage' || !mages.length) return T.attackPositions(p.type === 'scout' ? 'archmage' : p.type, tgt.r, tgt.c);
      // escort: stay with the leading mage, a little ahead of it toward the target
      let lead = null, ld = 1e9;
      for (const m of mages) { const d = cheb(m.r, m.c, tgt.r, tgt.c) * 100 + T.tieKey(seat, m.r, m.c) / 1000; if (d < ld) { ld = d; lead = m; } }
      if (cheb(lead.r, lead.c, tgt.r, tgt.c) <= 5) return T.attackPositions(p.type, tgt.r, tgt.c);
      // a forward arc at distance escortDist+1 of the lead mage: never boxes the mage in
      const R = P.escortDist + 1, dl = cheb(lead.r, lead.c, tgt.r, tgt.c), out = [];
      for (let r = lead.r - R; r <= lead.r + R; r++) for (let c = lead.c - R; c <= lead.c + R; c++)
        if (T.inB(r, c) && cheb(r, c, lead.r, lead.c) === R && cheb(r, c, tgt.r, tgt.c) < dl) out.push(key(r, c));
      return out;
    }

    const cmdr = new T.Commander(mem, {
      weights: W,
      minAttackFor() { return Infinity; },   // attacks are chosen in act() before arrival recruits
      goalFor(p, b) {
        if (p.type === 'scout') {
          if (!mem.enemyBase) return { goals: C.searchGoals(b, mem, p, 12, 0), threatW: P.threatW * 2 };
          if (role.get(p.id) === 'army') return { goals: armyGoals(b, p), threatW: P.threatW };
          return { goals: homeGoals(b, p), threatW: P.threatW };
        }
        if (p.type === P.hunter) { const g = huntGoals(b, p); if (g.length) return { goals: g, threatW: P.threatW * 0.5 }; }
        if (role.get(p.id) === 'army') { const g = armyGoals(b, p); return { goals: g, threatW: p.type === 'archmage' ? 0 : P.threatW }; }
        return { goals: homeGoals(b, p), threatW: 0 };
      },
    });

    const reachOf = t => { const a = UNITS[t].attack; if (!a) return -1; return a.type === 'melee' || a.type === 'cleave' ? 1 : (a.range || 1); };
    function inReach(b, p) {
      const R = reachOf(p.type);
      if (R < 0) return UNITS[p.type].heal ? true : false;
      for (const q of b.enemies) if (cheb(q.r, q.c, p.r, p.c) <= R) return true;
      return false;
    }

    function count(b, type) { return b.myUnits.filter(u => u.type === type).length; }

    function recruitAt(b, type, r, c) { return { type: 'recruit', unit: type, r, c }; }

    // Emergency: buy a unit that hits on arrival.
    function emergency(b) {
      if (!b.myBase || b.myUnits.length >= CONFIG.maxUnits) return null;
      const near = b.enemies.filter(q => q.kind !== 'base' && cheb(q.r, q.c, b.myBase.r, b.myBase.c) <= P.defendRadius + 2);
      if (!near.length) return null;
      const tiles = T.spawnTiles(b);
      if (!tiles.length) return null;
      if (b.gold >= UNITS.archmage.cost) {
        let best = null, bv = -1, bt = 1e9;
        for (const k of tiles) {
          const { v } = auraValueAt(b, rowOf(k), colOf(k));
          const t = T.tieKey(seat, rowOf(k), colOf(k));
          if (v > bv + 1e-9 || (Math.abs(v - bv) <= 1e-9 && t < bt)) { bv = v; bt = t; best = k; }
        }
        if (best !== null && bv >= P.auraMin) return recruitAt(b, 'archmage', rowOf(best), colOf(best));
      }
      // cheap arrival defenders vs anything threatening the base itself
      const close = near.filter(q => cheb(q.r, q.c, b.myBase.r, b.myBase.c) <= P.defendRadius)
        .sort((x, y) => x.hp - y.hp || T.tieKey(seat, x.r, x.c) - T.tieKey(seat, y.r, y.c));
      for (const q of close) {
        for (const type of ['footman', 'slinger']) {
          if (b.gold < 1) return null;
          let best = null, bt = 1e9;
          for (const k of tiles) {
            const r = rowOf(k), c = colOf(k), d = cheb(r, c, q.r, q.c);
            if (type === 'footman' ? d !== 1 : d > 3) continue;
            const t = T.tieKey(seat, r, c);
            if (t < bt) { bt = t; best = k; }
          }
          if (best !== null) return recruitAt(b, type, rowOf(best), colOf(best));
        }
      }
      return null;
    }

    function build(b) {
      if (!b.myBase || b.myUnits.length >= CONFIG.maxUnits) return null;
      const keep = marching ? P.homeKeep : P.bank;
      const avail = b.gold - keep;
      const nMage = count(b, 'archmage'), nScout = count(b, 'scout');
      const nScreen = count(b, 'footman') + count(b, 'slinger');
      const toward = mem.enemyBase || null;
      if (nScout < P.scouts && avail >= 1 && (!mem.enemyBase || nScout === 0)) return C.recruit(b, 'scout', toward);
      const longRange = (mem.enemyRecruitsSeen.sniper || 0) > 0;
      if (longRange && count(b, P.hunter) < P.hunters && nMage >= 1) {
        if (b.gold - Math.min(keep, UNITS.archmage.cost) >= UNITS[P.hunter].cost) return C.recruit(b, P.hunter, toward);
        if (nMage >= Math.min(2, P.mages)) return null;
      }
      if (nMage < P.mages) {
        if (avail >= UNITS.archmage.cost) return C.recruit(b, 'archmage', toward);
        // save up, but keep a minimal screen
        if (nScreen >= Math.min(2, P.screen)) return null;
      }
      if (nScreen < P.screen || (nMage >= P.mages && b.turn >= 8)) {
        if (avail < 1) return null;
        const sl = count(b, 'slinger');
        const type = sl < P.slingerShare * (nScreen + 1) ? 'slinger' : 'footman';
        if (nScreen >= P.screen && nMage >= P.mages) {
          // late game: gold into more mages if affordable, else bodies
          if (avail >= UNITS.archmage.cost) return C.recruit(b, 'archmage', toward);
          if (b.gold < 30) return null;
        }
        return C.recruit(b, type, toward);
      }
      return null;
    }

    function assignRoles(b) {
      const alive = new Set(b.myUnits.map(u => u.id));
      for (const id of [...role.keys()]) if (!alive.has(id)) role.delete(id);
      const mages = b.myUnits.filter(u => u.type === 'archmage').sort((a, c) => a.id - c.id);
      const snipers = (mem.enemyRecruitsSeen.sniper || 0) > 0;
      const need = snipers ? Math.max(P.pushMages, P.sniperPush) : P.pushMages;
      const homeClear = !b.myBase || !mem.knownEnemyUnits(2, b.turn).some(e => e.type !== 'scout' && cheb(e.r, e.c, b.myBase.r, b.myBase.c) <= P.huntRadius);
      if (!marching && mages.length >= need && b.turn >= 6 && (homeClear || !snipers)) marching = true;
      if (!marching && b.turn >= P.pushTurn && mages.length >= 1) marching = true;
      if (!marching) { for (const u of b.myUnits) role.set(u.id, 'home'); return; }
      // first homeMages mages (oldest) and a few screen units stay home; the rest march
      let homeM = 0;
      for (const m of mages) {
        if (role.get(m.id) === 'army') continue;
        if (homeM < P.homeMages && mages.length > P.homeMages) { role.set(m.id, 'home'); homeM++; }
        else role.set(m.id, 'army');
      }
      for (const u of b.myUnits) if (u.type !== 'archmage' && !role.has(u.id)) role.set(u.id, 'army');
      for (const u of b.myUnits) if (u.type !== 'archmage' && role.get(u.id) === 'home') role.set(u.id, 'army');
      // keep the home mage stationary-ish; reassign only by id order (deterministic)
      const homeMs = mages.filter(m => role.get(m.id) === 'home');
      if (homeMs.length > P.homeMages) for (const m of homeMs.slice(P.homeMages)) role.set(m.id, 'army');
    }

    return {
      place(view) { return C.placeBase(view, rng, P.baseDepth, P.baseJitter); },
      act(view) {
        const b = T.board(view, mem);
        mem.update(b);
        assignRoles(b);
        // 1) attacks by units already on the board
        let best = null;
        for (const p of b.myUnits) {
          if (!T.canAct(p) || !inReach(b, p)) continue;
          const th = (role.get(p.id) === 'army' && p.type !== 'archmage') ? C.offensiveThreshold(b, mem, p, P.chaseMin) : 0.05;
          const a = T.bestAttack(b, p, W);
          if (a && a.score >= th && (!best || a.score > best.score + 1e-9)) best = a;
        }
        if (best) return best.cmd;
        // 2) arrival defenders
        const e = emergency(b);
        if (e) return e;
        // 3) moves
        const cmd = cmdr.next(b);
        if (cmd) return cmd;
        // 4) economy
        const r = build(b);
        if (r) return r;
        return { type: 'end' };
      },
    };
  },
};

}
  };
  const cache = {};
  const norm = p => { const out = []; for (const s of p.split("/")) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); } return out.join("/"); };
  function resolve(from, req) {
    const p = norm(from.split("/").slice(0, -1).join("/") + "/" + req);
    for (const c of [p, p + ".js", p + "/index.js"]) if (defs[c]) return c;
    throw new Error("module not found: " + req + " (from " + from + ")");
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} }; cache[id] = module;
    defs[id](r => load(resolve(id, r)), module, module.exports, ENGINE_PATH, NODE_REQUIRE);
    return module.exports;
  }
  return { require: load };
})();

const rngLib = LAB.require("lab/runner/rng.js");

// Fill in a bot's declared parameters and clamp to the declared ranges (same as the lab runner).
function resolveParams(mod, params) {
  const out = {};
  for (const [k, d] of Object.entries(mod.params || {})) {
    let v = params && params[k] !== undefined ? params[k] : d.default;
    if (d.type === "int") v = Math.round(v);
    if (d.type === "int" || d.type === "float") { if (d.min !== undefined) v = Math.max(d.min, v); if (d.max !== undefined) v = Math.min(d.max, v); }
    if (d.type === "bool") v = !!v;
    out[k] = v;
  }
  return out;
}

/* create(id, seat, seed) -> { id, label, seat, place(view), act(view) }; id "random" picks one of CHOICES. */
function create(id, seat, seed) {
  const choice = id === "random" ? CHOICES[Math.floor(Math.random() * CHOICES.length)] : CHOICES.find(c => c.id === id);
  if (!choice) throw new Error("Unknown bot: " + id);
  const mod = LAB.require("lab/bots/" + choice.bot + ".js");
  seed = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
  const inst = mod.create({ seat, params: resolveParams(mod, choice.params), rng: rngLib.makeRng(seed), seed });
  return { id: choice.id, label: choice.label, bot: choice.bot, params: choice.params, seat, seed,
    place: view => inst.place(view), act: view => inst.act(view) };
}

const api = { CHOICES, create, resolveParams };
if (typeof module !== "undefined" && module.exports) module.exports = api; else globalThis.FoglineBots = api;
