# The orchestrator: olai over kolu

Status: brainstorming, rev 2 (2026-08-23), being fleshed out with the human. **The visual version is [orchestrator.html](./orchestrator.html)** — one PR walked end to end, moment by moment, olai and kolu side by side; read that first, this file is the reference behind it. (This file replaces both the stale 2026-08 orchestrator.md and orchestrator-in-olai.md; the eight lapses and the earlier rulings live in git history.) Roadmap: `orchestrator-in-chat` is the parent this work re-homes under; children to be filed when this settles.

**The vision, in the human's words:** olai is the orchestrator — for autonomous PRs overnight and for the same work by day — using kolu terminals to actually effectuate it behind the scenes: pi where applicable, deterministic (procedural) harness where important. Olai **works on top of kolu and never launches agents itself**: every process with a model in it is a kolu terminal.

**Night is not a mode.** The driver, the gates, the executor classes are the same around the clock; the only variable is how fast Needs-you gets answered. By day you're beside it — a `#human` gate resolves in minutes, you peek at snapshots, re-brief through chat. By night nothing resolves the human gates, so lanes run to their gates and park. "Overnight" is just the cleanest demonstration of autonomy: whatever merges at 3am merged with zero trust in anyone being awake.

## Rulings

First round (2026-08-22, question tool):

- **Executor: olai is the harness; the agent is a function.** Olai's server runs the driver loop — kolu events land on the board as facts, gates flip from machine-checkable predicates, dispatch / merge / retire are mechanical — and hands a brief to an agent only for the steps that need judgment.
- **Dashboard v1 shows four things:** the lanes board (lane × step, live marks); the whole kolu fleet with olai's ownership overlay; a needs-you queue derived mechanically; PR state. Streaming terminals into olai is **someday**; snapshots on demand are not (below).
- **Human acts by buttons and by chat, both:** mechanical acts are buttons; anything needing words goes through the chat agent with the lane as context.
- **First cut is read-only:** page + server-side padi client, no actions, no loop; the terminal orchestrator keeps running beside it and retires verb by verb.
- **Kolu link: olai's server is a `@kolu/surface` client of padi** (`connectPadi` over the unix socket, `mirrorRemoteSurface` of `terminals` / `urgency` / `watchStates`). Not MCP, not parsed ndjson.
- **GitHub reads: ride kolu.** Padi's per-terminal PR sensor carries `pr` on every terminal record; olai reads that. Where `PrInfo` is short, the fix is upstream.
- **Policy lives on `dag.olai` nodes, code interprets:** steps carry `kind` and `gate` properties; `after` edges stay the DAG. Changing the pipeline is an outline edit.
- **Home: `docs/orchestrator` in this repo**, served by the production olai. The page is `/orchestrator`.
- **Other repos:** every repo gets an olai vault eventually; how the harness updates a vault other than its own is undecided.
- **Sequencing with kolu:** olai does not hydrate the padi daemon — kolu ships a thin client package first and PR 1 waits on it; the gates PR waits on `PrInfo` growing `reviewDecision` / `mergeStateStatus` — no interim `gh` in olai.
- **Approval:** a lane carries `merge=auto|human` from dispatch; `auto` merges when every gate is green, `human` puts the approve step in the queue and the Approve button writes `approved=<time>`.

Second round (2026-08-23, this session):

