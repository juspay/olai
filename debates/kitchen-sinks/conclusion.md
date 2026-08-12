# Conclusion — the agreed ledger

Three debaters (fable — the document's author, defending; opencode — prosecuting on Lowy's volatility bar; grok — re-deriving boundaries from demonstrated change), three rounds, converged despite an open-ended charter. Every item below was signed by all three stances in their round-3 closings unless marked otherwise.

## The ratified proposal (supersedes the doc's "Sequencing, if ratified")

**Zero new packages.** None of the survey's four package lifts survives as a package.

1. **Honesty, any day.** Fix both stale manifest claims against the **six** real cross-boundary imports (`testids.ts`, `theme/css.ts`, `theme/palettes.ts`, `markdown/scale.ts`, `clock.ts`, `edit/draft.ts`): `@olai/web`'s `//exports` and `@olai/tests`' `//dependencies`. Declare the contracts or shrink the list.
2. **Re-home `markdown/scale.ts` under `theme/`.** The one misfiling all three stances found independently. Directory, not `@olai/theme` — the package case collapsed on the likelihood check ("adding a theme is adding a row" is the encapsulation already) and on `chrome.ts` proving the directory can grow a second axis without a manifest.
3. **`GitState` (+ `gitOf`) onto `format/src/committing.ts`** as a Schema beside the `RepoState` it already re-exports. Ops produces, surface carries, the hand-kept mirror at `surface/index.ts:212` dies. This is #122's missing floor piece. The survey's ops-altitude version ("extract `pending.ts` vocabulary and the mirror becomes an import") is struck — surface can never import ops; the floor import is the pattern `RepoState` already proves. `COMMIT_MODES`/`whyOf`/`commitDoor`/`commitDoors` stay in ops.
4. **Adapter interpretation as one module in `chat`** (grown `adapter.ts`, or `interpret.ts` beside it): `shouldBypass` (the plan-mode auto trap as a pure decision), `toolNameIn` (`_meta.claudeCode.toolName`), `liveModelIn`/`labelsOf`, the `mcp__` prefix rule — unit-tested the `asks.ts` way, no subprocess. Session lifecycle stays in `agent.ts`. The fake-agent skeleton stays in `tests/agent/` (a `bin/` wrapper if the stdin-on-import hazard matters); no `chat/./testlib`, no package. This is the one `agent.ts` cut that survives the next adapter.
5. **Grow the Edit union** (`surface/src/edit.ts` + `server/src/edit.ts`) — the two-face HACKING axis, in flight via `menu-verbs`/`editor-op-parity`. No sibling-file project in `surface` while the union moves; `GitState` leaving `index.ts` is a consequence of item 3, not a project.
6. **Tool/panel prose reads from the planner's typed policy structures** when the verb list next grows. Same finding, settled knife (see the registered objection below): source each prose face from the policy source; never bind agent-facing and person-facing prose to each other.
7. **Precompress: fix `precompress-dev-tax` in place; delete `precompress.ts` on the kolu pin bump** per the filed `precompress-upstream` item. The receptacle is `@kolu/surface-app.buildSurfaceClient`; an olai leaf would be duplicated encapsulation of kolu's axis.
8. **Everything else is navigation-on-touch under the mechanical bar** — *mechanical = free, do opportunistically when a PR is already in the file; axis-bearing = needs a named axis.* `titles.ts`, `tests` selectors/budgets pass as mechanical; `reading.ts`/`rpc.ts` and `surface/git.ts` fail; nothing is scheduled as a wave. "Do not pre-split the tree so the next survey finds shorter files."

**Stays whole, on the record:** `said.ts` (a new pill face is an arm of `faceOf` *and* a row of the copy tables — splitting makes one axis a multi-file change); `keys.ts` (the one-file collision invariant is the content); `pending.ts`'s survey/commit/push closure; `plan.ts`; server `edit.ts`; `validate.ts`; `runtime.ts`'s bind. **Struck:** `format/paths.ts` (different allowlists; the twin comment documents a rhyme, not a missing function). **Properly deferred:** `@olai/committing`, `@olai/store` own-repo, `inverseOf` down to ops — each waits on a dated second consumer; prove-then-extract governs when.

## Corrections to the survey document, established by citation

- `precompress.test.ts` does **not** import the util (it hand-rolls `node:zlib` calls) — the doc's "the server already reaches across to test it" is false.
- The fake agent imports `../support/ndjson.ts` (line 74) — "node builtins alone" was too strong, though the import is shared protocol framing, not olai leakage (opencode withdrew the strong form after reading `ndjson.ts`'s header).
- The roadmap already holds `precompress-upstream` — the file is scheduled for deletion; the survey missed it.
- The `GitState` "one owner after the vocabulary extraction" bonus was layering-impossible as written (ops altitude); it survives only at format altitude.
- The doc's six-import count was **right**; opencode's round-1 "four" correction was the error (multi-line imports escaped its grep) and was withdrawn.
- The doc's "`commitDoors` — nothing in the file even calls it" was true as written (file-scoped) but misleading tree-wide (`server/commits.ts:56` interpolates it into `--help`); the doc should name the consumer.

## The empirical anchor

opencode ran fable's retrodiction challenge: `git log --diff-filter=M -- packages/git/src/index.ts` is **empty** — `@olai/git`'s socket has never been edited since extraction, while `pending.ts` above it was touched by every git PR in the window (#83, #114, #116, #119, #122). Plumbing-vs-policy is a real axis; the survey's isolation lens selected for *stability*, which is the inverse of volatility decomposition. "The survey found the rooms; the debate placed the walls."

## Registered objection (opencode, round 3)

The `tools.ts` ↔ `pending.ts`/`plan.ts` prose drift is the highest-stakes duplication in the tree, **but** "bind or generate the descriptions" would weld two prose axes together (agent-facing description vs person-facing phrase — `said.ts:8–15`'s own recorded argument). The fix is each prose site reading from the planner's typed structures, never from each other. grok conceded the knife in round 3 ("target kept; mechanism corrected"); fable adopted it; the objection is recorded so it is lost only to a better argument, not to silence.

## Open questions

- **When does a "dated second consumer" exist for the markdown pipeline?** The email-digest idea remains speculative; the directory is already the extraction unit if one appears.
- **Does the fake-agent stdin hazard still warrant the `bin/` wrapper now, or on next touch?** (Its header also carries a stale path — `packages/server/src/chat/agent.ts` — worth fixing whenever touched.)
- Whether item 3 and item 4 ride one PR or two is sequencing nobody debated.
