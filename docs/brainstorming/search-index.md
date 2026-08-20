# A maintained search index — a query stops costing O(corpus)

Brainstorm for roadmap node `search-index`. Researched 2026-08-19; claims carry sources. **Premise, ruled by the human 2026-08-19: search is moving entirely server-side first** (roadmap `search-server-side`, the first step out of `vault-in-browser`). This doc assumes that step lands; the index only has to run on the server, in Bun.

The question: **what index serves olai's search without changing what matches, stays up to date as edits happen (cost proportional to the edit, not the vault), avoids growing memory — and how much is off the shelf?**

## What olai search is today

- One match function, five callers, in `packages/format/src/filter.ts`. It looks for the query as a **case-folded substring** in a node's title/id/tags/note and a document's title/path/tags/body.
- The lower-cased text of each record is cached in a WeakMap; the cache never goes stale because an edit replaces the whole record object. Per-record index data can live in the same place with the same guarantee.
- Only free-text words need an index. Operators (`is:`, `has:`, `date:`, `prop:`) are cheap field checks. A quoted phrase is just a search word containing spaces.
- Ranking depends on **where** the match sits (start of field / start of word / middle). So whatever produces candidates, the final step still runs the current match function on the shortlist — which also guarantees results stay exactly the same.
- Cost today: every query re-scans everything; ~9.6ms at 20k nodes (`filter.bench.ts`). The roadmap node demands a benchmark at realistic vault sizes so we adopt on numbers, not feelings.
- **The hard rule**: results must not change. `remo` still finds "Remodel"; `chen remo` still matches across a word boundary. Word-splitting search libraries can't do this.

## Libraries surveyed — none keep our matching behavior

(Where they run doesn't matter; they fail on what they match.)

| Library | How it matches | Finds any substring? | Updates in place? | Verdict |
|---|---|---|---|---|
| [MiniSearch](https://github.com/lucaong/minisearch) | whole words; prefix/fuzzy options | **No** | Yes, very good | would change results |
| [FlexSearch](https://github.com/nextapps-de/flexsearch) | words; "full" mode matches inside one word | **breaks across spaces** | Yes | full mode needs n(n−1) memory per word; 0.8 had correctness bugs ([#517](https://github.com/nextapps-de/flexsearch/issues/517)) |
| [Orama](https://github.com/oramasearch/orama) | words; prefix + typo tolerance | No | Yes | would change results |
| [lunr](https://lunrjs.com/) | words + stemming | No | **No — rebuild only**, unmaintained since 2020 | out |
| elasticlunr, wade, js-search | word variants | No | weak | unmaintained — out |
| [fuse.js](https://github.com/krisk/fuse), [uFuzzy](https://github.com/leeoniya/uFuzzy) | fuzzy, **no index at all** | No | — | they scan per query — out |
| [search-index](https://github.com/fergiemcdowall/search-index) | words over LevelDB | No | Yes | word-based — out |
| [Pagefind](https://pagefind.app/) | words, built once at deploy | No | No | static-site lifecycle — out |
| Typesense / Meilisearch | word engines, separate server process | No | Yes | a second process and a sync protocol, and still word-based — out |

**Bottom line: no library matches arbitrary substrings.** Using one changes what search finds and must be proposed as exactly that.

## What does work: trigram indexes

A **trigram** is any 3 letters in a row ("remodel" → rem, emo, mod, ode, del). The design, from [Google Code Search](https://swtch.com/~rsc/regexp/regexp4.html): map each trigram to the set of records containing it (spaces included, so phrases work); intersect the query's trigram sets → small shortlist → run today's match function on just those. Results identical by construction — the index can only over-include. On edit: drop the old record's trigrams, add the new one's. Proven at scale: [Zoekt](https://github.com/sourcegraph/zoekt), [livegrep](https://blog.nelhage.com/2015/02/regular-expression-search-with-suffix-arrays/), [Cursor](https://cursor.com/blog/fast-regex-search), [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html).

**Limit**: trigrams can't answer 1–2 character queries. Fall back to today's scan for those (today's cost — no regression). Suffix arrays/trees also match substrings but have no maintained JS library and can't update cheaply — out.

## Shape 1 — SQLite FTS5 with trigrams (now the front-runner)

Tested in olai's own dev shell (bun 1.3.13, SQLite 3.51.2): **Bun's built-in SQLite has full-text search with trigram support compiled in.** Real substring matching, row-by-row updates, on disk.

- With search server-side, the old objection — no SQLite in the browser without a ~1MB WASM engine — **is gone**. This is now a plain library adoption, which is what the human asked to strive for.
- The store's publish step upserts/deletes rows as files change (use external-content tables so bodies aren't stored twice). Queries take candidates from SQLite, then the existing matcher ranks them — one definition of matching survives, pinned by an oracle test (`sqlite candidates ⊇ scan matches`, final results identical).
- Costs: index ≈ 3× the text on disk ([case study](https://andrewmara.com/blog/faster-sqlite-like-queries-using-fts5-trigram-indexes/)); **queries under 3 characters silently return nothing** — our code must route those to the scan; zero process memory for the index.

## Shape 2 — our own trigram index in `packages/format`

`Map<trigram-hash, sorted Uint32Array of record ids>`, maintained by the same code that already maintains `byFile`/`taggedBy` (an upsert has the outgoing record in hand, so its trigrams are removable). Same candidates-then-verify flow.

- Why prefer it over SQLite: no SQL dependency in the search path; index lives with the data model; works anywhere the format package runs (which would matter again if any local search ever returns).
- Why not: it's bespoke code we maintain, with the memory of its postings on the JS heap, and the same oracle-test obligation — for a job SQLite does off the shelf. Under the "strive not to handroll" instruction, this is the fallback, not the plan.

## Interim half-step (optional) — per-record trigram fingerprints

A small bit-set of trigram hashes cached per record beside the folded text; the scan checks the fingerprint and only reads text for records that can match. Still visits every record, but skips the body bytes — most of the cost. Art: [BitFunnel](https://www.microsoft.com/en-us/research/publication/bitfunnel-revisiting-signatures-search/). Worth doing only if the server needs relief before the SQLite shape lands; otherwise skip straight to shape 1.

## What comparable apps do

| App | Matching | Upkeep |
|---|---|---|
| Obsidian | substring-ish, internal per-file cache | per file change |
| Logseq | FlexSearch for text ([#11707](https://github.com/logseq/logseq/issues/11707)), Datalog for structure | re-indexes changed blocks |
| Roam / Notion | word-based, on their servers | server-side — the direction olai just ruled, though not substring-faithful |
| VS Code | no index — ripgrep per search | fine for one-off searches, not search-as-you-type |
| Zoekt / livegrep | true substring via trigram / suffix array | the proof the design works at scale |
| emanote | throws index away on change, rebuilds lazily | the precedent `model-indices.md` names |

## Recommendation

1. **Land `search-server-side` first** (its own roadmap node): browser search boxes query the server; debounce, cancel stale responses, decide flap behavior. No index yet — the server scans, which is what happens today anyway.
2. **Adopt SQLite FTS5 trigram (shape 1)** behind the server's search: library-grade, incremental, disk-backed, substring-true. Route <3-char queries to the scan; keep ranking in `filter.ts`; pin equivalence with an oracle test. Build the demanded benchmark here: scan vs FTS5 on realistic vaults.
3. **Shape 2 only if** SQLite disappoints (latency of the SQL hop, or local search returns someday). Every word-based library above stays marked: it changes what search finds.
