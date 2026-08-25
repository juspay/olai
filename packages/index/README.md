# @olai/index — the search index, and nothing that decides

Every door that searches the DIRECTORY — an agent's `search_nodes`, the `⌘K` palette, the header's box, the chat composer's `@` list — used to read every record and every body in the vault, once per query. This package is what they read instead: a trigram table over the same folded text, kept level with the store's revisions, answering with the records and documents a query *might* select.

**It answers candidates, never an answer.** What matches, in what order, with which field carrying the hit, is [`@olai/format`](../format/README.md)'s one matcher, and this package cannot reach it. That is the correctness argument rather than a division of labour: an index that over-includes costs one comparison per extra candidate and cannot change what search finds; an index that *decided* would be a second reading of a grammar with five doors on it, and the day it disagreed with `filter.ts` is the day `is:done` means two things ([docs/search.md](../../docs/search.md)).

The design, with the eleven libraries that were surveyed and why none of them can be used, is [docs/brainstorming/search-index.md](../../docs/brainstorming/search-index.md).

## The whole surface

```ts
import { open } from "@olai/index"

const index = open()
const found = index.narrow(reading, filter) // candidates, or null
```

| member | what it is |
|---|---|
| `open()` | one table, in memory, for one served directory. It **throws** on a runtime whose SQLite cannot make one, rather than handing back a working olai with a quietly slower search that nothing on any screen explains |
| `narrow(at, filter)` | bring the table level with this reading, then answer this query — `{nodes, documents}` of things that *might* match, or `null` for **ask the corpus** |
| `rows()` | how many rows the table holds. A reading for a test and a bench: an index that answers correctly while growing a row per edit forever has no other symptom |
| `bytes()` | what the table weighs — SQLite's own page count. A reading for the bench, and it exists because the design priced this engine on disk and the implementation put it in memory (below) |
| `close()` | done with the directory |

`null` and an empty `{nodes, documents}` are opposite answers. `null` is "this table has nothing to say about that query"; empty is "it looked, and nothing can match".

One door and not two, deliberately: *catch up with this reading* and *answer this query* are one call, so there is no order to get wrong and no way to ask the table about a revision it has not seen.

## Why trigrams

olai's matcher finds a case-folded **substring**, anywhere — `remo` finds "Remodel", `chen remo` matches across a word boundary. Every word-based search library there is would change that. What does not is a trigram index (Google Code Search's design, and Zoekt's, and PostgreSQL's `pg_trgm`): index every three characters in a row, intersect the query's, verify the shortlist.

Bun ships SQLite with FTS5 and the `trigram` tokenizer compiled in, so the table is a library and not something this repository maintains — which is the difference between this package and a postings map on the JS heap.

Three kinds of needle it cannot be asked about, each measured rather than assumed, and each refused before the query is built rather than tried: one **shorter than three characters** makes no trigram (that is your first two keystrokes); one carrying a **`NUL`** ends FTS5's phrase early, since the query parser reads a C string; and one carrying **half a surrogate pair** comes back with no rows for text that plainly holds it. All three fail the same safe way — the group is dropped, the rest of the query still narrows, and a query with nothing left walks the corpus exactly as it always did. Stored text is unharmed by any of them: that side is handed a length, and a needle that does not contain the odd character is still a contiguous run the mangling never touched.

## How it stays true

Three rules, and between them there is no state to invalidate:

1. **The text it holds is the matcher's own fold**, run together — `hayOf` and `documentHayOf`, exported by `@olai/format` for exactly this. Not a second lowercasing of the same strings: it reads the very cache a keystroke already filled.
2. **Which of a query's words may narrow it is the grammar's answer**, not this package's — `narrowableBy`, which keeps the query's and/or shape. Flattening the words and intersecting them would answer `chen OR remo` with the records holding *both*, which is the one way a narrowing is wrong rather than merely wide.
3. **It follows the reading at the door.** `narrow` is handed the very `Reading` the answer is about and levels the table before looking anything up, so there is no window in which a search is answered from a revision behind the one it was asked of.

Levelling costs what *moved*: the reading's `byFile` names each file's records by identity, a patched view hands back the same array for every file an edit did not touch ([`patch.ts`](../format/src/patch.ts)), and the files whose arrays are new are exactly the files a write rewrote. A keystroke pays a walk of the file table; a write pays its own records.

### Proven, not argued

[`src/index.test.ts`](src/index.test.ts) asks the same question twice — once off the table, once off the corpus — and fails on the first pair that differs. Over a vault written by hand for the corners of the grammar (phrases, `OR`, negation, every operator, non-ASCII, an emoji, the archive, scopes, a `.html` whose bytes nobody read, and a record whose title carries a `NUL` and half a surrogate pair), over a generated one, and over a **soak**.

