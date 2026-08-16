# Patch the view, don't rebuild it (direction C)

Status: ruled 2026-08-16. The human read the first draft of this document — which laid out four directions — and ruled: go for the perfection solution. Directions A (add one lookup table), B (compute the view once per edit) and D (measure first) are dropped as *destinations*; C is the destination, and A and B survive only as its first steps. This document is now the brainstorm for C.

How this started: PR #198 fixed `list_outlines`, which was re-scanning every node of every file, three times per file. The same day we found a second helper (`siblingsOf`) with the same problem, and the human asked the bigger question: *"Why all these individual lookups? Aren't we mapping the data to in-memory, and keeping it in sync as files change, similar to how emanote does?"*

## The problem, restated in one paragraph

olai keeps everything in memory and re-reads only changed files — that part is right. But its computed view (`Derived`, `format/src/derive.ts`) has lookup tables for only two questions (node-by-id, children-by-parent) and answers everything else — including "what's in this file?", asked on every keystroke — by scanning the whole flat array. And the view itself is thrown away and rebuilt from scratch **three times per edit**: once to validate the write, once to publish it, and once in the browser. Emanote's answer to both: keep an index per hot question, and when one file changes, swap that one file's entries in the indexes and leave everything else standing (`Source/Patch.hs:75-166`). That swap — patching instead of rebuilding — is direction C.

## What C means for olai, concretely

### 1. `Derived` becomes a set of real indexes — including the reverse ones

Today's `Derived` holds `nodes` (flat array), `byId`, `children`, `status`, `after`, `blocked`. C needs two kinds of additions:

- **`byFile`** (file → its nodes, in line order). This kills every scan in the hot-site table from the first draft: `siblingsOf`, `nodesOf`, the trash page, the per-candidate loops. This was direction A; under C it's simply the first index.
- **Reverse indexes**, because patching needs to know *what depends on what*:
  - `mirrorsOf` (node id → the mirror ids that resolve to it, transitively). A mirror in file A shows a node in file B; when B changes, A's `status` entries are stale. Without a reverse map, finding them is a scan — the thing C exists to kill.
  - `edgesTo` (node id → the ids whose `after`/`blocks` edges land on it). `blocked` is computed per-source from targets' statuses; when a target's mark flips, only the sources pointing at it need recomputing. Emanote indexes links by source *and* target for exactly this reason — it's why backlinks are a lookup there, not a scan.

One structural gift makes `children` easy: the format says a node's `parent` is always in the same file. So every entry of the `children` map is wholly owned by one file, and patching a file can drop and rebuild just that file's keys. Cross-file complexity lives only in `status` (mirrors), `after`/`blocked` (edges), and `byId` (duplicates) — which is exactly where the reverse indexes point.

### 2. The patch algorithm

When file F changes:

1. Parse F (already incremental — `store/src/probe.ts` reuses unchanged files).
2. Diff F's old nodes (from `byFile`) against its new ones.
3. **Local updates**: replace `byFile[F]`; drop and rebuild the `children` keys owned by F; update `byId` for F's ids.
4. **Dirty set**: from the reverse indexes, collect every node whose derived facts could have changed — mirrors resolving into F (`mirrorsOf`), edge sources whose targets are in F (`edgesTo`), plus F's own nodes.
5. Recompute `status` and `blocked` entries for the dirty set only. Everything else is untouched.

The dirty set for a *title edit* — the keystroke case, the overwhelmingly common one — is one node, usually with no mirrors and no incoming edges. That's the whole win: today's cost per keystroke is proportional to the vault; under C it's proportional to what the edit actually touched.

### 3. The honest hard parts

- **Duplicate ids.** `byId` is first-claim-wins, and "first" is a fact about corpus order. If the winning claim is deleted, the next claimant must be promoted — which means the index has to *remember the losers*: `byId` becomes id → ordered list of claimants, with the head as the answer. That's the tax incrementality charges: indexes must keep information a from-scratch rebuild gets for free.
- **Cycles.** The validator's `after`-cycle and mirror-loop checks are global claims. But note *when* they can change: only when edges or mirrors change — never on a title edit. So the rule is "re-run the cycle check when the edge set changed," which makes the expensive check rare instead of per-keystroke. (Truly incremental cycle detection exists as an algorithm, but the edge graph is tiny; re-checking just the graph on edge changes is almost certainly enough. Same story for validation's unknown-target pass: maintain a dangling-edges set from `edgesTo`.)
- **Revisions must stay atomic.** `Derived` deliberately travels *with* its nodes so nobody can mix two revisions. A patch must produce a *new* `Derived` value, not mutate the old one in place under a reader. Practically: copy-on-write — clone only the maps (or map entries) the patch touches, share the rest. This is where JS makes us pay for what Haskell's persistent maps give emanote for free, and it's a real design point, not a footnote.
- **The patcher must be one function with two callers.** derive.ts's whole design argument is that the validator and the browser share one interpretation of the format. A server-side patcher and a client-side patcher written twice would be that argument's own counterexample. The patch function lives beside `derive` in `format/`, and both ends call it.

### 4. Once the view patches, the triple rebuild falls

The old direction B (compute once per edit, not three times) is not a separate project — it's what C's plumbing produces:

