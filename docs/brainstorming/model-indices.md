# Why do lookups walk every node? (the case for indices)

Status: brainstorming, opened 2026-08-16.

How this started: PR #198 fixed `list_outlines`, which was re-scanning every node of every file, three times per file. The same day we found a second helper (`siblingsOf`) with the same problem, and the human asked the bigger question: *"Why all these individual lookups? Aren't we mapping the data to in-memory, and keeping it in sync as files change, similar to how emanote does?"*

This document answers that with evidence from both codebases. Nothing here is a decision.

## What olai does today

First, the part that's fine: **olai does keep everything in memory, and it does stay in sync with files.** When a file changes on disk, only that file is re-read and re-parsed; unchanged files reuse their cached parse (`store/src/probe.ts:104-160`). And within one revision of the data, reads and writes share one computed view instead of each computing their own (`ops/src/query.ts:95-110`).

The problem is what happens *after* parsing. Two problems, really:

### Problem 1: almost nothing is indexed

All nodes from all files live in one flat array. On top of that array, olai computes a view called `Derived` (`format/src/derive.ts:54-90`), which contains exactly two lookup tables: node-by-id, and children-by-parent.

There is **no table from a file to its nodes**. So every question of the form "what's in this file?" is answered by walking the entire array and checking each node's `.file`. And that question is asked constantly:

| where | what it does | how often |
|---|---|---|
| `siblingsOf` (`derive.ts:136`) | walks all nodes to find a file's roots | every page render, every structural edit, every undo, and 6 places on every write |
| `matching` (`filter.ts:676`) | walks all nodes | every keystroke in the search palette |
| `nodesOf` (`write.ts:209`) | walks all nodes to find a file's lines | every write |
| `sorted.ts:93` | walks all nodes | every write (builds the commit message) |
| `dependents` (`plan.ts:2762`) | walks all nodes, checks each one's links | every remove/archive |
| `plan.ts:2143` | walks all nodes once *per candidate file* | some writes — the exact shape #198 fixed elsewhere |
| trash page (`TrashPage.tsx:51`) | walks all nodes once *per file* | opening the trash — again the #198 shape |

### Problem 2: the computed view is rebuilt from scratch, three times per edit

When you type one character and it commits, here is what actually runs:

1. The server validates the change: it reassembles the flat array from **every** file and recomputes `Derived` over **all** nodes, plus six validation passes. (Whole corpus, even though one file changed.)
2. After the write lands, the server publishes: it reassembles and recomputes **again**, over everything. (Second whole-corpus pass.)
3. The browser receives the update and recomputes its own `Derived` over **all** nodes a third time (`web/src/client/outlines.ts:68-89`).

Plus two full "list and stat every file" sweeps along the way. Only the file *parsing* step is incremental. So: one small edit ≈ three whole-corpus recomputations. The caching that exists can't help here, because it's keyed on "this exact revision of the data," and steps 1 and 2 each run on data that isn't a published revision yet.

## What emanote does

Emanote keeps one in-memory `Model` (`Emanote/Model/Type.hs:53-91`) built out of **indexed sets** (the `ixset-typed` library). A note is findable seven different ways without scanning: by its source path, by every spelling of a wikilink that could point to it, by its output URL, by its feed URL, by every ancestor folder, by its parent folder, and by its aliases. Links are indexed both by *source* and by *target* — which is why "what links here?" (backlinks) is an index lookup, not a scan (`Model/Graph.hs:195-199`).

When a file changes, emanote does **not** rebuild the model. The file-watcher hands it one file; it parses that one file and swaps that one entry (and its links) in the indexed sets (`Source/Patch.hs:75-166`, `Type.hs:156-169`). Everything else stays put.

Two honest exceptions, and they matter:

- The **full-text search index** is thrown away on any change and lazily rebuilt the first time someone searches. (The search engine can't update incrementally, so emanote doesn't try.)
- The **notebook tree** shown in the sidebar is recomputed whole on every change — the one deliberately-expensive pass.
- And **tag queries scan**: emanote rebuilds the whole tag→notes map on every tag query, because inherited tags can't be expressed as a pure index. About 24 scan-everything call sites exist in emanote too.

So even emanote's answer isn't "index everything, recompute nothing." It's: **index the questions you ask constantly; let rare or awkward questions stay expensive.**

## The gap, in one paragraph

Both systems keep the data in memory and in sync with files. The difference is (1) emanote has a lookup table for each of its hot questions, olai has tables for two questions and scans for the rest — including the by-file question it asks on every keystroke; and (2) emanote's unit of recomputation is *the changed file*, olai's is *the whole corpus, three times over*.

## Possible directions (none decided)

**A. Add one lookup table.** Give `Derived` a `byFile` map (file → its nodes, in line order), built during the same pass that already builds the other tables. This single change eliminates every by-file scan in the table above — `siblingsOf`, `nodesOf`, the trash page, the per-candidate loop. It does nothing about the triple rebuild. This is probably what the existing roadmap item `siblings-of-quadratic` should become. (Grok's #198 review warned against extracting the grouping "blindly" into a shared helper; putting it *inside* `Derived`, where it's always paired with the right revision of the data, is the non-blind version.)

**B. Compute the view once per edit, not three times.** Pass the validation step's computed view through to the publish step instead of recomputing; decide whether the browser's third computation is acceptable (it's once per edit and the vault is small) or should also be eliminated. Worth less than it looks if A lands, since A also makes each computation cheaper.

**C. Go full emanote: patch the view instead of rebuilding it.** When one file changes, remove that file's entries from the tables and splice the new ones in. This is the real architecture change, and it has real costs: "waits-on" edges cross files (a node in one file can block a node in another), duplicate-id handling depends on order, and the six validation passes are whole-corpus by nature. TypeScript has no `ixset-typed`, but plain `Map`s keyed by what we actually ask cover most of it — direction A is this idea in miniature.

**D. Just do A, then measure.** The repo's own rule ("measure before fixing"). #198's worst case was 44ms at 800 files — and the vault today has 4 files. The argument for B and C is about where olai is *going* (agents hammering search, lanes multiplying files), not where it is.

## Open questions

1. At what vault size does the triple rebuild become something a person feels? A generated 1,000-file benchmark against the keystroke path (using #198's measurement method) would answer this in an afternoon.
2. If C is ever taken: validation rules like "ids are unique" inherently look at everything — does that cap the win at "the view updates incrementally but validation still doesn't"?
3. For B: does removing the browser's recomputation mean changing what goes over the wire, and is that coupling worth it?
4. Is the search-palette scan fine forever? Emanote's answer for search was: don't index incrementally — invalidate and lazily rebuild. A word-index for olai search would be its own document.

## Relation to the roadmap

`siblings-of-quadratic` stays open and likely becomes direction A's PR. `outlines-quadratic` (#198, merged) was the trigger. Any direction ruled here becomes roadmap items; this document is the argument, not the ledger.
