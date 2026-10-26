"""Build bots.js — the single file of AI opponents the Fogline server loads.

    python3 build/build_bots.py <lab folder> <out file> [--pick label[,label...]]

The lab folder is fogline-online/lab from a playtest handoff. Opponents are taken from
<lab>/results/pool.json (the current league pool, tuned params included). --pick limits
the offered bots to those pool labels (default: a built-in list, falling back to the whole pool).

bots.js is self-contained: the lab's rng, toolkit, _common helpers and the bot modules are
bundled behind a tiny CommonJS loader; the engine itself is required from ./public/game.js at run
time, so the bots always play by whatever rules the site is running. To change the opponents
later: either rebuild from a newer lab, or edit the CHOICES list at the top of bots.js by hand
(labels, descriptions, params, or dropping an entry)."""
import json, sys, datetime, pathlib

args = sys.argv[1:]
pick = None
if '--pick' in args:
    i = args.index('--pick'); pick = args[i + 1].split(','); del args[i:i + 2]
LAB, OUT = args[0].rstrip('/'), args[1]
P = pathlib.Path(LAB)

pool = json.load(open(P / 'results' / 'pool.json'))
by_label = {e['label']: e for e in pool}
# Phase 1 pool bots that actually attack an undefended base (Blades and Fog Sniper sit at the unit cap forever against a passive player).
DEFAULT_PICK = ['g3_agg_creep_t', 'g3_agg_battery_t', 'g2_eco_aegis_t']
labels = pick or [l for l in DEFAULT_PICK if l in by_label] or [e['label'] for e in pool]
missing = [l for l in labels if l not in by_label]
assert not missing, f'not in pool.json: {missing}'

NICE = {  # short names shown in the lobby; anything not listed falls back to the pool label
    'g3_agg_creep_t': 'Creep (Gen 3 champion)', 'g3_agg_battery_t': 'Battery (Gen 3)', 'g2_eco_aegis_t': 'Aegis (Gen 2)',
    'g2_eco_blades_t': 'Blades (Gen 2 champion)', 'g1_fog_sniper': 'Fog Sniper (Gen 1)', 'g3_eco_battery': 'Eco Battery (Gen 3)',
    'g1_agg_hammer_t': 'Hammer (Gen 1 champion)', 'g3_fog_battery_t': 'Fog Battery (Gen 3)',
}

def description_of(bot_file):
    src = open(bot_file).read()
    i = src.find("description:")
    if i < 0: return ''
    q = src[i + len('description:'):].lstrip()
    quote = q[0]
    return q[1:q.index(quote, 1)] if quote in "'\"`" else ''

choices, modules = [], {}
for lab in labels:
    e = by_label[lab]
    bot = e['bot']
    f = P / 'bots' / f'{bot}.js'
    modules[f'lab/bots/{bot}.js'] = f.read_text()
    choices.append({'id': lab, 'label': NICE.get(lab, lab), 'bot': bot, 'params': e.get('params', {}),
                    'description': description_of(f), 'note': e.get('note', '')})

common = (P / 'bots' / '_common.js').read_text()
# Rules v2: bases must keep baseMinDepth rows from the middle; clamp the bots' chosen depth to the legal zone
# (identical under rules where baseMinDepth is 0).
old = "const r = T.rowForDepth(seat, Math.max(0, Math.min(N / 2 - 1, depth)));"
if old in common:
    common = common.replace(old, "const r = T.rowForDepth(seat, Math.max(0, Math.min(N / 2 - 1 - (CONFIG.baseMinDepth || 0), depth)));")

mods = {
    'public/game.js': 'module.exports = typeof window !== "undefined" && window.Fogline ? window.Fogline : __nodeRequire__(__ENGINE__);',
    'lab/runner/rng.js': (P / 'runner' / 'rng.js').read_text(),
    'lab/toolkit/index.js': (P / 'toolkit' / 'index.js').read_text(),
    'lab/bots/_common.js': common,
}
mods.update(modules)

defs = ",\n".join(f'{json.dumps(k)}: function (require, module, exports, __ENGINE__, __nodeRequire__) {{\n{v}\n}}' for k, v in mods.items())
out = f'''/* Fogline Tactics — AI opponents (one file). Generated {datetime.date.today().isoformat()} by build/build_bots.py from {P.name}
   (pool: {", ".join(labels)}).
   The server loads this with require("./bots.js"). Edit CHOICES to change what the lobby offers, or rebuild
   from a newer lab folder. Everything below CHOICES is the lab's own code, bundled unchanged except for
   the base-placement clamp noted in _common.js. */
"use strict";

const CHOICES = {json.dumps(choices, indent=2)};

/* ---- bundled lab modules ---- */
const NODE_REQUIRE = typeof require === "function" ? require : null;
const ENGINE_PATH = typeof __dirname !== "undefined" ? NODE_REQUIRE("path").join(__dirname, "public", "game.js") : "./public/game.js";
const LAB = (() => {{
  const defs = {{
{defs}
  }};
  const cache = {{}};
  const norm = p => {{ const out = []; for (const s of p.split("/")) {{ if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); }} return out.join("/"); }};
  function resolve(from, req) {{
    const p = norm(from.split("/").slice(0, -1).join("/") + "/" + req);
    for (const c of [p, p + ".js", p + "/index.js"]) if (defs[c]) return c;
    throw new Error("module not found: " + req + " (from " + from + ")");
  }}
  function load(id) {{
    if (cache[id]) return cache[id].exports;
    const module = {{ exports: {{}} }}; cache[id] = module;
    defs[id](r => load(resolve(id, r)), module, module.exports, ENGINE_PATH, NODE_REQUIRE);
    return module.exports;
  }}
  return {{ require: load }};
}})();

const rngLib = LAB.require("lab/runner/rng.js");

// Fill in a bot's declared parameters and clamp to the declared ranges (same as the lab runner).
function resolveParams(mod, params) {{
  const out = {{}};
  for (const [k, d] of Object.entries(mod.params || {{}})) {{
    let v = params && params[k] !== undefined ? params[k] : d.default;
    if (d.type === "int") v = Math.round(v);
    if (d.type === "int" || d.type === "float") {{ if (d.min !== undefined) v = Math.max(d.min, v); if (d.max !== undefined) v = Math.min(d.max, v); }}
    if (d.type === "bool") v = !!v;
    out[k] = v;
  }}
  return out;
}}

/* create(id, seat, seed) -> {{ id, label, seat, place(view), act(view) }}; id "random" picks one of CHOICES. */
function create(id, seat, seed) {{
  const choice = id === "random" ? CHOICES[Math.floor(Math.random() * CHOICES.length)] : CHOICES.find(c => c.id === id);
  if (!choice) throw new Error("Unknown bot: " + id);
  const mod = LAB.require("lab/bots/" + choice.bot + ".js");
  seed = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
  const inst = mod.create({{ seat, params: resolveParams(mod, choice.params), rng: rngLib.makeRng(seed), seed }});
  return {{ id: choice.id, label: choice.label, bot: choice.bot, params: choice.params, seat, seed,
    place: view => inst.place(view), act: view => inst.act(view) }};
}}

const api = {{ CHOICES, create, resolveParams }};
if (typeof module !== "undefined" && module.exports) module.exports = api; else globalThis.FoglineBots = api;
'''
pathlib.Path(OUT).write_text(out)
print(f'wrote {OUT}: {len(out)} chars, {len(choices)} opponents: {", ".join(c["label"] for c in choices)}')
