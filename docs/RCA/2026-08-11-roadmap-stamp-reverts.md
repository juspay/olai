# RCA: three merged PRs silently reverted by roadmap stamp commits (2026-08-11)

**Status**: fully remediated (all three features restored); prevention partially adopted, structural fix deliberately open — the human will decide it separately.

## What happened

On the morning of 2026-08-11, an orchestrator session squash-merged three PRs and, seconds after each merge, pushed a "roadmap done-stamp" commit to master that silently **reverted the entire PR it was stamping done**. Each stamp commit's tree held the pre-merge content for exactly the files the PR had touched, so each one is a mass revert wearing a one-line bookkeeping message:

| stamp commit | time (EDT) | claims to be | actually is | reverted PR (merge commit) |
|---|---|---|---|---|
| `dd34849` | 06:39:12 | roadmap: paste-image done (#87) | 29 files, +49/−1830 | #87 "Paste an image into the chat" (`44f2da5`, 06:38:54 — **19 s earlier**) |
| `a56cb65` | 06:43:?? | roadmap: title-markdown done (#84) | 25 files | #84 "Inline markdown in titles" (`e1ab412`, 06:43:14 — seconds earlier) |
| `12ea294` | 06:58:00 | roadmap: commit-button done (#83) | 59 files, +390/−4415 | #83 "Commit changes on purpose" (`c5bcbdf`, 06:57:37 — **23 s earlier**) |

Verification used for each: `git diff <merge>^ <stamp> -- . ':!docs/roadmap.jsonl'` is **empty** — the stamp's tree outside the roadmap file is byte-identical to the state *before* the PR merged. The roadmap hunk in each stamp (flipping the item to done) was correct and intended; the thousands of deleted lines beside it were not.

The features were absent from master for the rest of the day — roughly 12–18 hours — while the roadmap asserted them done. Master ended the day with, among other losses: no paste handler in the chat composer, no inline markdown in titles, and no commit-on-purpose machinery (which later manifested as the "commit spam" complaint, misdiagnosed twice before the truth surfaced).

## Blast radius

- **#87 paste-image**: the whole attachment pipeline (`surface/attach.ts`, `chat/attachments.ts`, client `attach.ts`/`Attachments.tsx`/`previews.ts`, composer/wire/ACP edits) **and its e2e coverage** (`the_agent.feature` hunks, `chat_steps.ts`, `fake-acp-agent.ts`, `world.ts`).
- **#84 title-markdown**: the inline-only markdown pipeline for titles, and its tests.
- **#83 commit-on-purpose**: `--commit=off|manual|auto` (manual default), `Ops.commit`, pending-changes derivation (`pending.ts`, `message.ts`, `changes.ts`), the `X-Olai-Writer` audit trailer, the chrome commit pill — 4415 lines — and its tests.
- **The ledger lied**: all three items read `done` while the code was gone. Downstream, a whole work item (`mcp-commit-manual`) was filed and dispatched on a false premise ("#83 shipped for web only") before the revert was discovered.
- The user hit it live twice: pasting an image did nothing (the discovery trigger), and per-op ledger commit spam existed only because #83's manual mode wasn't on master.

## Root cause

**Proximate**: each stamp was committed with a whole-tree sweep (`git commit -a` / `git add -A` class) from a checkout whose HEAD was at the just-merged commit but whose **working tree still held pre-merge content for the PR's files** as local modifications. The commit therefore recorded those stale files as deletions/reversions alongside the intended one-file roadmap edit.

**How the tree got stale** (inference; the session's transcript predates the current orchestrator's context): the signature — post-merge HEAD, pre-merge file content, exactly the PR's file set, three times in 19 minutes at automation speed — is consistent with the orchestrator running state-changing git in a checkout that had been used for other operations (PR inspection, builds, checkouts of older refs into the tree), leaving stale file content as dirty modifications that a subsequent broad `commit -a` swept up. The same session's later, unaffected stamps were single-file, which suggests the dirty state was episodic, not systematic.

**Systemic** (the real cause): the orchestrator hand-rolled ledger writes with raw git in a shared mutable checkout. That practice produced three distinct failure classes in one day, of which this incident is the worst:

1. **Stray-file sweeps** — this incident.
2. **Wrong-tree state** — the current session twice ran state-changing git in the wrong directory (a `reset --soft` that landed on an agent's branch; a ledger commit + rebase inside an agent's worktree). Both caught within seconds — by luck and narrower staging, not by structure.
3. **Invalid data** — scripted `jq` edits later shipped a roadmap with double-marked records that olai's own validator refused to load; raw edits bypass the validation the ops write gate performs on every write.

## Why every fence failed

- **No CI on master pushes**: odu CI runs on PRs; direct pushes to master run nothing.
- **The reverts deleted their own regression fences**: #87's e2e went with #87, so every later CI run was *honestly* green — there was nothing left to fail.
- **The ledger vouched for the lie**: items marked `done` meant nobody looked for the features.
- **The commit-message convention gave cover**: `roadmap:`-titled commits are expected to be one-file; nothing checked that they were.
- **No diff review before push**: 19–23 seconds between merge and push leaves no moment where a human or check saw "+390/−4415" on a bookkeeping commit.

## Detection

Found ~12 h later, outward-in: the human pasted an image and nothing happened → a silent-error audit traced the paste path to *absence*, not failure, and git archaeology found `dd34849` → a dispatched agent hit the same wall on #83 and identified `12ea294` as its exact content-inverse → a targeted audit of all `roadmap:` stamps found `a56cb65` → a full-history sweep (every non-PR commit by author identity, plus every merge commit's combined diff) bounded the incident at **exactly three**; all other multi-file non-PR commits are additive prose, and the one large merge commit resolves cleanly to its origin side.

## Remediation (complete)

- #87 restored by **PR #111** (`2de0ef5`): revert of `dd34849` minus its roadmap hunk, restored e2e passing.
- #84 restored by **PR #113** (`ae59f9e`): reconciled with #102's tag pills — inline markdown and pills coexist in one title.
- #83 restored by **PR #114** (`10d72f8`): reconciled with #94/#104/#106/#108 — notably #108's git readout became a projection of #83's pending survey (one probe, not two rival ones), the not-a-repo/git-error distinction was preserved against regression, and `Applied.why` under manual mode reads as "waiting", never as a fault.
- Ledger corrected: the three items' false-done history is annotated in place; the restores are their own tracked items.

## Prevention

**Adopted** (Orchestrator.md, the operating doc, now mandates): the roadmap is written only through olai's own ops (validated, single-file, ops-layer-committed); the orchestrator's only git verbs in the main checkout are `git pull --ff-only` and `git push`; one commit per orchestration beat once `mcp-commit-manual`'s second PR gives the MCP face `--commit=manual` + the `commit` verb.

**Open, awaiting the human's decision** (deliberately not designed here):

- A **stamp-purity check** — any commit claiming to be bookkeeping (`roadmap:`/`done:`/`note:`/`capture:` etc.) must touch exactly `docs/roadmap.jsonl` — as a pre-push hook, a CI lane over the pushed range, or both. Would have stopped all three commits cold.
- Whether master pushes should run CI at all (or be restricted to PR merges + ops-authored ledger commits).
- `mcp-mirror-op`: mirrors (and `after` edges) still aren't expressible through ops, leaving one residual scripted-edit path into the ledger.
