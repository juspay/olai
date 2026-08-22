# Olai as the orchestrator: the harness, the board, and the `/orchestrator` page

Status: brainstorming, rev 1 (2026-08-22), being fleshed out with the human. **The visual version is [orchestrator-in-olai.html](./orchestrator-in-olai.html)** — the shape, the page mocked with today's lanes, the gated pipeline, the phases, the rulings; read that first, this file is the reference behind it. Supersedes [orchestrator.md](./orchestrator.md) (stale; its eight lapses and the 2026-08-21 ruling are the history this file starts from). Roadmap: `orchestrator-in-chat` is the parent this work re-homes under; children to be filed when this settles.

The ask, in the human's words: the orchestrator flow that [docs/orchestrator/instructions.md](../orchestrator/instructions.md) describes — and that Claude Code runs today in a kolu terminal — done *in olai itself*, with olai presenting a dashboard.

## Rulings so far (the human, 2026-08-22, through the question tool)

- **Executor: olai is the harness; the agent is a function.** Olai's server runs the driver loop — kolu events land on the board as facts, gates flip from machine-checkable predicates, dispatch / merge / retire are mechanical — and invokes an agent over ACP only for the steps that need judgment. This is orchestrator.md's final ruling, built.
- **Dashboard v1 shows four things:** the lanes board (lane × step, live marks); the terminals — the *whole kolu fleet*, lanes overlaid, the human's own marked muted, strangers marked unowned; a *needs-you* queue derived mechanically from three sources; and PR state. Streaming the terminals themselves into olai (interact without leaving the page) is **someday**.
- **Human acts by buttons and by chat, both:** mechanical acts are buttons on the board (approve, merge, kill, mute, re-dispatch, open in kolu); anything needing words (re-brief, rule a deferral, ask the author) goes through the chat agent with the lane as context.
- **First cut is read-only:** the page plus a server-side padi client, no actions, no loop; the terminal orchestrator keeps running beside it. Then responsibilities move into olai one at a time and `instructions.md` loses the matching section each time; the terminal orchestrator retires when the DAG's last verb is olai's.
- **Kolu link: olai's server is a `@kolu/surface` client of padi** (`connectPadi` over the unix socket, `mirrorRemoteSurface` of `terminals` / `urgency` / `watchStates`) — the same pattern `kolu watch` itself uses, and the same family as surface-cli / surface-mcp. Not MCP, not parsed ndjson.
- **GitHub: ride kolu.** Padi already runs a per-terminal PR sensor (`gh pr view`, 30 s, forge-routed) and carries `pr` on every terminal record; olai reads that. Where padi's `PrInfo` is short of what a gate needs (below), the fix is upstream, not a second `gh` in olai.
- **Judgment seam: the harness opens its own headless ACP sessions;** the human's chat panel stays the human's. **Fable judges, Opus authors.**
- **Policy lives on `dag.olai` nodes, code interprets:** each step carries `kind` and `gate` properties; `after` edges stay the DAG. Changing the pipeline is an outline edit.
- **Home: `docs/orchestrator` in this repo, served by the production olai (7714).** The page is `/orchestrator`. (A separate orchestration vault was considered and withdrawn.)
- **Other repos:** every repo gets an olai vault eventually; *how the harness updates a vault other than its own is undecided* — see open questions.
- **Sequencing with kolu (second round):** olai does **not** hydrate the padi daemon for its spec — kolu ships a thin client package first and PR 1 waits on it; the gates PR (phase 4) waits on kolu's `PrInfo` growing `reviewDecision` / `mergeStateStatus` — no interim `gh` in olai, no interim event-shaped review gate.
- **Judge sessions:** one Fable session per lane, reused across that lane's judgment steps (brief → evidence → final message), visible in the panel's session list, ended at retire.
- **Approval:** a lane carries `merge=auto|human` from dispatch; `auto` merges when every gate is green, `human` puts the approve step in the queue and the Approve button writes `approved=<time>`. Today's "auto-merge on verification" in lane titles becomes that property.

## What exists, so the design stands on facts