- **Validate** patches the current view with the proposed change and validates the patch's dirty set (plus the global checks when edges/ids changed).
- **Publish** *is* that patched view — no second computation.
- **The wire** ships the per-file delta (the file's new nodes) instead of implying "recompute everything," and the **client** applies the same patch function to its copy. Third computation gone.

This changes what goes over the wire, which the e2e suite's revision assertions may feel — that's a cost to schedule, not a surprise to discover.

### 5. The safety line: an oracle, not trust

The from-scratch `derive` doesn't go away. It becomes the oracle:

> For any sequence of edits, `patch(derive(before), delta)` must deep-equal `derive(after)`.

That's a property test over generated edit sequences (create/edit/move/delete/mirror/edge, across files, with duplicate ids on purpose). It's cheap to write, it's merciless, and it's the difference between "incremental and probably right" and "incremental and provably the same view." The patcher is also allowed to *bail*: any case it finds hairy (a duplicate-id promotion, an edge flood) may fall back to full `derive` — correctness by oracle, performance by common case. Emanote does the same thing morally: its search index doesn't patch, it invalidates and lazily rebuilds.

## The TypeScript ecosystem scan

The question was whether someone has already built the machine we're describing. Short answer: the *ideas* are productized, but nothing drops in at the layer olai needs. What exists, from closest-in-spirit to furthest:

- **[d2ts](https://github.com/electric-sql/d2ts)** (ElectricSQL) — differential dataflow in TypeScript: you write a pipeline of `map`/`filter`/`join`/`reduce` over keyed streams, feed it changes, and outputs update incrementally instead of re-running. This is the real version of what C hand-rolls. Costs: explicitly **alpha**; and mirror-chain resolution is recursive, which is differential dataflow's awkward corner (`iterate` exists, but it's the hard part of the API). Rebasing `derive` onto a dataflow graph is a bigger rewrite than writing the patcher by hand.
- **[TanStack DB](https://tanstack.com/db/latest)** — a reactive client store whose live queries are incrementally maintained *by d2ts* ([sub-millisecond updates on 100k-row collections](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync)). Proof the approach carries production weight in TS. But it wants to *be* the store (collections + queries as the app's data layer), where olai's store is `.olai` files with its own format semantics — adopting it would mean expressing marks/mirrors/edges as its collections and queries. Worth a spike if we ever want live queries generally; too big a bite as the fix for `Derived`.
- **[Materialite](https://github.com/vlcn-io/materialite)** (vlcn / Matt Wonlaw) — the same differential-dataflow idea, earlier and smaller; effectively research code (author says APIs unsettled, bugs remain; quiet since mid-2024). Its lineage flowed into Zero. Read it for ideas, don't depend on it.
- **[Rocicorp Zero](https://zero.rocicorp.dev/)** — a full sync engine whose ZQL queries are incrementally maintained on both ends. The most complete IVM system in TS, and the wrongest fit: it brings a database, a cache server, and a replication protocol. Instructive precedent only.
- **[signia](https://signia.tldraw.dev/)** (tldraw) — reactive signals where derived values receive *diffs* of their inputs and can update incrementally ("filter only the changed items"). Born from exactly our shape of problem (large derived immutable collections at tldraw). It's a reactivity layer, though: it hands you the wiring for "recompute from a diff," but the diff-applying logic — the patcher — is still yours to write. Could matter later if the client wants fine-grained redraws.
- **[TinyBase](https://tinybase.org/)** — tiny reactive in-memory store with incrementally-maintained indexes, relationships and queries. Lovely, but it owns the data model (tables/rows/cells); olai's model is nodes-in-outlines with format semantics TinyBase can't know. Wrong layer.
- **Plain `Map`s + a hand-written patch function** — the emanote answer transliterated (emanote's `ixset-typed` is itself just "several maps kept consistent"). No dependency, no model mismatch, exactly as much machinery as `Derived` needs, testable against the oracle. **This is the recommendation.** The libraries above are who to steal ideas from, not what to import — with d2ts/TanStack DB as the thing to revisit if the query surface ever grows past "the six maps in `Derived`."

(Side note for the search palette: full-text is its own world — [MiniSearch](https://github.com/lucaong/minisearch) maintains a search index with per-document add/remove, which is the incremental answer *there* if the scan in `matching` ever hurts. Separate document, as before.)

## How C lands: four slices, each shippable

1. **The index shape.** Add `byFile`, `mirrorsOf`, `edgesTo` to `Derived`, built in the same single pass as today's tables; convert every by-file and reverse-lookup scan to index reads. Still full rebuild per edit. (This is old direction A, now C's first commit — and grok's #198 warning about a "blind" shared helper is answered the same way: the grouping lives inside `Derived`, always paired with its revision.)
2. **One computation per edit.** Thread the validated view through to publish instead of recomputing. (Old direction B, now C's plumbing.)
3. **The patcher.** `patch(derived, fileDelta)` in `format/`, with the oracle property test and the bail-to-rebuild escape hatch. Server uses it; the browser still rebuilds.
4. **Patches on the wire.** The client applies the same patcher to the same deltas; the third computation and the corpus-shaped payload both go away.

Each slice is a PR with its own evidence; slice 3 is where the property test earns its keep; slice 4 is the one that touches protocol and e2e assumptions and should be its own conversation.

## Open questions

1. Copy-on-write mechanics: hand-cloned `Map`s per touched table, or an immutable-map dependency? (Hand-cloned is the default; measure before importing anything.)
2. Is "re-run cycle checks when edges changed" enough forever, or does an edge-heavy future (agents wiring DAGs constantly) eventually want true incremental cycle detection?
3. Slice 4's wire change: what exactly do the e2e suite's revision assertions assume about publish payloads?
4. The benchmark from the first draft still deserves to exist — a generated 1,000-file vault against the keystroke path — not to decide *whether* (that's ruled) but to give each slice a before/after number.

## Relation to the roadmap

The ruling makes this the plan of record. `siblings-of-quadratic` becomes slice 1's PR. Slices 2–4 become roadmap items when the human says dispatch — this document is the argument, not the ledger.
