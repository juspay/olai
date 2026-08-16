# Patch the view, don't rebuild it (direction C)

Status: ruled 2026-08-16. The human read the first draft of this document — which laid out four directions — and ruled: go for the perfection solution. Directions A (add one lookup table), B (compute the view once per edit) and D (measure first) are dropped as *destinations*; C is the destination, and A and B survive only as its first steps. This document is now the brainstorm for C.

How this started: PR #198 fixed `list_outlines`, which was re-scanning every node of every file, three times per file. The same day we found a second helper (`siblingsOf`) with the same problem, and the human asked the bigger question: *"Why all these individual lookups? Aren't we mapping the data to in-memory, and keeping it in sync as files change, similar to how emanote does?"*

## The problem, restated in one paragraph

olai keeps everything in memory and re-reads only changed files — that part is right. But its computed view (`Derived`, `format/src/derive.ts`) has lookup tables for only two questions (node-by-id, children-by-parent) and answers everything else — including "what's in this file?", asked on every keystroke — by scanning the whole flat array. And the view itself is thrown away and rebuilt from scratch **three times per edit**: once to validate the write, once to publish it, and once in the browser. Emanote's answer to both: keep an index per hot question, and when one file changes, swap that one file's entries in the indexes and leave everything else standing (`Source/Patch.hs:75-166`). That swap — patching instead of rebuilding — is direction C.

One correction to the first draft, and it shrinks the project: **the wire is already incremental.** The `outlines` Surface collection (see the Surface entry in the scan below, and `docs/brainstorming/outlines-as-collection.md`) is keyed by file and served with batched deltas — a probe tick that touched three files sends one coalesced `{upserts, removes}` frame naming those three, not the corpus. The client folds those frames into a per-file keyed store incrementally too. The whole-corpus work that remains is exactly one thing, appearing three times: the `derive()` call itself — in validate, in publish, and in the browser's `derived` memo (`web/src/client/outlines.ts`), which flattens every file's entry and re-derives from scratch on any change. C is about that call, and only that call.

## What C means for olai, concretely

### 1. `Derived` becomes a set of real indexes — including the reverse ones

Today's `Derived` holds `nodes` (flat array), `byId`, `children`, `status`, `after`, `blocked`. C needs two kinds of additions:

- **`byFile`** (file → its nodes, in line order). This kills every scan in the hot-site table from the first draft: `siblingsOf`, `nodesOf`, the trash page, the per-candidate loops. This was direction A; under C it's simply the first index.
- **Reverse indexes**, because patching needs to know *what depends on what*:
  - `mirrorsOf` (node id → the mirror ids that resolve to it, transitively). A mirror in file A shows a node in file B; when B changes, A's `status` entries are stale. Without a reverse map, finding them is a scan — the thing C exists to kill.
  - `edgesTo` (node id → the ids whose `after`/`blocks` edges land on it). `blocked` is computed per-source from targets' statuses; when a target's mark flips, only the sources pointing at it need recomputing. Emanote indexes links by source *and* target for exactly this reason — it's why backlinks are a lookup there, not a scan.

  Building slice 1 added a **third** reverse index this section had not foreseen, and it constrains the patcher too, so it is recorded here rather than only in the code. Both of the above are CANONICAL — a mirror chain followed to its end, `blocks` normalised into `after` — which is right for recomputation and wrong for the other reverse question the tree asks: *does anything still name this record?* The ops layer asks it before retiring a placement (`plan.ts`'s `dependents`) and before tidying an emptied archive scaffold, and it has to be answered about the id somebody WROTE. An `after` written at a mirror is filed, in `edgesTo`, at the node that mirror shows — so a refusal about the mirror finds nothing there — and `see` is a relation no derivation reads at all. So `Derived` also carries `namedBy` (id → the records naming it, each with the fields naming it), the format's own `targetsOf` read backwards over the whole set, raw. Three reverse indexes, not two: two about meaning, one about what is written.

One structural gift makes `children` easy: the format says a node's `parent` is always in the same file. So every entry of the `children` map is wholly owned by one file, and patching a file can drop and rebuild just that file's keys. Cross-file complexity lives only in `status` (mirrors), `after`/`blocked` (edges), and `byId` (duplicates) — which is exactly where the reverse indexes point.

### 2. The patch algorithm

When file F changes:

1. Parse F (already incremental — `store/src/probe.ts` reuses unchanged files).
2. Diff F's old nodes (from `byFile`) against its new ones.
3. **Local updates**: replace `byFile[F]`; drop and rebuild the `children` keys owned by F; update `byId` for F's ids.
4. **Dirty set**: from the reverse indexes, collect every node whose derived facts could have changed — mirrors resolving into F (`mirrorsOf`), edge sources whose targets are in F (`edgesTo`), plus F's own nodes.
5. Recompute `status` and `blocked` entries for the dirty set only. Everything else is untouched.

The dirty set for a *title edit* — the keystroke case, the overwhelmingly common one — is one node, usually with no mirrors and no incoming edges. That's the whole win: today's cost per keystroke is proportional to the vault; under C it's proportional to what the edit actually touched.

The delta the patcher consumes should not be a new shape: Surface's collection-delta frame — `{upserts: [file, entry][], removes: key[]}` — is already the one vocabulary in which "what changed" travels this system, server to client. The patcher taking exactly that frame means the server (which knows which files a probe tick moved) and the client (which receives that as a wire frame) call one function with one input type, and nothing new is invented.

### 3. The honest hard parts

- **Duplicate ids.** `byId` is first-claim-wins, and "first" is a fact about corpus order. If the winning claim is deleted, the next claimant must be promoted — which means the index has to *remember the losers*: `byId` becomes id → ordered list of claimants, with the head as the answer. That's the tax incrementality charges: indexes must keep information a from-scratch rebuild gets for free.
- **Cycles.** The validator's `after`-cycle and mirror-loop checks are global claims. But note *when* they can change: only when edges or mirrors change — never on a title edit. So the rule is "re-run the cycle check when the edge set changed," which makes the expensive check rare instead of per-keystroke. (Truly incremental cycle detection exists as an algorithm, but the edge graph is tiny; re-checking just the graph on edge changes is almost certainly enough. Same story for validation's unknown-target pass: maintain a dangling-edges set from `edgesTo`.)
- **Revisions must stay atomic.** `Derived` deliberately travels *with* its nodes so nobody can mix two revisions. A patch must produce a *new* `Derived` value, not mutate the old one in place under a reader. Practically: copy-on-write — clone only the maps (or map entries) the patch touches, share the rest. This is where JS makes us pay for what Haskell's persistent maps give emanote for free, and it's a real design point, not a footnote.
- **The patcher must be one function with two callers.** derive.ts's whole design argument is that the validator and the browser share one interpretation of the format. A server-side patcher and a client-side patcher written twice would be that argument's own counterexample. The patch function lives beside `derive` in `format/`, and both ends call it.

### 4. Once the view patches, the triple rebuild falls

The old direction B (compute once per edit, not three times) is not a separate project — it's what C's plumbing produces:

- **Validate** patches the current view with the proposed change and validates the patch's dirty set (plus the global checks when edges/ids changed).
- **Publish** *is* that patched view — no second computation.
- **The browser** needs no protocol change at all: the delta frames it wants are already arriving (the `outlines` collection), and its per-file store already applies them incrementally. The one change is inside `web/src/client/outlines.ts` — the `derived` memo stops calling `derive()` over the flattened corpus and folds the frame into the previous `Derived` with the same patch function the server uses. Third computation gone, wire untouched.

Building slice 2 corrected the count, and the correction is recorded here rather than only in the code. The server did not derive twice per edit; it derived **three** times, and the third was the planner's own — `plan` called `query.ts`'s `index(set)` on the last published set, which nobody had derived because `validate` built its view, ran six rules over it and dropped it. So the shape of the slice was not "thread validate's result to publish" alone: `validate` now ANSWERS with the pair (`Reading` — the set and the view its rules ran over), that pair is the store's published value, and the write gate hands its verdict forward to the publish rather than reaching a second one about the identical set it just wrote. Counted through the real ops → store path: **3 per edit before, 1 after**, and a read that follows an edit went from 1 to 0. The second half of that is also more than a derivation — the publish's second `codec.validate` re-ran every rule too, including both cycle walks, which is why the measured saving is larger than two derivations.

One real wrinkle the wire's design hands us: entries carry their `rev` *per file*, and an unchanged neighbour deliberately keeps its older number (the cross-file consistency paragraph in `outlines-as-collection.md`). A patched client-side `Derived` therefore spans entries at mixed revs — exactly as the current flatten-and-rederive does, so this is not new unsoundness, but the patcher's contract should say it out loud rather than inherit it silently.

