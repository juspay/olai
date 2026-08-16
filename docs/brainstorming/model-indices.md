# The model wants indices: why every lookup walks every node

Status: brainstorming, opened 2026-08-16. Trigger: PR #198 fixed `list_outlines` walking O(files × nodes), and the same day surfaced `siblingsOf` doing the same thing (roadmap: `siblings-of-quadratic`). The human's question, verbatim: *"Why all these individual lookups? Aren't we mapping the data to in-memory, and keeping it in sync as files change, similar to how emanote does?"* This doc answers what olai actually does today, what emanote does, and where the real gap is. Receipts throughout; nothing here is a decision.

## What olai does today

The good news first: olai **is** an in-memory model kept in sync with files. The store's probe re-lists and stats on every watcher event but re-reads and re-decodes only stale files (`store/src/probe.ts:104-160`, per-file decode cache with mtime+size stamps). Reads and writes within one revision share one derivation via a `WeakMap<OutlineSet, Derived>` keyed on set identity (`ops/src/query.ts:95-110`).

The bad news is everything above the file parse:

**1. Two indices exist; the by-file index doesn't.** `Derived` (`format/src/derive.ts:54-90`) holds the flat `nodes` array plus five maps — but only `byId` and `children` (parent → children) are lookups; the rest are marks/edges. `OutlineSet` itself is deliberately flat (`format/src/set.ts:1-16` argues grouping by file "would be the same fact twice"). Consequence: **every "what is in this file" question is a corpus scan.** The scan table, hot sites first:

| site | shape | when it runs |
|---|---|---|
| `siblingsOf` (`derive.ts:136`) roots branch | filter all nodes by file + sort | every page render, every structural keystroke, every undo, 6 sites per write in `plan.ts` |
| `matching` (`filter.ts:676`) | walk all nodes | every palette keystroke, every `search_nodes` |
| `nodesOf` (`write.ts:209`) | filter all nodes by file + sort | per rewritten file, every write |
| `sorted.ts:93` | walk all nodes | every write (commit message) |
| `dependents` (`plan.ts:2762`) | full scan × `targetsOf` | every remove/archive |
| `plan.ts:2143` | candidates × nodes loop | writes with candidate files (the #198 shape, still live) |
| `TrashPage.tsx:51` | files × nodes | trash page (the #198 shape, still live) |

**2. Derivation is never incremental, and runs three times per keystroke-batch.** One draft commit costs: a full listing+stat sweep; `codec.validate` doing a whole-corpus `assemble` + `derive` + 6 rule passes on the candidate; a second full sweep after staging; `publish` doing a **second** whole-corpus assemble+derive+rules; then the browser flatMaps every file back into one array and re-runs `derive` over the entire corpus a third time (`web/src/client/outlines.ts:68-89`). Only the wire is per-file-incremental (`published.ts:80-98` reuses unchanged files' entries). ≈2 server derives + 1 client derive + 2 stat sweeps, per keystroke-batch. The revision-keyed memo cannot help: the two validate-derives run over a set that doesn't exist yet.

## What emanote does

Emanote's `Model` (`Emanote/Model/Type.hs:53-91`) is a bag of **ixset-typed** indexed sets. Notes carry seven indices — source route, every wikilink spelling, html route, xml route, every ancestor folder, parent folder, slugs (`Model/Note.hs:80-108`). Rels are indexed by source *and* by unresolved target, which is what makes backlinks an index union instead of a scan (`Model/Graph.hs:195-199`).

**Sync is per-file, not per-corpus.** unionmount streams per-file changes; each becomes one `Model -> Model` transformer (`Source/Dynamic.hs:58-100`, `Source/Patch.hs:75-166`): parse the one file, `updateIx` its note, swap its rels/tasks in the index (`Type.hs:156-169`). A deleted Lua filter re-parses only its dependents via a hand-maintained reverse-dep map. Nothing above the changed file is rebuilt — with two honest exceptions: the Stork search index is invalidated whole and rebuilt lazily on first read, and the folgezettel tree is recomputed whole per update (the one O(notes × links) eager pass).

**And emanote still scans where it chose not to index**: tag queries rebuild the whole tag→notes map on every call (`Model/Meta.hs:81-83` — tags can be cascade-inherited, so a pure `ixFun` can't express them), and path-glob queries walk `Ix.toList`. ~24 full-traversal sites exist.

## The gap, distilled

The difference is not "in-memory vs not" — both are in-memory and file-synced. It is two specific things:

1. **Indices follow queries.** Emanote indexed exactly what its hot paths ask (route, link, ancestor); olai's hot paths ask *by file* on every keystroke and no such index exists. This is the cheap half of the gap.
2. **The unit of recomputation.** Emanote's unit is the changed file; olai's is the corpus, ×3. This is the expensive half — and emanote's own exceptions (Stork, folgezettel, tags) show full incrementality is not a religion even there. The lesson is subtler: *make the common change cheap, let the rare expensive thing be lazy or accepted.*

## Directions (none decided)

**A. Grow `Derived` by one map.** `byFile: Map<string, Located[]>` (line-sorted), built in the same pass `derive` already makes. Kills the entire scan table's by-file rows including `siblingsOf`, `nodesOf`, the trash page, and `plan.ts:2143`. Does nothing about the ×3 rebuild. This is likely what `siblings-of-quadratic` becomes — grok's #198 review warned "do not close that item by extracting blindly"; this direction is the non-blind extraction: the grouping moves *into* `Derived` where it's paired with its revision, instead of being a fourth ad-hoc `Map.groupBy`.

**B. Derive once per revision, not thrice.** Thread the validate-time `Derived` through to publish instead of recomputing; ship the client something it doesn't have to re-derive, or accept the client derive (it's once per revision, memoized, and the vault is small — measure). Smaller win than it looks if A lands, because A makes each derive cheaper too.

**C. The emanote shape: patch, don't rebuild.** Per-file transformers over `Derived`: on one file's change, splice its nodes out of `byFile`/`byId`/`children` and its edges out of `after`/`blocked`, splice the new parse in. Honest costs: `after` edges cross files (a node in `roadmap.olai` can block one in `lanes.olai`), first-claim-wins `byId` collisions make deletes order-sensitive, and the 6 validation rule passes are corpus-global today. This is real architecture, and TypeScript has no ixset-typed — but plain `Map`s keyed by what queries ask get most of the value, as A demonstrates in miniature.

**D. Do nothing above A and measure.** The repo's own doctrine (`siblings-of-quadratic`: "measure before fixing"). #198's numbers said 44ms at 800 files for the *worst* offender — the vault today is 4 files. The case for B/C is about where olai is going (agents hammering `search_nodes`, lanes multiplying files), not where it is.

## Open questions

1. What vault size makes the ×3 rebuild *felt*? A generated 1k-file benchmark (the #198 script's method) against the keystroke path would answer it in an afternoon.
2. If C is ever taken: does validation stay corpus-global (rules like id-uniqueness are), and does that cap the win at "derive is incremental but validate isn't"?
3. Does the wire change under B (client stops deriving), and is that worth coupling the browser to `Derived`'s shape?
4. Is `matching` (the palette scan) fine forever? Emanote says search is the thing you *don't* index incrementally (Stork: invalidate + lazy rebuild). A by-word index is a different doc.

## Relation to the roadmap

`siblings-of-quadratic` stays open and likely becomes direction A's PR. `outlines-quadratic` (done, #198) was this doc's trigger. Anything ruled here becomes nodes; this doc is the argument, not the ledger.
