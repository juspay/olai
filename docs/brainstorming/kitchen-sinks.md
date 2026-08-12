# Kitchen sinks — what accumulated where, and what lifts out

Surveyed 2026-08-12, on the human's ask: *identify kitchen sink modules/packages, and propose how we can lift them to separate packages.* Method: three full-tree sweeps (the ops package; the web package; chat/server/format/surface/tests), each reading the fat files whole and tracing what imports what. Everything below is proposal, not decision — nothing here is ratified, and nothing has a roadmap item yet.

> **Superseded in part — see the appendix.** This survey was put through a three-way adversarial debate the same day (`debates/kitchen-sinks/`, three rounds, converged). Several claims below were falsified by citation and **none of the four package lifts survived**; the ratified replacement list is in the appendix at the end and, in full, in `debates/kitchen-sinks/conclusion.md`. The survey body is kept as written — it is the record of what the file-size lens sees, and of why that lens was not enough.

## The verdict in one paragraph

The *package* layering is not the problem. The workspace's dependency direction is machine-checked by `bun install`, every edge is argued in a `//dependencies` comment, and the one recent extraction (`@olai/git`, out of `ops/src/git.ts` under `commit-whole-repo`) set a precedent this survey kept testing candidates against: a leaf on `effect` alone, knowing nothing above it. Very few candidates pass that test, and the ones that do are named below. The actual kitchen sinks are **files** — a 987-line `pending.ts` carrying ~170 lines of pure vocabulary beside its git orchestration, a 657-line closure in `chat/agent.ts` holding nine mutable variables for four separable concerns, a 1060-line test World a third of which touches no instance state. So this document proposes in two registers: package lifts (few, specific), and module splits inside packages (many, mostly free). It also records what looked like a sink and is not, so nobody splits those later.

## Package-level lifts

### 1. The markdown pipeline → `@olai/markdown` (or stays, minus two files)

`web/src/client/markdown/` is 2,637 lines across 18 files and imports **nothing** outside itself as a directory — with exactly two exceptions: `rewrite.ts` (which reaches `@olai/format`'s `pictureOf`, `@olai/surface`'s `mediaHref`, and `../testids.ts`) and `tags.ts` (`titleParts` from format, testids). Everything else — `pipeline.ts`, `sanitise.ts`, `anchors.ts`, `outline.ts`, `inline.ts`, `plain.ts`, `render.ts`, `chunk.ts`, `meta.ts`, `title.ts` — is generic remark/rehype plumbing.

The lift: a generic pipeline package taking its olai-specific plugins (rewrite, tags) as **injected** transforms; those two files stay in `web` as the olai half. What it buys: the one big client subsystem that is genuinely liftable, and a pipeline the server could someday share (rendering a note for an email digest, a static export) without importing a SolidJS client to get it.

One misfiling to correct regardless: `markdown/scale.ts` (334 lines, **zero imports**) is not markdown — it is the design-token table plus its CSS emitter, consumed by `build.ts`, by `Note.tsx` and `chat/Entry.tsx` via classnames, and by the test suite across the package boundary. It belongs with the theme (next entry), wherever that lands.

### 2. The design system → `@olai/theme` (or `web/src/design/`)

`web/src/client/theme/` is 1,066 lines and near-self-contained: `palettes.ts` (399) is a pure fifteen-row table with no imports; `css.ts` is codegen; the only impurities are `state.ts` → `../preference.ts` (itself a generic localStorage-plus-`storage`-event wrapper) and `Picker.tsx` → `../touch.ts`. Add `scale.ts` from the entry above and `preference.ts`, and the unit is: tokens, palettes, the codegen both ride, and the persistence rule.

Why a package rather than a directory is *defensible*: it already has three consumers across product boundaries — `build.ts` (build-time codegen), the client (runtime), and `packages/tests` (`theme_steps.ts` imports `customProperty`, `DEFAULT_THEME`, `THEME_ATTRIBUTE`, `THEME_STORAGE_KEY`; `rhythm_steps.ts` imports the whole scale table). Why it might still be a directory: nothing outside this repo wants it, and its olai-ness (`olai.theme` storage key, `--olai-md-` prefixes) is real. Either way the current homes are wrong — a token system filed under `markdown/`, and a name collision (`client/palette/` is the *command* palette; `client/theme/palettes.ts` is the color palettes) inside one package.

### 3. `precompress.ts` → its own leaf, eventually its own repo

`web/src/precompress.ts` imports `node:fs/promises`, `node:path`, `node:zlib` — and nothing else. Zero olai knowledge, zero client knowledge: it takes a dist directory and compresses what qualifies. It is a standalone "precompress a static dir" utility that happens to live inside a SolidJS package, and `@olai/server` already reaches across to test it (`server/src/precompress.test.ts`).