### 5. The safety line: an oracle, not trust

The from-scratch `derive` doesn't go away. It becomes the oracle:

> For any sequence of edits, `patch(derive(before), delta)` must deep-equal `derive(after)`.

That's a property test over generated edit sequences (create/edit/move/delete/mirror/edge, across files, with duplicate ids on purpose). It's cheap to write, it's merciless, and it's the difference between "incremental and probably right" and "incremental and provably the same view." The patcher is also allowed to *bail*: any case it finds hairy (a duplicate-id promotion, an edge flood) may fall back to full `derive` — correctness by oracle, performance by common case. Emanote does the same thing morally: its search index doesn't patch, it invalidates and lazily rebuilds.

## The ecosystem scan

The question was whether someone has already built the machine we're describing. Short answer: the closest thing is already in the house, and the external options are who to steal ideas from, not what to import.

- **@kolu/surface — the framework olai's client is built on, and the scan's missing first entry.** Surface's spec vocabulary is Cells, Collections, Streams and Events, and two of its features are load-bearing for C:
  - A collection can serve a **batched snapshot-then-delta stream** (`CollectionDeltasMsg`: one `snapshot` frame, then coalesced `{upserts, removes}` frames). olai's `outlines` member already uses it — this is why the wire is per-file today, and why C's delta type should just *be* this frame.
  - **Derived collections** (`derived.collection(...)`) come with a reconciler and per-key `equals`, publishing only the keys whose values actually changed — server-side incremental view maintenance at the member level, already shipped and tested (`collectionDeltas.test.ts`, `assertCellConverges.ts`).
  - The Solid client layer (`useCollection`, keyed subscription roots) gives **per-key fine-grained reactivity**: a delta frame updates only the touched keys' signals. So the "diff-aware client reactivity" the external libraries sell is already installed — SolidJS memos over Surface's keyed store.
  What Surface does *not* have is anything that knows olai's format semantics — mirrors, marks, cross-file edges, duplicate-id precedence. The patcher is the piece between Surface's delta frames and `Derived`, and it's ours to write either way.