**The board** (`docs/orchestrator/`): `dag.olai` is the template — `pr` with eleven steps, `after` edges, the writer-after-readers rule, `set_doing` refusing on a blocked node; `lanes.olai` holds one node per dispatched task (props `agent` / `repo` / `item`) with the template cloned under it as real nodes (`terminal` on implement, `pr` on the step that opened it, `brief` pointers, day-lane roots carrying the day's rulings as props); `agents.olai` is the roster (`command`, `role`, quirks, the mute list and the watch task on a `supervision-watcher` node). All written through ops, never by hand.

**Olai's server** (explorer's map, 2026-08-22): one chat per server, one conversation at a time, a turn started only by the browser's `chat.send` — there is no programmatic caller, no headless door, no second session. No kolu client anywhere in the server: kolu is only a child MCP server the *agent* is handed. No GitHub code. Background work lives in cell `connect` fibers (the 30 s git sweep is the model). Pages: a route → `requestFor` → `streams.page` → `PageView`; agenda and day are the only aggregations, both over outlines. The chat panel's subagent lanes (`packages/web/src/client/chat/lanes.ts` and its pure siblings) are the precedent for a live structured activity view.

**Padi's surface** (kolu `great-profit`, `packages/padi/src/surface.ts:1612`, version 5.4): collection `terminals` (UUID → active | sleeping | parked; active carries `cwd`, `git{repoRoot,branch,worktreePath,isWorktree,remoteUrl}`, `pr: PrResult`, `agent` with adapter-specific state folded by `agentBucket` into `working | awaiting | waiting | other`, `parentId` for splits, `intent` — freeform markdown "what this lane is doing", `lastActivityAt`); cell `urgency` (`awaitingIds` / `finishedIds` / `workingIds` / `lingerIds`, derived in the daemon); stream `watchStates` (the hold + nag engine `kolu watch` rides — **in the daemon**, `attention/stateWatch.ts`); procedures `watch.open/drain/close`, `lifecycle.create{placement, cwd, intent}` / `kill` / `sendInput`, `git.worktreeCreate`, `screen.text`, `chrome.setIntent`. `PrInfo` = `number, title, url, state, checks: pending|pass|fail|null, checkRuns[]` — **no reviewDecision, no mergeStateStatus**. Dial: `connectPadi(socketPath)` from `@kolu/padi/dial` → `{ client: { padi }, identity, dispose, onClose }`, contract-skew checked at hello; socket `$XDG_RUNTIME_DIR/padi-<digest>/padi.sock`. Remote padi over ssh exists (`surface-remote`). Kolu has **no** lane / task / pipeline entity; its own attention dock is per-terminal, per-host — the cross-repo, PR-centric pipeline view is the gap olai fills.

## The shape

Three layers, each a function of the one below it, none holding state of its own:

```
padi (terminals, urgency, watchStates, pr)  ──mirror──▶  olai server: cells.fleet, cells.kolu
lanes.olai + dag.olai + agents.olai         ──reading──▶  olai server: cells.board   (pure: reading × fleet × now)
board × fleet × pr                          ──derive───▶  olai server: cells.needsYou
                                                            ▼
                                                 /orchestrator page (draws the three cells; buttons call procedures)
                                                            ▼ (later)
                                                 the driver loop: events → props; gates → marks; mechanical verbs; judge over ACP
```

### New surface members (olai's own spec)

- `cells.kolu` — `{ status: connected | absent | skew, stateRoot?, surfaceVersion?, since }`. The dashboard says plainly when there is no padi rather than drawing an empty fleet.
- `collections.fleet` — key TerminalId → the padi record *projected* (`state`, `bucket`, `cwd`, `repo`, `branch`, `worktree`, `pr`, `intent`, `parentId`, `lastActivityAt`) **plus** olai's overlay: `owner: { kind: "lane", lane, step } | { kind: "human" } | { kind: "unowned" }`, computed from `lanes.olai`'s `terminal` props and `agents.olai`'s mute list. Mirrored, not polled; `deltas` on.
- `cells.board` — `[{ lane, item, repo, agent, mark, steps: [{ id, title, mark, blocked, kind?, gate?, terminal?, pr?, brief? }], pr?: PrInfo }]`, one entry per live lane (day-lane roots grouped as today), derived from the reading — the same reading every page draws — joined with `fleet` for terminal state and `pr`.
- `cells.needsYou` — `[{ lane, step?, reason, since, actions }]` with `reason ∈ { human-step, terminal-held, pr-actionable }`: (1) an unblocked step whose `kind=human`; (2) a lane terminal `awaiting`/`waiting` held past the threshold while its lane owes an unblocked non-human step, or a nag the engine could not resolve; (3) a PR that is approved and green but unmerged, or whose checks failed. Each row names the action(s) that clear it. No judgment in the queue.