- **Executor classes** (below) refine `kind`: a step's boundedness decides its harness. **pi runs the bounded `mechanical` steps** — the human is already adding pi support to kolu (alongside opencode, grok), so `agentBucket` and `lifecycle.create` work for pi before this ships; assume it.
- **The judge is Fable via headless `claude -p` on the human's subscription** — and, per the everything-through-kolu rule, it runs **in a kolu terminal**, not as an olai subprocess and not as an ACP session olai opens. This *replaces* the first round's "harness opens headless ACP sessions" ruling and drops its prerequisite (chat growing to many sessions). The judge's transcript is read the way any terminal is read: `screen.text`.
- **Procedural steps carry no model at all.** The two costliest lapses in the old orchestrator (zombie terminals, promised-but-unsent actions) were a model being asked to remember what a for-loop does perfectly.
- **Gates are configuration, not instruction** (arXiv 2608.08654 §7: agents ignore the interface they're assigned; removing the credential is what works). Nothing overnight is *trusted* not to merge; everything but the merge step is *unable* to.
- **`lanes.olai` is an ordinary outline.** No special rendering in the outline view — the glyph vocabulary (todo box, doing half-box, done check, blocked hourglass) already draws a lane's state. The specialness is the **`/orchestrator` route**, which draws the same nodes joined with padi facts — the exact precedent of `/agenda` and `/today`, which draw ordinary nodes specially.
- **Terminal snapshots on demand:** a lane card (and a fleet row) expands to a snapshot fetched through the server's padi client (`screen.text`, `screen.image` for the phone) at click time. Streaming stays someday; a snapshot is one verb call.

## Executor classes

Coined here (nearest prior art: BPMN's service/script/user task split; Löwy's volatility axis). The general rule: **the less bounded a step, the more harness it deserves — and a fully bounded step deserves no model at all.** Grounded in arXiv 2608.08654 (*The Scaffolding Matters More Than the Interface*): scaffolding dominates cost 5–28×; a small model completed a bounded git task under every scaffolding; pi was the cheapest and most reliable harness in the study; catalogue-on-demand (skills, `--help`) beats catalogue-per-request (MCP).

| class | the step is… | runs as | model | dag-pr steps |
|---|---|---|---|---|
| `procedural` | fully bounded — API calls, zero judgment | driver code in the olai server, effecting through padi verbs | none | merge, retire, dispatch itself |
| `mechanical` | bounded + verifiable, needs hands and judgment at the margin | **pi** in a kolu split, one `SKILL.md` | cheap | merge-master, ci |
| `judge` | read everything, write nothing, output a verdict | headless `claude -p` **in a kolu terminal**, read-only creds, subscription | Fable | evidence |
| `agent` (author) | open-ended — design, write, respond | Claude Code in the lane's kolu terminal | Opus | implement, refactor, address |
| *(reviewer)* | independent eyes; per-step agents, already true today | grok / opencode as kolu splits of the author | theirs | review-grok, review-opencode |
| `human` | a ruling | a Needs-you card; the lane parks | you | deferrals |

`kind ∈ { procedural, mechanical, agent, judge, human }` on `dag.olai` steps (reviewers are `agent` steps whose `agent` prop names another roster entry). A `mechanical` step also names its `agent` (pi) and its `skill`.

## What exists, so the design stands on facts

**The board** (`docs/orchestrator/`): `dag.olai` — the `pr` template, eleven steps, `after` edges, writer-after-readers, `set_doing` refusing on blocked; `lanes.olai` — one node per dispatched task (props `agent`/`repo`/`item`, the template cloned under it, `terminal` on implement, `pr` where it opened); `agents.olai` — the roster (`command`, `role`, quirks, mute list). All written through ops, never by hand.

**Olai's server:** one chat per server, browser-started turns only; no kolu client anywhere; no GitHub code. Background work lives in cell `connect` fibers (the 30 s git sweep is the model). Pages: route → `requestFor` → `streams.page` → `PageView`; agenda and day are the only aggregations. `.html` documents are served and drawn as-is.

**Padi's surface** (kolu `great-profit`, surface 5.4): collection `terminals` (active|sleeping|parked; `cwd`, `git{repoRoot,branch,worktreePath,…}`, `pr: PrResult`, `agent` folded to `agentBucket ∈ working|awaiting|waiting|other`, `parentId` for splits, `intent`, `lastActivityAt`); cell `urgency`; stream `watchStates` (the hold+nag engine, in the daemon); procedures `lifecycle.create{placement,cwd,intent}` / `kill` / `sendInput`, `git.worktreeCreate`, `screen.text`, `watch.*`, `chrome.setIntent`. `PrInfo` = number/title/url/state/checks/checkRuns — **no reviewDecision, no mergeStateStatus**. Dial: `connectPadi(socketPath)` from `@kolu/padi/dial`; socket `$XDG_RUNTIME_DIR/padi-<digest>/padi.sock`. Kolu has no lane/pipeline entity — that's the gap olai fills. **pi as a kolu agent: in progress (the human), assumed present.**

## The shape

Three layers, each a function of the one below, none holding state of its own — and one rule about hands: **the driver's only effectors are padi verbs and olai ops.** Every process that isn't the olai server itself is a kolu terminal.

```
padi (terminals, urgency, watchStates, pr) ──mirror──▶ olai server: cells.kolu, collections.fleet
lanes.olai + dag.olai + agents.olai        ──reading─▶ olai server: cells.board   (pure: reading × fleet × now)
board × fleet × pr                         ──derive──▶ olai server: cells.needsYou
                                                          ▼
                                              /orchestrator page (draws the cells; buttons call procedures)
                                                          ▼
                                              the driver fiber: facts → props, gates → marks,
                                              PROCEDURES[step] → padi verbs (create/sendInput/kill/screen.text)
```

### The driver and the procedure registry — what code, where

A new package, `packages/orchestrator`, three modules by volatility:

- **`driver.ts`** — one scoped fiber beside the git sweep (the cell-`connect` precedent), fed by the padi mirror. On each `watchStates` event or board revision: find the lane step owning that terminal → write the fact on the step as a property (`settled=<kind>@<time>`) → re-evaluate that lane's gates → flip marks through ops (`set_done` on a satisfied gate, `set_doing` on the next ready step, refusing blocked ones as the format already does) → run the newly-doing step's procedure. Every write goes through ops; every beat is a commit saying what happened.
- **`procedures.ts`** — the registry: `PROCEDURES: Record<ProcName, (lane, step, io) => Effect>`, the same shape as `TOOLS` in `packages/ops`. `io` is exactly two capabilities: the padi client and the ops layer. Procedures compose padi verbs — `dispatch` = clone template (ops) → `git.worktreeCreate` → `lifecycle.create` → `sendInput(brief)`; `spawn-review` = `lifecycle.create{parent}` + brief; `bounce` = `sendInput(failure)` to the author; `judge` = `lifecycle.create` running `claude -p --model fable` in the worktree, then `screen.text` for the verdict; `retire` = `lifecycle.kill` × N, verified against the mirrored fleet. A step names its procedure implicitly by `kind` (and `agent`), or explicitly by a `proc` prop when one step differs.
- **`gates.ts`** — the closed set of predicates (`pr-open`, `ci-green`, `mergeable`, `review-posted`, `reported`, `verified`, `approved`, `merged`, `retired`), each a pure function of board × fleet × pr, tested without a daemon.

**The volatility split:** the *composition* — which steps, what order, who runs each, which gate — is data on `dag.olai`, edited as an outline. The *primitive verbs* are code in the registry. Adding a step to the pipeline is an outline edit; adding a new kind of verb is a PR.

**The merge action** — the one effect that is neither a padi verb nor an ops write. Per everything-through-kolu, the leaning: the `merge` procedure runs it as a **one-shot kolu terminal** — `lifecycle.create` with `command: gh pr merge <n>` and the merge-capable token injected into that terminal's env at create — then verifies by watching `pr.state=merged` arrive on the padi mirror. No agent, no model; a terminal running one command is still effectuating through kolu. (Alternative, if kolu would rather own it: a `pr.merge` procedure on padi's surface beside the sensor that already runs `gh pr view`. Open question below.)

