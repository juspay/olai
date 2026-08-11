# RCA: Slow initial roadmap load (web UI)

**Date:** 2026-08-11  
**Scope:** Measurement and root-cause analysis only — no product code changes.  
**Worktree:** `load-perf`  
**Repro:** `scripts/load-perf/run.sh` (or `bun scripts/load-perf/measure.mjs` inside `nix develop .#e2e`)  
**Raw numbers:** `scripts/load-perf/out/` (JSON + text summaries; Playwright traces when `TRACE=1`)

---

## Executive summary

The server is **not** the bottleneck. Opening and validating the ledger costs about **1 ms** of pure CPU and the process is listening within ~**25–30 ms** of its own serve span (~**320 ms** including process spawn).  

What the user feels is almost entirely **browser main-thread work before outline rows appear**:

1. **Dominant (loopback and Tailscale alike):** load + parse/eval of a **~977 KB uncompressed** client module (`main-*.js`). Source-map attribution: **~58% Effect**, plus markdown stack + highlight.js languages + `@kolu/surface`. Two long tasks (~**65–80 ms** + ~**60–70 ms**) sit on the path from navigation to rows.  
2. **Secondary (large for `docs/`, small for MyOlai):** initial WebSocket snapshot is **~212 KB** for `docs/` (5 inbound frames), of which the **largest frame (~124 KB) is the `manifest` carrying full `.md` document texts** that the roadmap tree does not need on first paint. Outline nodes alone are ~**88 KB** JSON.  
3. **Negligible:** shell TTFB (~2 ms), WS handshake (~1–2 ms), server decode/validate/derive (~1 ms).

**Concrete first fix (expected win):** enable **gzip/brotli for static assets** (977 KB → ~309 KB gzip). That does not shrink parse cost, but is free on the wire and matters on non-loopback links; pair it with **code-splitting the markdown/highlight pipeline** (and later: documents-as-collection so full `.md` text is not on the first snapshot) to cut the long tasks that dominate time-to-rows on a fast LAN.

---

## What was measured

| Surface | How |
|--------|-----|
| **Dev serve** | `bun packages/server/src/main.ts web <dir>` with `OLAI_DIST_DIR=packages/web/dist` (`MODE=dev`) |
| **Nix binary** | `nix build .#olai` → `/bin/olai web …` (same artefact as e2e / home-manager) |
| **Production** | Live systemd unit: `olai web ~/Dropbox/MyOlai --port 7733 --host 100.78.88.70` (Tailscale) |
| **Ledgers** | `docs/` (roadmap + architecture notes) and `~/Dropbox/MyOlai` (personal Tasks/Daily) |

Agent disabled (`OLAI_ACP_AGENT=`) for isolation; chat boot is after `serving` and is not on the critical path for rows.

Browser timings: Playwright Chromium, Performance API (navigation + paint + resource), CDP WebSocket frames, `PerformanceObserver` long tasks, CDP `Performance.getMetrics`.

---

## Hard numbers

### 1. Server cold start → listening

| Mode | Ledger | Process → HTTP 200 (mean) | `serve=…ms` log span |
|------|--------|---------------------------|----------------------|
| nix | `docs/` | **~330 ms** | **~29 ms** |
| nix | MyOlai | **~321 ms** | **~25 ms** |
| dev (`bun main.ts`) | `docs/` | **~273 ms** | **~28 ms** |

Process spawn (bun + Effect CLI) dominates cold start; the serve span itself is tens of milliseconds. **A warm, already-running production instance does not pay this on each page load.**

### 2. App shell TTFB + assets

On loopback against the nix binary (`docs/`):

| Resource | Bytes on wire | TTFB / total |
|----------|---------------|--------------|
| `GET /` (shell) | 4 553 | **~2 ms** |
| `styles-*.css` | ~29–32 KB | **~2 ms** |
| `main-*.js` | **976 652** | **~3–6 ms** download |

**Gzip probe:** `Accept-Encoding: gzip, deflate, br` → `content-encoding: null`, still **976 652** bytes received.  
**Local gzip of the same file:** **309 140** bytes (~3.2×). The server is not compressing static assets.

Production over Tailscale (same machine fabric): shell ~10 ms; main.js still full size in ~4 ms (fast link). Parse cost remains.

### 3. WebSocket surface handshake + outline payload

Route under test for the project plan: **`/o/roadmap.jsonl`**.

| Metric | `docs/` (roadmap) | MyOlai `/` |
|--------|-------------------|------------|
| Handshake | **~0.7–2 ms** (101) | **~1 ms** |
| Inbound frames | **5** | **5** |
| Inbound bytes | **212 298** | **~9–19 KB** |
| Largest inbound frame | **124 193** | **~9 KB** |
| Outbound frames / bytes | 9 / ~1 KB | 9 / ~1 KB |
| Time to first inbound frame after open | ~15–18 ms | ~5–12 ms |