The soak is *steered*, not merely random. A random walk reaches the shapes it happens to draw and stays whatever size it started at, so it has phases: the corpus is written up past the size where the table starts declining a crowd, and back down under it, with both answers compared after every round on the way. Seven write shapes are generated and each is asserted to have fired — a file rewritten, removed, minted, a document swapped under its path, a file **renamed**, a record **moved between files**, a **mirror** arriving — plus a full rebuild every seventh round instead of a patch, and a property map that alternates on rewrite so `custom` is added and then taken away. Every round checks the row count against the reading and that no two records claim one id.

[`src/scope.index.test.ts`](src/scope.index.test.ts) asks a third question, and it is about the COMPOSITION rather than about this table: a `file:` or `under:` scope narrows a search too (`perf-filter-scope`), and since that change it does so by reading the derivation's own indexes rather than by filtering the corpus — so a scoped query is now two narrowings meeting in one call, a list of ids resolved through `byId` against a subtree descended through `children`. The way that breaks is not by throwing; it is by an answer quietly missing a record only one of the two knew to keep. It runs `@olai/format`'s own differential harness ([`testlib/scope`](../format/src/scope.testlib.ts)) with `narrow` plugged into it, so the reference walk on the other side of the comparison is the code that shipped before either narrowing existed — the same asks, the same corpora, and both halves compared with the table in front of them and without it.

[`@olai/ops`'s `search.index.test.ts`](../ops/src/search.index.test.ts) makes the same comparison where the writes are real — a temp directory, the store, the write gate — which is where an index one revision behind would show up and nowhere else.

## When it declines

A lookup that would hand back more than a quarter of the directory (with a floor, for small vaults) answers `null` and lets the corpus be walked. An index is worth exactly what it throws away: a word in nine records out of ten turns a walk of the vault into a walk of nine tenths of it *plus* the cost of finding out which nine tenths. Knowing this is cheap — the lookup takes one row more than the share allows and FTS5 stops reading postings when the limit is met.

`just bench` (over [`src/index.bench.ts`](src/index.bench.ts)) prints the band. On a generated vault of 1,000 outlines — 21,552 records — and 200 documents holding 0.77 MB of prose:

| query | hits | walk | index | |
|---|---|---|---|---|
| `"of file 11"` | 220 | 15.7ms | 0.91ms | 17× |
| `upkeep11` | 162 | 12.8ms | 0.76ms | 17× |
| `zzzzzzzz` | 0 | 12.5ms | 0.16ms | 80× |
| `brass timber` | 200 | 13.0ms | 0.90ms | 15× |
| `walnut` | 200 | 13.2ms | 0.50ms | 26× |
| `note about` | 3,920 | 15.0ms | 8.3ms | 1.8× |
| `record` | 19,600 | 15.3ms | 17.4ms | 0.9× — declined, a crowd |

Building the cold table over that corpus is ~121ms, paid by the first query of a process and nothing after it. Keeping it level costs ~1.1ms for a write that rewrote one 21-record file, and ~0.3ms for a query at a revision that moved nothing — which is the number that has to stay small, since it is paid per query for as long as the process runs.

## What it weighs

The design priced this engine **on disk** — "index ≈ 3× the text", with *zero process memory* as the reason to put it there ([brainstorming/search-index.md](../../docs/brainstorming/search-index.md)). This implementation puts the same postings **in memory**, held for the life of the process. That trade is deliberate — a file beside somebody's vault is a file to invalidate, version, garbage-collect and explain — and it went unpriced until a reviewer said so, so the bench prints it:

```
MEMORY table 6.0 MB over 20780 rows (291 bytes each, 3.44× the folded text) · rss +6.7 MB across that build
```

**291 bytes per indexed record or document**, and the brainstorm's on-disk estimate turns out to hold in memory too: 3.44× the folded text the table was built from. That is the postings alone — the fold itself is not stored (`content=''`), and the JavaScript beside them is two maps of pointers at arrays the reading already holds, one entry per *file* rather than per record. Multiply the per-row figure for a vault ten times this size.

Run any of it on your own machine before quoting it: the ratios are the claim, the milliseconds are one laptop's.

## What is deliberately not here

- **No second grammar.** No tokenizer of its own, no ranking, no cap, no scope rule, no archive rule. It hands back keys.
- **No file on disk.** An index file beside somebody's vault is a file to invalidate, to version, to garbage-collect and to explain, for a table rebuilt from a directory already in RAM.
- **No push.** Nothing publishes at this package; it is asked, and it catches up. A table fed by a subscriber would have a window in which a search could be answered from a revision behind the one it was asked of, and that window is a missing hit.