### New surface members (olai's own spec)

- `cells.kolu` — `{ status: connected|absent|skew, stateRoot?, surfaceVersion?, since }`; the page says plainly when there is no padi.
- `collections.fleet` — TerminalId → padi's record projected (`state`, `bucket`, `cwd`, `repo`, `branch`, `worktree`, `pr`, `intent`, `parentId`, `lastActivityAt`) plus olai's overlay: `owner: {kind:"lane",lane,step} | {kind:"human"} | {kind:"unowned"}` computed from `lanes.olai` `terminal` props and `agents.olai`'s mute list. Mirrored, not polled; `deltas` on.
- `cells.board` — one entry per live lane: `{lane, item, repo, agent, mark, steps:[{id,title,mark,blocked,kind?,gate?,terminal?,pr?,brief?}], pr?}`, derived from the same reading every page draws, joined with fleet.
- `cells.needsYou` — `[{lane, step?, reason, since, actions}]`, `reason ∈ {human-step, terminal-held, pr-actionable, apparatus}`. `apparatus` is new (from the paper's §2.6/§9.5): a step that failed on the rig — padi gone, credential rejected, CI infra — is re-run or surfaced as *apparatus*, never judged as work.
- `procedures.screen` — `{terminal} → {text|image}`: the snapshot-on-demand passthrough to padi's `screen.text`/`screen.image`, on the `BROWSER` face, called when a card expands. Read-only; no polling.

`fleet` and `board` also on `MCP` as resources so the chat agent and `olai surface get board` read the same board.

### The page: `/orchestrator`

A route beside `/agenda` and `/today` — the same pattern: **a special drawing of ordinary nodes.** `lanes.olai` opened as an outline is just an outline (glyphs already say todo/doing/done/blocked); `/orchestrator` draws those nodes joined with the padi mirror. Layout, top to bottom: **Needs you** (one action per row); **Lanes** (each lane a row of step chips wearing the glyph vocabulary, the author terminal's bucket, the PR pip; a chip opens its node; **a terminal pill expands the card into a `screen.text` snapshot**, refetch on demand); **Fleet** (every terminal: bucket, idle-for, repo/branch, intent, owner tag; unowned first). Read-only in PR 1: every button is a link until the actions PR.

### Policy on the template

| step | `kind` | `agent` | `gate` |
|---|---|---|---|
| implement + open PR | agent | claude | `pr-open` — padi `pr.state=open` |
| refactor passes | agent | claude | `reported` (skip-unless: non-trivial) |
| review: grok / opencode | agent | grok / opencode | `review-posted` *(upstream: PrInfo)* |
| merge latest master | mechanical | pi | `mergeable` *(upstream)*; skip-unless=conflicts |
| address findings | agent | claude | `reported` |
| CI green at head | mechanical | pi | `ci-green` — `pr.checks=pass` at head |
| evidence verified | judge | claude -p · fable | `verified` — verdict prop |
| deferrals ruled | human | — | `approved`; skipped when the report says "no deferrals" |
| merge | procedural | — | `merged` — `pr.state=merged` |
| retire terminals | procedural | — | `retired` — every lane terminal gone from fleet |

The eighth lapse stays impossible by construction: the merge *is* `approved ∧ ci-green ∧ mergeable ∧ verified` (`approved` waived under `merge=auto`).

### Credentials — gates as configuration

| actor | gh credential | can | cannot |
|---|---|---|---|
| author | push | branch, push, open PR | merge |
| reviewers | read | read, comment | push, merge |
| pi (ci) | read + CI | run odu, read checks | push, merge |
| judge | read | read everything | write anything |
| merge terminal | merge (injected at create, that terminal only) | merge when the gate holds | exist longer than one command |

### The judgment seam

A `judge` step's procedure creates a kolu terminal in the lane's worktree running `claude -p --model fable --allowedTools "Read,Bash(gh pr view:*),Bash(gh pr diff:*)"` with the evidence contract as the prompt; the verdict (typed JSON on stdout) is read back with `screen.text`, written as a prop on the step with the reason in its note, and the terminal is killed. Briefs stay `.md` documents under `docs/orchestrator/briefs/`, linked from `brief` props. The human reads a judge the way they read any terminal: the snapshot. *(This replaces the ACP-session judge; no chat-side changes are needed anymore.)*

## Upstream asks (kolu)

1. **`PrInfo` grows `reviewDecision` and `mergeStateStatus`** — two `--json` fields on the same `gh pr view` the sensor runs. Gates `review-posted` and `mergeable` wait on this.
2. **A thin client package** — padi's spec + `dial` (+ `terminal-vocab`) without the daemon. PR 1 waits on this.
3. `lifecycle.create` composing worktree → create → sendInput padi-side (noted in `oic-worktree`).
4. **pi agent support** — in progress by the human; assumed.
5. *(open)* `pr.merge` as a padi procedure, if kolu would rather own the merge than have olai inject a token into a one-shot terminal.

## PR phases

0. **kolu: thin client** (ask 2). PR 1 waits.
1. **olai: `/orchestrator`, read-only** — padi mirror (`cells.kolu`, `collections.fleet`), `cells.board`, `cells.needsYou`, `procedures.screen` (snapshot on demand), the page, `--padi-socket`, "no kolu" drawn honestly.
2. **olai: events land** — `watchStates` facts written onto lane steps by the driver; `instructions.md` drops the doorbell section.
3. **olai: actions** — the procedure registry's first verbs: dispatch (with `merge=auto|human`), kill/retire, mute, approve, re-dispatch, bounce; chat "about this lane". `instructions.md` drops dispatch and retirement.
4. **kolu: PrInfo fields** (ask 1), then **olai: gates** — `kind`/`gate`/`agent` on `dag.olai`; the driver flips marks from predicates and runs procedures; merge fires from the board. No interim.
5. **olai: judgment + pi lanes** — the judge procedure (kolu terminal, Fable, subscription); `mechanical` steps dispatch to pi with per-step skills. The terminal orchestrator retires.

## Löwy and Hickey, applied

Volatilities, one owner each: the padi link in one module; board derivation as pure functions over data; pipeline policy on `dag.olai`; gate predicates as a closed set; procedures as a registry keyed by name; the page as a function of cells. The agent proposes, the engine disposes — the split olai already has between ops and the agent, now with a third participant: the driver, which is the only thing that acts, and acts only through padi and ops. Data over vocabulary: a lane, a step, a terminal, a verdict, a snapshot are nodes or records; nothing the harness knows lives outside the board and the mirror.

## Open questions

- **Merge action's home:** one-shot kolu terminal with an injected token (leaning), or a `pr.merge` verb on padi (ask 5).
- **`SKILL.md` home for pi steps:** cloned from the template's `brief` at dispatch into the worktree's `.agents/skills/` (leaning — keeps the orchestrator self-contained), or checked into each repo, with a repo's own skills overriding.
- **Other repos' vaults:** how the harness writes a foreign roadmap — olai-to-olai surface client, or the lane's agent updates its own repo's vault and the harness only reads. Undecided.
- **Padi surface version pinning:** is olai's npins pin of kolu also its padi contract pin, or is the hello's skew check the only gate.
- **Someday:** terminals streamed into olai (`terminalAttach` exists padi-side; the page could host xterm over it). Snapshots on demand cover the night until then.