Sequencing note: `precompress-dev-tax` (filed) wants to change this file's behavior — sibling-skip, dist pruning, a dev opt-out. Do the fix and the lift in one move, or fix first and lift after; lifting the current version enshrines the bug.

### 4. `format/committing.ts` → `@olai/committing` — recorded, not urged

The file has nothing to do with the outline format: it is 370 lines of commit vocabulary (the `Pending` aggregate, `Writer`, `CommitRequest`/`CommitResult`/`PushResult`) whose only tie to its package is `NodeChange` from `changes.ts`. The shape it would lift into is exactly `@olai/git`'s — a leaf on `effect` + `@olai/git/state` with no workspace sibling above. But `changes.ts` compares parsed node records, which is genuinely format's business, and it anchors the cut. **The seam is real; the cut is not clean.** Leave it until `changes.ts`'s ownership question resolves itself, and record here that `CommitRequest`'s inline MCP tool descriptions are agent-facing prose living in the floor package.

### 5. The fake ACP agent's skeleton → `@olai/chat`'s `./testlib`

`tests/agent/fake-acp-agent.ts` (860 lines) is two products in one executable. The generic half — JSON-RPC framing, session lifecycle (`initialize`/`session.list`/`new`/`load`/`prompt`/cancel), the ask-a-person plumbing, the one-turn stdin loop — depends on **node builtins alone** (no SDK, no effect, no workspace import) and is exactly what any ACP *client* needs to test against. The olai half is the 18-verb scenario script (`runTurn`: crash, deaf, flood, hold, ask, plan/permit, …) that knows tool names like `set_done` and the `.agent-release` convention.

The lift: the skeleton becomes `@olai/chat`'s `./testlib` — the subpath convention `format`, `log`, `git` and `ops` already argue in their manifests — as an importable module exporting `run(script)`, with a thin `bin/` shebang wrapper (which also dissolves the stdin-on-import hazard the file's own header records). The verb script stays in `packages/tests` as the scenario dictionary, passed in as a handler. What it buys beyond hygiene: `chat`'s most safety-critical logic — the permission-bypass rule, the model-two-sources rule, the deferred cancel — is today reachable **only** through Cucumber spawning a real subprocess; a testlib skeleton makes those unit tests.

### 6. The path-safety twins — a case *against* a package

`ops/plan.ts`'s `outlinePath` (26 lines, zero imports) and `@olai/surface`'s `mediaTarget` are two copies of one discipline — segment-by-segment path judgment — in packages that cannot see each other, and `outlinePath`'s doc comment already points at its twin. A package for ~30 lines would be more manifest than product. Both packages already stand on `@olai/format`, so format is the honest shared floor: one `paths.ts` there, two imports, no new package. The same argument takes `plan.ts`'s `pathTo` (34 lines, callback-driven graph walk, no imports) wherever it is wanted, or leaves it.

### 7. Already on the record

`@olai/store` is noted in architecture.md as "extractable to its own repo later" — nothing new to add; it still holds (no workspace sibling, generic over content). And `server/src/edit.ts`'s `inverseOf` belongs down in the ops planner *when a second consumer appears* — the file records its own trigger at its own seam; do not pre-empt it.

### What is NOT lifting: `@olai/web` is three products wearing one name