- **[d2ts](https://github.com/electric-sql/d2ts)** (ElectricSQL) — differential dataflow in TypeScript: pipelines of `map`/`filter`/`join`/`reduce` over keyed streams whose outputs update incrementally. The real, general version of what C hand-rolls. Costs: explicitly **alpha**; mirror-chain resolution is recursive, which is differential dataflow's awkward corner (`iterate`); and rebasing `derive` onto a dataflow graph is a bigger rewrite than the patcher.
- **[TanStack DB](https://tanstack.com/db/latest)** — a reactive client store whose live queries are incrementally maintained *by d2ts* ([sub-millisecond updates on 100k-row collections](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync)). Proof the approach carries production weight in TS — but its collections+live-queries+sync shape is, seen from here, a parallel universe's Surface: adopting it would duplicate the framework the client already stands on.
- **[Materialite](https://github.com/vlcn-io/materialite)** (vlcn / Matt Wonlaw) — the same differential-dataflow idea, earlier and smaller; effectively research code (author says APIs unsettled, bugs remain; quiet since mid-2024). Read for ideas, don't depend on.
- **[Rocicorp Zero](https://zero.rocicorp.dev/)** — a full sync engine whose ZQL queries are incrementally maintained on both ends. The most complete IVM system in TS, and the wrongest fit: it brings a database, a cache server, and a replication protocol. Instructive precedent only.
- **[signia](https://signia.tldraw.dev/)** (tldraw) — reactive signals where derived values receive *diffs* of their inputs and can update incrementally. Born from exactly our shape of problem — but it's the reactivity wiring, and Solid-over-Surface already provides that wiring here; the diff-applying logic would still be ours.
- **[TinyBase](https://tinybase.org/)** — tiny reactive in-memory store with incrementally-maintained indexes, relationships and queries. Lovely, but it owns the data model (tables/rows/cells); wrong layer, same duplicate-the-framework objection as TanStack DB.
- **Plain `Map`s + a hand-written patch function speaking Surface's delta vocabulary** — the emanote answer transliterated (emanote's `ixset-typed` is itself just "several maps kept consistent"), with the delta type the wire already uses. No dependency, no model mismatch, exactly as much machinery as `Derived` needs, testable against the oracle. **This is the recommendation.**

(Side note for the search palette: full-text is its own world — [MiniSearch](https://github.com/lucaong/minisearch) maintains a search index with per-document add/remove, which is the incremental answer *there* if the scan in `matching` ever hurts. Separate document, as before.)

## What could upstream to kolu

Ruled in the same breath (2026-08-16): where the Hickey/Lowy cut exposes a generic mechanism, upstreaming it to kolu's Surface is on the table. The cut is clean here — mechanism vs. policy:

- **The mechanism** — "fold a collection's snapshot-then-delta stream into a derived value, incrementally, with a bail-to-recompute escape hatch" — knows nothing about olai. It's a client-side combinator Surface doesn't have yet: today `useCollection` gives per-key signals, and any *whole-collection* derived value (olai's `derived` memo) is left to recompute from a flatten. Something like `useCollection.fold(init, patch, recompute)` — snapshot frame calls `recompute`, delta frames call `patch`, and a patch that declines falls back to `recompute` — is the Surface-shaped half of slice 4, useful to any Surface app with a corpus-shaped derived value. The server-side dual (a `derived.collection` reconciler that consumes upstream *deltas* instead of recomputing-then-diffing by `equals`) is the same idea one layer down.
- **The policy** — what the fold *does*: mirrors, marks, cross-file edges, duplicate-id precedence — is olai's format semantics, stays in `@olai/format`, and is exactly the volatile part Lowy says not to hand the framework.

Practically: build the patcher in olai first (slices 3–4), and if the fold combinator comes out as free of olai as it looks, offer it upstream as a small PR — the same route `precompress-upstream` took. Upstreaming is a consequence of the design being right, not a prerequisite for any slice.

## How C lands: four slices, each shippable

1. **The index shape.** Add `byFile`, `mirrorsOf`, `edgesTo` (and `namedBy`, which building it turned up — see §1) to `Derived`, built in the same single pass as today's tables; convert every by-file and reverse-lookup scan to index reads. Still full rebuild per edit. (This is old direction A, now C's first commit — and grok's #198 warning about a "blind" shared helper is answered the same way: the grouping lives inside `Derived`, always paired with its revision.)
2. **One computation per edit.** Thread the validated view through to publish instead of recomputing. (Old direction B, now C's plumbing.)
3. **The patcher.** `patch(derived, delta)` in `format/`, taking Surface's collection-delta frame shape, with the oracle property test and the bail-to-rebuild escape hatch. Server uses it; the browser still rebuilds.
4. **The browser joins.** Swap the client's `derived` memo from flatten-and-`derive` to the same patcher over the delta frames it already receives. No wire change — the outlines-as-collection work already paid that cost; this slice is one module's internals plus the mixed-revs contract said out loud. If the generic fold combinator (previous section) proves itself here, it's the upstream candidate.

Each slice is a PR with its own evidence; slice 3 is where the property test earns its keep; slice 4 turned out to be the smallest, not the biggest — the opposite of what the first draft assumed, and the outlines-as-collection redesign is why.

## Open questions

1. Copy-on-write mechanics: hand-cloned `Map`s per touched table, or an immutable-map dependency? (Hand-cloned is the default; measure before importing anything.)
2. Is "re-run cycle checks when edges changed" enough forever, or does an edge-heavy future (agents wiring DAGs constantly) eventually want true incremental cycle detection?
3. Should the patcher's contract about mixed per-entry `rev`s (slice 4's wrinkle) stay "same as today, said out loud," or does anything downstream actually want a consistent-cut guarantee it never had?
4. Could slice 2 go further and serve derived facts through Surface's own `derived.collection` reconciler (per-key equals doing the only-changed-keys publish)? Probably a later refinement — the patcher has to exist first either way.
5. The benchmark from the first draft still deserves to exist — a generated 1,000-file vault against the keystroke path — not to decide *whether* (that's ruled) but to give each slice a before/after number.

## Relation to the roadmap

The ruling makes this the plan of record. `siblings-of-quadratic` becomes slice 1's PR. Slices 2–4 become roadmap items when the human says dispatch — this document is the argument, not the ledger. Prior art in this repo: `docs/brainstorming/outlines-as-collection.md`, which is slice 4's enabling work, already merged.
