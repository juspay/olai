# The browser stops holding the vault

Roadmap node `vault-in-browser`. The human's ruling, 2026-08-19: **the browser may hold at most the current page's data in memory — never the whole vault.** This doc says what that means against the code as it stands, what it deletes, and records the two follow-on decisions (§5, both ruled 2026-08-19). The first step, `search-server-side`, is ruled and filed separately.

Two words used throughout, defined once: the **derivation** (`Derived` in `packages/format`) is the value that holds every node plus a dozen vault-wide indexes over them — children, blocked-status, backlinks, tags, and so on. A **reading** is a page-shaped answer computed from it — the rows of an outline, a zoomed node with its crumbs, the agenda's three stretches.

## 1. Today, in one paragraph

When a tab opens it subscribes to the `outlines` collection (`packages/surface/src/index.ts`), and the wire's contract is that every subscription opens with a full snapshot: the first frame carries every node record of every outline file, and after that one small frame per file that changes. The client folds those frames — with the same `patch` function the server uses — into its own copy of the derivation (`web/src/client/outlines.ts`). Every page is then a pure function over that local copy, which is why navigation is instant and no page ever asks the server a question. Document bodies are already the exception: since `snapshot-scale` they cross one file at a time, on demand (`documents` is `keys` + `get`, deliberately no `deltas`). That member is the model this design generalizes.

## 2. The change, as one seam

The wire contract goes from **"the whole set, plus every delta"** to **"what this page shows, plus updates to that."** The client stops receiving raw node records and stops computing anything vault-wide. Each open page subscribes to its own reading; the server computes it and re-sends it whenever a revision changes it.

The code makes this cut unusually natural, for two reasons:

- **The server already holds the derivation.** Every write and every probe runs `derive`/`patch` server-side (store → ops codec → `format/src/validate.ts`). The browser's copy is literally a second run of the same functions over the same frames.
- **Every reading is already a pure function in `packages/format`** — `rowsOf`, `zoom`, `ancestorsOf`, `backlinksOf`, `agendaOf`, `datedOn`, `datedDays` — and `format` is isomorphic by rule (no `node:` imports; its package.json says "nothing here can reach a disk, a server or a browser"). Nothing gets rewritten; it gets *called on the other side* and its answer put on the wire. Some of it already is: `read_node` answers backlinks through `backlinksOf`, the ⌘K palette and the header box already call the server's `search.nodes` procedure, and every keystroke edit is already resolved server-side against the live reading (`server/src/edit.ts`).

Honest caveats — it is one seam **plus a tail**:

- A handful of client features read across the vault without being a page, and each needs its own small server question (or a field on something the wire already carries): the sidebar's calendar dots and agenda count; the row editor's tag-completion vocabulary; chat's marking of node ids in the transcript (a backtick span becomes a link only if the set declares that id); the pinned shelf; and fold re-filing ("gone means gone from the set" scans the whole id→file map today, `fold/memory.ts`). None is large. All are in §3–4.
- The on-page filter and the chat `@` completion were kept local *because* a round trip per keystroke was ruled out (`brainstorming/filter-in-place.md`). Going server-side reverses that ruling knowingly — that is exactly the `search-server-side` node, and debounce plus stale-response cancellation is its stated cost.
- "Updates to that" needs a mechanism. The simplest honest first cut: on every published revision the server recomputes each open page's reading and sends it when it changed by value — the surface framework's `equals`-guarded cells already work exactly this way, and a reading is small. One engineering note: the date readings (`agendaOf`, `datedOn`, `datedDays`) are full-vault walks per call today (roadmap `perf-dates-index`); once they run per-subscriber per-revision on the server, that node stops being optional. A per-page delta protocol can come later if a reading ever gets big; nothing forces one now.

So: one seam, honestly held. The format layer does not move; the browser's half of it dies.

## 3. What "a page's data" is, per route

| Route / feature | What the server sends | Existing format code that computes it (pure, runs on both sides today) |
|---|---|---|
| `/o/<file>` | The file's rows: per row the title, mark, blocked-status with blockers, progress, child count, mirrors followed into their target files; plus that file's parse errors | `rowsOf` → `siblingsOf` + `expand` (`derive.ts`) |
| `/n/<id>` | The node as heading, its note, rows under it, canonical crumbs, its edges, its backlinks | `zoom`, `rowsUnder`, `ancestorsOf`, `backlinksOf`, `namedBy` — `read_node` proves most of this server-side already |
| `/doc/<file>` | The body (already per-key today) plus the "referred to by" list | `documents.get` as-is; `referrersTo` |
| `/d/<date>`, `/today` | The day's dated nodes grouped by file, each with its ancestry; the day-note paths | `datedOn`, `dailyNotesOn` |
| `/agenda` | The three stretches: slipped / today / ahead | `agendaOf` |
| `/trash` | Each archive's rows and counts | `rowsOf`, `nodesOf` per archive |
| Sidebar | The file tree (paths + faces — cheap, key-set-sized, like `heads` today); the shown month's calendar dots; the owed count | the key/face sets; `datedDays`; `owedOf(agendaOf(…))` |
| Backlinks pane | Rides the `/n/` and `/doc/` readings above | `backlinksOf`, `referrersTo` |
| ⌘K palette, header box | Already the server's `search.nodes` | `Query.search` (ops) |
| On-page filter, chat `@` list | Become server calls — the `search-server-side` node | the same `parseFilter` / `matching` / `ranked` |
| Tag completion | The tag vocabulary with counts, on demand | the `complete/tags.ts` counting moves beside `taggedBy`, server-side |
| Transcript id-marking | "Which of these ids does the set declare" — one batch lookup per message | `nodeNamed`, server-side |