**Payload composition (`docs/`, offline estimate matching wire):**

| Piece | Size |
|-------|------|
| Outline JSONL on disk | ~84 KB (`roadmap.jsonl` + `Archive.jsonl`) |
| `Located[]` as JSON | **~88 KB** (65 nodes) |
| `.md` document **texts** (12 files) | **~121 KB** raw / **~124 KB** JSON |
| Full `OutlineSet` JSON | ~212 KB |

The largest WS frame (~124 KB) lines up with the **manifest documents array** (full markdown bodies), not the roadmap rows. Design already notes documents-as-collection as the next step (`packages/surface/src/index.ts`).

### 4. Browser: navigation → rows painted

Playwright cold context, Chromium, desktop 1440×900 unless noted. Times from navigation start.

| Scenario | First paint | FCP | First `[data-testid=node]` | Nodes drawn | Connection `live` |
|----------|-------------|-----|----------------------------|-------------|-------------------|
| nix + `docs` `/o/roadmap.jsonl` | ~40 ms | ~168 ms | **~255–365 ms** | **63** | ~same as first node |
| dev + same | ~24 ms | ~120 ms | **~255 ms** | 63 | ~ |
| nix + MyOlai `/` | ~32 ms | ~116 ms | **~190–220 ms** | 4 top-level | ~ |
| production Tailscale MyOlai | ~28 ms | ~120 ms | **~191 ms** | 4 | ~ |
| phone viewport (390×844) roadmap | ~20 ms | ~116 ms | **~234 ms** | 63 | ~ |
| warm HTTP cache, same context, roadmap | — | — | **~184 ms** | 63 | — |

**Warm cache still ~180+ ms** → loopback **download** of main.js is not the dominant term; **main-thread evaluation + surface connect + first render** are.

`settledMs` in early runs included an artificial sleep; use **first node** / **liveMs**, not that field.

### 5. Server-side load / validate / derive (microbench)

In-process, pre-read files, mean of 30 reps:

| Ledger | decode | validate | derive | total | shape |
|--------|--------|----------|--------|-------|-------|
| `docs/` | **0.86 ms** | **0.26 ms** | **0.03 ms** | **~1.15 ms** | 2 outlines, 65 nodes, 12 docs |
| MyOlai | **0.44 ms** | **0.19 ms** | **0.03 ms** | **~0.66 ms** | 4 outlines, 55 nodes, 0 docs |

**Evidence:** server content path is ~**two orders of magnitude** faster than time-to-rows. Not the cause of “slow load.”

### 6. Client bundle profile (source map, unminified content lengths)

`packages/web/dist/assets/main-*.js`: **976 652 B** raw / **309 140 B** gzip.

| Bucket (source-map content) | Share |
|----------------------------|-------|
| **effect** | **~58%** |
| markdown stack (unified/remark/rehype/…) | ~10% |
| @kolu | ~9% |
| **highlight.js** (core + many languages) | **~7%** |
| solid-js | ~2% |
| msgpackr | ~1% |
| other | rest |

Markdown is only fully rendered on expanded notes / document pages / chat (`Note.tsx`, `markdown/render.ts`); collapsed rows use `plainLine` (cheap). The stack is still **eagerly bundled and evaluated** on every cold load.

### 7. Main-thread long tasks (roadmap, loopback)

Representative CDP/PO run:

| Window (ms from nav) | Duration | Interpretation |
|----------------------|----------|----------------|
| ~45 → ~124 | **~65–80 ms** | Module script evaluation (download ends ~11 ms; DCL/load ~100 ms) |
| ~165–183 → ~230–250 | **~60–70 ms** | Surface connect + schema decode of ~212 KB snapshot + first Solid tree of 63 rows |

CDP `ScriptDuration` ≈ **78 ms** for the session — consistent with the first long task.

---

## Phase breakdown (docs roadmap, typical loopback)

```
0 ──► 4 ms     HTML shell (TTFB ~2 ms)
4 ──► 11 ms    main.js download (~977 KB, uncompressed)
11 ──► ~100 ms  ★ LONG TASK: parse/eval module (~70–80 ms)  ← DOMContentLoaded/load
100 ──► ~130 ms FCP of chrome (sidebar shell, not rows)
~130 ──► ~170 ms WS open + snapshot frames (handshake ~1 ms; payload ~212 KB)
~170 ──► ~260–350 ms ★ LONG TASK: decode + derive + paint 63 nodes
```

**Dominant term with evidence:** the **client JS module** (size + main-thread eval). Secondary: **initial surface snapshot size** when the directory holds large `.md` files (all shipped on first subscribe). Server open/validate is noise.