All four on the `BROWSER` face; `fleet` and `board` also on `MCP` as resources so the chat agent and the CLI can read the same board (`olai surface get board`).

### The page: `/orchestrator`

A sixth route beside `/agenda` and `/today`, one component subscribing to the three cells. Layout, top to bottom: **Needs you** (the queue, one action per row); **Lanes** (each lane as a row of step chips — todo / doing / done / blocked — with the author's terminal state and the PR pip: number, checks, state; a step's chip opens its node; a lane's row opens its kolu terminal in kolu); **Fleet** (every terminal: bucket, idle-for, repo/branch, intent, owner tag; unowned ones first). The kolu status line at the top. It is read-only in PR 1: every "button" is a link (to the node, to kolu, to the PR) until the actions PR.

### Policy on the template

`dag.olai`'s steps gain two properties the engine reads; nothing else changes:

| step | `kind` | `gate` |
|---|---|---|
| implement + open PR | `mechanical` (dispatch = `set_doing` + spawn) | `pr-open` — padi's `pr.state=open` on the lane's terminal |
| refactor passes | `agent` (the author does it in its terminal) | `reported` — the author's settle after the step was briefed |
| review: grok / opencode | `mechanical` (spawn the split) → `agent` | `review-posted` — a review on the PR *(upstream: `PrInfo` lacks it today)* |
| merge latest master | `mechanical`, `skip-unless=conflicts` | `mergeable` *(upstream: `mergeStateStatus`)* |
| address findings | `agent` | `reported` |
| CI green at head | `mechanical` | `ci-green` — `pr.checks=pass` at the PR's head |
| evidence verified | `judge` | a verdict prop written by the judge |
| deferrals ruled | `human` | `approved` — one bit the human sets (button), skipped when the report says "no deferrals" |
| merge | `mechanical` | `merged` — `pr.state=merged` |
| retire terminals | `mechanical` | every lane terminal gone from `fleet` |

`kind ∈ { mechanical, agent, judge, human }`; `gate` names a predicate from a closed set the engine implements. A step with `kind=agent` is *owed to the lane's author* — the engine sends the brief and waits for the settle; a `judge` step opens a Fable session; a `human` step enters the queue. The eighth lapse becomes impossible by construction: no premise sits between a green board and the merge, because the merge *is* `approved ∧ ci-green ∧ mergeable ∧ evidence=verified`.

### The driver loop (later PRs)

One scoped fiber beside the git sweep, fed by the padi mirror. On each `watchStates` event: find the lane step owning that terminal → write the fact on the step as a property (`settled=<kind>@<time>`, the sixth lapse's "events must become nodes", done by the engine) → re-evaluate that lane's gates → flip marks (`set_done` on a satisfied gate, `set_doing` on the next ready mechanical step, refusing blocked ones as the format already does) → execute the mechanical verb for a newly-doing step (spawn, send brief, merge, kill). Escalation is an `if`: a second nag with no new fact on the same block → `needsYou` row, reason `terminal-held`. Every write goes through ops; every beat is a commit with a message saying what happened.

### The judgment seam (later)

`judge` steps open a headless ACP session — Fable, from `agents.olai` (`role=judge`) — with the lane (item desc, brief, PR URL, the author's final message from `screen.text`) as context, and a typed answer schema: brief text, or `{ verdict, reason }`. Briefs are `.md` documents under `docs/orchestrator/briefs/` (as today) linked from the step's `brief` prop; verdicts are props on the step with the reason in its note. Prerequisite: chat grows from one session to many — the panel's session and N harness sessions, each with its own transcript; the surface's `transcript` gains a session key. The judge's session is visible in the panel's session list so the human can read it.

## Upstream asks this creates (kolu)

1. **`PrInfo` grows `reviewDecision` and `mergeStateStatus`** (and ideally the list of review comment URLs) — two `--json` fields on the same `gh pr view` the sensor already runs. Without them `review-posted` and `mergeable` have no mechanical predicate.
2. **A thin client package** — padi's spec + `dial` (+ `terminal-vocab`) without the daemon, so a consumer like olai hydrates a client, not padi. (Today olai would pull `@kolu/padi` whole through the npins hydrate list.)
3. Already noted in `oic-worktree`: `lifecycle.create` composing worktree → create → sendInput padi-side, so dispatch is one procedure.

## Löwy and Hickey, applied

Volatilities, each with one owner: the **padi link** (socket / ssh / absent / contract skew) in one server module; the **board derivation** (lanes × fleet × pr → board, needsYou) as pure functions over data, tested without a daemon; the **pipeline policy** on `dag.olai` nodes; the **gate predicates** as a closed set in code; the **page** as a function of three cells. The agent proposes, the engine disposes — the same split olai's core already has between ops (deterministic, the ledger's only committer) and the agent. Data over vocabulary: a lane, a step, a terminal, an event are all nodes or records; nothing the harness knows lives anywhere but the board or a derived cell. The thing that was *attention* in eight lapses is a collection with `deltas` now.

## PR phases (olai PRs each self-sufficient; kolu PRs gate them where ruled)

0. **kolu: the thin client** (ask 2) — padi's surface spec + `dial` (+ `terminal-vocab` schemas) as a package a consumer hydrates without the daemon. **PR 1 waits on this.**
1. **olai: `/orchestrator`, read-only** — pin kolu; the padi mirror (`cells.kolu`, `collections.fleet`), `cells.board`, `cells.needsYou`, the page, `--padi-socket` (default: padi's own convention) on `olai web`, "no kolu" drawn honestly. The terminal orchestrator keeps running; the page reads the same board.
2. **olai: events land** — `watchStates` facts written onto lane steps by the engine; the terminal orchestrator reads them instead of a Monitor; `instructions.md` drops the doorbell section.
3. **olai: actions** — dispatch (clone the template + worktree + create + send brief, `merge=auto|human` set at dispatch), kill / retire, mute, approve (`approved=<time>`), re-dispatch; chat "about this lane". `instructions.md` drops dispatch and retirement.
4. **kolu: `PrInfo` grows `reviewDecision` + `mergeStateStatus`** (ask 1), then **olai: gates** — `kind` / `gate` on `dag.olai`; the engine flips marks from predicates and runs mechanical verbs; merge fires from the board (`approved ∧ ci-green ∧ mergeable ∧ evidence=verified`, or without `approved` under `merge=auto`). **Waits on the kolu PR; no interim.**
5. **olai: judgment** — many chat sessions; one Fable judge session per lane; briefs and verdicts as documents/props. The terminal orchestrator retires.

## Open questions

- **Other repos' vaults:** when kolu / nixos-config have olai-served roadmaps, how the harness writes them — olai-to-olai surface client (one link per vault), or the lane's agent updates its own repo's roadmap and the harness only reads. Undecided by the human; not needed for PR 1–4 (olai's own items are in this vault; a foreign lane's `item` can be a URL meanwhile).
- **Padi surface version pinning:** the thin client carries `PADI_SURFACE_VERSION`; whether olai's npins pin of kolu is also its padi contract pin, or the hello's skew check is the only gate.
- **Someday:** terminals streamed into olai (`terminalAttach` exists on padi's surface — the page could host xterm over it).

Resolved in the second round (recorded above under Rulings): no interim review/mergeable gate — phase 4 waits on kolu; no hydrating the daemon — phase 1 waits on the thin client; one judge session per lane; `merge=auto|human` + `approved`.