Already server cells, untouched: errors, manifest, git, pending, chat. Editing needs no new data at all: a keystroke is already a procedure the server resolves against the live set, the draft stays client-local, and undo already receives its inverse from the server's reply.

## 4. What gets deleted

- **The whole-set client store**: `web/src/client/outlines.ts`'s fold — `derive` and `patch` running in the browser — plus the `DerivedProvider` and the per-frame `faces`/`broken` walks. The derivation code leaves the browser bundle entirely.
- **The local matchers' call sites**: `filter/narrowing.ts`'s full-`nodes` walk per keystroke, `chat/nodes.ts`'s walk, `complete/tags.ts`'s whole-`taggedBy` counting. (The functions stay in `format` — the server calls them; the one-matcher rule survives.)
- **The reconnect seeding** (`seedOf`) and its bench arm, and `outlines.bench.ts` in its current shape. Roadmap nodes that die or shrink with them: olai's half of `reconnect-seed-upstream`, `perf-faces-broken-walk`, and the browser side of `perf-patch-residue`.
- **The `outlines` collection as a browser-facing member.** The agent/MCP face keeps what it needs — it was never the problem.
- **Fold re-filing's whole-set scan** (`fold/memory.ts`), replaced by whatever §2's tail decides — e.g. a page's reading carries the id→file of what it shows, and a fold is re-filed when its id is next seen.

## 5. The two follow-on decisions — both ruled (the human, 2026-08-19)

**(a) Navigation now waits on a round trip. What is cached for instant Back?**
Today every navigation is instant because the data is already local; after this change, opening a page asks the server — about a millisecond on loopback, a visible beat over a tailnet.

**Ruled: don't care — this is fine.** Round-tripping navigation is acceptable as-is. No cache is required by the design; the implementation starts with the simplest shape (cache nothing, every navigation asks the server), and nothing here obliges a Back cache ever.

**(b) A dropped connection now blocks navigation and search, not just updates. What is the offline face?**
Today a dead wire pauses updates; the page stays drawn from the local copy and the pill says so. After this change a dead wire also means no new page and no search results.

**Ruled: the app freezes with an offline overlay.** When the wire drops, an overlay covers the app and says it is offline; nothing underneath is interactive until the connection returns, at which point the overlay lifts and the page resumes live. This is the existing "live or nothing" doctrine (deliberately no service worker) carried to its conclusion — no half-alive page, no doors that pretend. The connection pill's readout (`connecting` / `reconnecting` / `retired`) is what the overlay draws its words from, and `retired` keeps its reload offer on the overlay itself.

## 6. The PRs

**Ten PRs. The law (the human's ruling): every PR is self-contained.** That means two things at once: a PR deletes whatever it replaces in the same diff, and a PR ships nothing that is unused when it merges. No scaffolding for later, no leftovers from before.

PRs 1–9 can land in any order among themselves (PR 1 first, since it is already ruled). PR 10 is last.

1. **Search moves to the server** (`search-server-side`, already filed). The on-page filter and the chat `@` list start calling the server's search, and their local scanning code is deleted in the same diff.
2. **Tag completion moves to the server.** The row editor asks the server for the tag vocabulary; the local tag-counting walk is deleted.
3. **Transcript id-marking moves to the server.** Chat asks the server which backtick ids are real nodes; the local lookup is deleted.
4. **Calendar dots and the agenda count move to the server.** The sidebar reads both off the wire; the local date walks for them are deleted.
5. **Pins move to the server.** The pinned shelf reads a server answer; the local scan for `Pins.olai` is deleted.
6. **Fold re-filing moves to the server.** The browser asks where a folded id now lives instead of scanning the whole id→file map; the scan is deleted.
7. **`read_node` says whether a node is blocked.** A finished agent-facing feature the day it merges — agents ask, agents are answered. (PR 10 needs this field too.)
8. **The date index** (roadmap `perf-dates-index`). The agenda, day page and calendar currently walk every node per call; this PR builds the index and switches those existing readers onto it in the same diff. A finished performance fix on its own. (PR 10 inherits it.)
9. **The offline overlay** (§5b). Freezing on a dead wire replaces the old quiet-pause behavior, whole, in one diff. Independent of where page data comes from.
10. **The big one — the model flips.** In one diff: the new wire member (page address → reading) appears, all seven routes start reading it, and the whole-set machinery dies — the client's fold, the `DerivedProvider`, the `faces`/`broken` walks, `seedOf`, and the browser-facing whole-set collection. Its tests ride the same diff: a parity test (the server's reading equals what the browser used to compute — cheap, both sides call the same pure functions in `packages/format`) and a before/after measurement of the wire's byte weight (`packages/tests/wire.ts`), so the win is a number.

Said honestly: **PR 10 is big and cannot be split** — the law forbids landing the wire member before its readers (unused code) and forbids flipping routes one at a time (the old wire kept beside the new). PRs 1–9 exist to shrink it: by the time it comes, every non-route reader of the local vault copy is already gone, and PR 10 is mostly rewiring and deletion — the shape #263 proved, where the installation is the deletion.

## 7. What this does NOT change

- **Agents and MCP.** The server always had everything; the ops table (`read_node`, `search_nodes`, …) and `/mcp` are untouched.
- **The format.** No field, no file shape, no validation rule. `packages/format` stays isomorphic — what changes is who calls its reading functions.
- **Search semantics.** The grammar and the ranking stay defined once, in `filter.ts`; server answers stay pinned to the reference matcher (the oracle rule the `search-server-side` node already states).
- **Editing and git.** Keystrokes were already server-resolved procedures; drafts, undo, the commit pill, pending — all exactly as they are.