MyOlai proves the split: **~9–19 KB** wire but still **~200 ms** to first nodes → even with a tiny payload, the bundle path remains.

---

## What is *not* the problem

- Git commit hooks, agent ACP boot (starts after `serving`; disabled in these runs).  
- Store probe/validate for these ledger sizes (~1 ms).  
- Shell HTML generation.  
- WebSocket handshake latency on loopback/Tailscale.  
- Dev vs nix binary (same order of magnitude; same JS hash when dist matches).

---

## Fix proposals (for a later dispatch — do not implement here)

Ordered by evidence × expected win × risk:

### P0 — Compress static assets (gzip and/or brotli)

- **Where:** static file serving in `@kolu/surface-app` / olai listener path.  
- **Evidence:** 976 652 B with `Accept-Encoding` ignored; gzip would be **309 140 B**.  
- **Expected win:** ~3× less transfer; large on mobile/VPN; small on loopback. **Does not** remove the ~70 ms eval long task.  
- **Risk:** low if only `Content-Encoding` + correct `Vary` / ETag behavior.

### P1 — Code-split markdown + highlight.js off the critical path

- **Where:** dynamic `import()` from `markdown/render.ts` / document & chat entry points; keep `plainLine` on the critical path.  
- **Evidence:** markdown + hljs ≈ **17%** of source map mass; unused for collapsed roadmap rows.  
- **Expected win:** cut first long task materially (order-of-magnitude guess: **tens of ms** of eval + smaller download even before gzip).  
- **Risk:** one-frame delay when first expanding a note / opening a doc.

### P2 — Documents as a collection (or lazy fetch), not full text in `manifest`

- **Where:** surface `Manifest` / `publishedOf` / client `documents` providers (already called out in surface docs).  
- **Evidence:** ~**124 KB** of first snapshot is document text; largest WS frame ≈ that size; roadmap rows do not need it.  
- **Expected win:** for `docs/`, cut inbound snapshot by **~half**; shrink second long task; scales with note directories. For MyOlai today: small (0 docs).  
- **Risk:** medium (protocol + sidebar tree needs paths without bodies).

### P3 — Slim the Effect surface on the client (longer term)

- **Evidence:** Effect ≈ **58%** of mapped sources.  
- **Expected win:** largest structural bundle cut; multi-hundred-KB + substantial eval.  
- **Risk:** high (framework coupling).

### P4 — Virtualize deep trees / progressive row paint

- **Evidence:** 63 nodes already cost a ~60 ms task together with decode; larger personal outlines will hurt more.  
- **Expected win:** bounded paint cost; secondary after P0–P2 for current sizes.

---

## Recommended first shipping bet

1. **P0 gzip** (wire) + **P1 lazy markdown** (eval) in one PR series.  
2. **P2 documents collection** when touching the outline wire again.  

**Rough expected combined win on `docs/roadmap` loopback:** time-to-rows from ~**250–350 ms** toward ~**150–220 ms** (order-of-magnitude; re-measure with the same script). On slower networks, P0 alone can dominate transfer time.

---

## How to reproduce

```bash
# From repo root (this worktree)
just install && just build-client   # if dist missing
./scripts/load-perf/run.sh

# Single configuration:
nix develop .#e2e --accept-flake-config -c env \
  MODE=nix LEDGER="$PWD/docs" APP_PATH=/o/roadmap.jsonl REPS=3 NO_AGENT=1 TRACE=1 \
  OLAI_BIN="$(nix build .#olai --no-link --print-out-paths --accept-flake-config)/bin/olai" \
  bun scripts/load-perf/measure.mjs
```

Outputs:

- `scripts/load-perf/out/latest-{nix,dev}.{json,txt}`  
- Timestamped `measure-*.json`  
- Optional `trace-*.zip` (`TRACE=1`) — open with `npx playwright show-trace`

---

## Artefacts referenced

| File | Content |
|------|---------|
| `scripts/load-perf/measure.mjs` | Measurement harness |
| `scripts/load-perf/run.sh` | Runs nix/dev/MyOlai configs |
| `scripts/load-perf/out/snapshot-nix-docs-roadmap.*` | Canonical docs/roadmap nix run |
| `scripts/load-perf/out/measure-*.json` | Full raw samples |
| Production unit | `olai web /home/srid/Dropbox/MyOlai --port 7733 --host 100.78.88.70` |

---

## Bottom line

**The roadmap feels slow because the browser must download and evaluate a nearly 1 MB JS app (Effect-heavy, with markdown/highlight eagerly included) before it can open a WebSocket and paint rows — not because loading or validating the JSONL is slow.** For the project `docs/` ledger, the first surface snapshot also drags every brainstorming `.md` across the wire unused. Fix the client critical path and the wire payload; leave the server probe alone until ledgers are orders of magnitude larger.