Build tooling (~420 lines: `build.ts`, `markdown.ts`, `precompress.ts`), the SolidJS client (~16.5k lines), and shared vocabularies that are neither (`testids.ts`, `keys.ts`, `touch.ts`, `preference.ts`). The fix that matters here is not a new package but an honest export surface: `packages/web/package.json` claims *"the one thing here that IS imported across a package boundary is src/client/testids.ts"* — and **six** modules cross it today, all from `@olai/tests`: `testids.ts`, `theme/css.ts`, `theme/palettes.ts`, `markdown/scale.ts`, `clock.ts`, `edit/draft.ts`. The tests manifest documents three of them. Either declare the six as exports (they are contracts, and the manifests' whole argument is that contracts are declared), or shrink the list — but the current state is a stale claim on both sides of the boundary.

## The module-level sinks

These are the actual kitchen sinks — splits inside a package, no new manifests. Ranked by (severity × how free the cut is).

| # | file | lines | what's mixed in | the cut |
|---|---|---|---|---|
| 1 | `ops/src/pending.ts` | 987 | git orchestration + ~170 lines of pure vocabulary | `commits/vocabulary.ts` (below) |
| 2 | `chat/src/agent.ts` | 1119 | one 657-line closure, four separable concerns | `reading.ts`, `rpc.ts`, `permit.ts`, `model.ts` |
| 3 | `tests/support/world.ts` | 1060 | a World + 340 lines of module-scope constants | `selectors.ts`, `budgets.ts`, `served.ts`, `geometry.ts` |
| 4 | `tests/support/hooks.ts` | 845 | a server-process manager + Cucumber lifecycle | `servers.ts` (~500 lines, three-function interface) |
| 5 | `web/client/commit/said.ts` | 463 | a state machine + three copy tables + error extraction | `faces.ts`, `words.ts`, `trouble.ts` |
| 6 | `web/client/edit/editing.tsx` | 522 | caret model, write queue, undo, autosave, focus heuristics, key dispatch — all in `createEditor` | caret / dispatch / queue+undo seams |
| 7 | `surface/src/index.ts` | 500 | spec + barrel + three subjects that should be siblings | `git.ts`, `outlines.ts` |
| 8 | `format/src/derive.ts` | 726 | the indexes + the reader's tree + title tag parsing | `titles.ts` (free), `rows.ts` |
| 9 | `server/src/runtime.ts` | 494 | store binding + chat + git cells + one stateless writer path | `applyEdit` out; `gitCells.ts` |
| 10 | `web/client/keys.ts` | 257 | two unrelated keyboards + platform sniff + help data | mild; split when it next grows |

The ones worth their own sentences:

- **`pending.ts` is the package's one true sink.** `COMMIT_MODES`, `GitState`/`gitOf`, `whyOf`/`busy`/`commitDoor`, and `commitDoors` (which nothing in the file even calls) import only format types — no git, no store, no Effect — and every one is read by `@olai/server`. `message.ts` (41 lines, `AUDIT` + `signed`) is already the extracted commit-conventions leaf, and these are the same kind of thing that didn't go with it. Pulling them leaves behind a file that is purely "ask git, compare, write" — which its `survey`/`detail`/`commit`/`push`/`automatic` core genuinely is (bound by shared closure state; do not split *that*). Bonus: if the extracted module owns `GitState`, `@olai/surface`'s hand-kept mirror of the same shape becomes an import instead of a copy.
- **`agent.ts`'s cleanest cuts are already outside the closure.** The payload readers (`textOf` … `mcpServersOf`, ~190 lines over SDK types, zero state) and the JSON-RPC wrappers sit at module scope today; moving them is a file split with no rewiring. The two cuts that need a small interface are the ones worth it: `permit.ts` isolates the permission-bypass rule — the most safety-critical prose in the package (the plan-mode `auto` trap) — into a pure decision function, and `model.ts` closes over the three variables nothing else reads.
- **`world.ts` and `hooks.ts` are co-location, not coupling.** The selector contract (330 lines) and the timeout algebra touch no instance state — and extracting the latter also de-hides the `setDefaultTimeout` side effect that importing the World performs today. `hooks.ts`'s server half shares all its module state on one side of a three-function interface (`serverFor`, `scratchServerFor`, `killAll`); the Cucumber half never reaches past it.
- **`said.ts` is six vocabularies in a trench coat**, and its deliberate duplication of the ops layer's message table is documented on both sides — the split (state machine / copy tables / error extraction) does not disturb that recorded decision, it just makes each half findable.
- **`ops/src/plan.ts` is long, not mixed** — but it hosts stowaways: `pathTo` and `outlinePath` (above), the fractional-index ordering block (~100 lines that never touch `Scope`, natural home `@olai/format` beside the `ordBetween` it is the algorithm for), `nudged` (advisory prose inside the byte-planner), and `notFound` (already exported past the package boundary for `server/src/edit.ts` — it is refusal vocabulary, not planning). And `request.ts`'s `Minted`/`Applied` are answers declared in the file of asks.

## Duplications a cut would dissolve (or at least name)

- `GitState` shaped twice: `ops/pending.ts:gitOf` and `@olai/surface`'s git cell — one owner after the vocabulary extraction.
- The WeakMap-on-`OutlineSet` memo, twice with near-identical doc comments: `query.ts`'s `INDEXED` and `pending.ts`'s `BY_FILE`. One "per-revision derivations" module — which also stops `plan.ts` and `ops.ts` importing the read module just for a cache.
- `outlinePath` / `mediaTarget` (entry 6 above).
- `tools.ts`'s ~130 lines of agent-facing prose restate policy that lives in `pending.ts` and `plan.ts` (the `commit` description restates the three commit decisions; `set_done`'s restates the stamping rule). Nothing enforces agreement. Not a split — a drift risk to keep in mind whenever either side changes.

## Checked, and explicitly not sinks

Recorded so the next survey doesn't re-litigate: `plan.ts`'s thirteen `planX` functions (one shape, one `Scope`, one return — length is not mixture); `server/src/edit.ts` (two readings of one `Reading`, deliberately one `among` — its own header explains why splitting would create the bug it prevents); `format/src/validate.ts` (the "rules checked in exactly one place" invariant *is* the file; only the generic cycle machinery could leave); `chat/src/asks.ts` (pure, one subject, well tested); `server/src/serve.ts` (a composition root — the ordering is the content); and the rest of `server/src`, which is one subject per file throughout.

## Sequencing, if ratified

- **Wave 0 — free, no interfaces invented, consumers already import by name:** `chat/reading.ts` + `rpc.ts`; `tests/selectors.ts` + `budgets.ts`; `format/titles.ts`; `surface/git.ts`; the `scale.ts` re-homing. One PR, mechanical, big legibility win per line moved.
- **Wave 1 — one small interface each:** the `pending.ts` vocabulary module; `permit.ts` + `model.ts`; `tests/servers.ts`; the `said.ts` split; `runtime.ts`'s `applyEdit`/`gitCells` moves; `surface/index.ts` → siblings.
- **Wave 2 — the package lifts:** the markdown pipeline; the theme/design tokens; `precompress` (paired with `precompress-dev-tax`); the fake-agent skeleton into `chat/testlib`.
- **Recorded, not scheduled:** `@olai/committing` (blocked on `changes.ts`), `@olai/store` to its own repo, `inverseOf` down to ops on its second consumer.
- **Regardless of everything above:** fix the two stale manifest claims (web's `//exports`, tests' `//dependencies`) — those are honesty bugs today, not refactors.

## Appendix: the debate verdict — 2026-08-12

This proposal was debated the same day by three agents with assigned stances — fable (this doc's author, defending), opencode (prosecuting on Lowy's volatility bar), grok (re-deriving boundaries from demonstrated change) — in `debates/kitchen-sinks/`. The debate converged; the full ledger with every correction and the one registered objection is `debates/kitchen-sinks/conclusion.md`. What a reader of *this* document needs:

**Errata — claims above falsified by citation during the debate:**
- `precompress.test.ts` does **not** import the util; it hand-rolls its `node:zlib` calls. The "server already reaches across to test it" evidence is false — and the survey missed the filed `precompress-upstream` item, under which `precompress.ts` is scheduled for **deletion** on the kolu pin bump.
- The fake agent's "node builtins alone" is too strong: `fake-acp-agent.ts:74` imports `../support/ndjson.ts` (shared protocol framing, not olai leakage — but the clean split as described does not exist).
- The `GitState` "one owner after the vocabulary extraction" bonus is layering-impossible as written: surface can never import ops. The move that works is `GitState` (+ `gitOf`) onto `format/src/committing.ts` beside `RepoState` — one Schema, both ends import the floor, the mirror dies.
- "`commitDoors` — which nothing in the file even calls" is file-scoped-true but tree-misleading: `server/commits.ts:56` interpolates it into `--help`.

**The verdict on the proposal's shape:** zero of the four package lifts survives as a package. The isolation lens ("imports nothing outside itself") selects for *stability*, which is the inverse of volatility decomposition — confirmed empirically: `@olai/git`'s socket has never been edited since extraction while `pending.ts` above it was touched by every git PR in the window. The length-ranked module table is a Hickey/legibility index, not a Lowy argument, and its "waves" are dead: the ratified rule is *mechanical = free, do opportunistically when a PR is already in the file; axis-bearing = needs a named axis; nothing is scheduled as a program.*

**The ratified list (replaces "Sequencing, if ratified" above):**
1. Fix both stale manifests against the **six** real imports (the count above was right; the debate verified it twice).
2. `scale.ts` → `theme/` — directory, not `@olai/theme`.
3. `GitState` + `gitOf` → `format/src/committing.ts`; mirror deleted. `COMMIT_MODES`/`whyOf`/`commitDoor`/`commitDoors` stay in ops.
4. Adapter interpretation as one module in `chat` (`shouldBypass`, `toolNameIn`, `liveModelIn`/`labelsOf`, the `mcp__` prefix) — pure, unit-tested, no subprocess; session lifecycle stays in `agent.ts`; fake-agent skeleton stays in `tests/agent/`, no testlib.
5. Grow the Edit union (`menu-verbs`/`editor-op-parity` are the work); no surface sibling-file project meanwhile.
6. On the next verb-list growth: tool and panel prose each read from the planner's typed policy structures — never bound to each other (opencode's registered objection, adopted).
7. `precompress-dev-tax` fixed in place; the file dies on the upstream pin.
8. `said.ts`, `keys.ts`, `pending.ts`'s closure, and everything in "checked, and explicitly not sinks" stay whole. `format/paths.ts` is struck. `@olai/committing`/`@olai/store`/`inverseOf` stay properly deferred.
