# instructions.md breaks down into the orchestrator's outline data

Status: PLAN, step-by-step (the human 2026-08-25: "We'll do it step by step. One at a time."). Ruled the same day: **stage-shaped rules live on dag.olai's step nodes** — each pipeline step's desc carries its stage's rules, read at the moment they apply, carried into every lane by the template. Roadmap: `instructions-md-breakdown` (infra → Process & orchestration).

## Why

`orchestrator/instructions.md:7` already states the law this plan finishes: *"A fresh session must be able to read the board and know everything a dead session knew... this file's own rules graduate there too as nodes learn to hold them."* The file is ~80 lines of rules that mostly duplicate — or now LAG — what the board already holds (the reviewer roster rotation, the CI venue rulings, the mirror shape all changed on the board while the doc stood still). A rule stored twice drifts; the board copy is the one that gets amended at the moment of ruling, so the doc copy is the one that lies.

## The inventory — every section, its destination

| instructions.md | What it is | Destination |
|---|---|---|
| L1–3 identity, worktrees, model economy | bootstrap | **KERNEL** (stays prose; model economy → already `agents-root` props) |
| L5–7 orchestrator memory | the meta-rule | **KERNEL** — it's the rule that makes the rest data |
| L9–13 planning, board-only-via-ops, commit=manual, one-commit-per-beat, git verbs | board protocol | **lanes root desc** (beside the conventions already there) |
| L16–18 lanes.olai shape | already graduated | superseded by the lanes root conventions (mirror shape, 2026-08-24) — DELETE |
| L20–28 kolu-only, spawn shape, the watch mechanism, babysit, sync master | who/supervision | mostly graduated (`supervision-watcher`, agents-root props); spawn mechanics → **dag-pr-implement desc**; the watch contract stays on supervision-watcher |
| L30–39 implementation guidelines (PR-open, never merge, refactor skills, no CI at implement) | stage rules | **dag-pr-implement + dag-pr-refactor descs** (refactor step already carries the skills list) |
| L41–47 review protocol (cross-review, PR comment, address, CI once, conflict hygiene, no two agents on same files) | stage rules | **dag-pr-review-\* / dag-pr-address / dag-pr-merge-master / dag-pr-ci descs** |
| L49–56 evidence upload recipes (curl, ffmpeg) | reference recipes | **dag-pr-evidence desc** |
| L58–68 approval gate, merge order, cleanup separation, read-the-author's-last-word, ratification | stage rules | **dag-pr-merge + dag-pr-retire descs** (retire already carries the zombie-terminal ruling) |
| L70–77 no-deferrals | stage rule | **dag-pr-deferrals desc** (the step exists; the law's full text belongs on it) |
| L80 green-ci footnote (gh pr checks --required) | stage rule | **dag-pr-ci desc** |

## dag.olai drift to fix while landing rules (each its own beat)

1. `dag-pr-review-opencode` — opencode retired; the rotation is grok/pi (a lane picks per the roster). Rename/generalize: two review steps as roles, reviewer named at clone time via the `reviewer` prop.
2. The root's clone law — superseded by the MIRROR shape (2026-08-24 ruling: steps as children of the roadmap item, day board holds a mirror). Rewrite the root desc.
3. `dag-pr-ci` desc is EMPTY — gets the 2026-08-25 law: **CI is the orchestrator's, run ONCE at close, never the author's** (tp's just-check-as-CI deviation is the provenance), plus the green-ci footnote.
4. `dag-pr` desc names `pr`/`item` props — the typed vocabulary renamed/dropped these (`pr-url`; `item` died for mirrors).

## The kernel (target end state, not this week)

instructions.md shrinks to: identity (orchestrator, worktrees under .worktrees/), the memory rule, and "the board is the instructions": read `agents.olai` (who + standing rules + supervision), `dag.olai` (the pipeline; each step's desc is that stage's law), `lanes.olai` (live work, conventions in the root, newest day last). Everything else is a node.

## Step-by-step order (one graduation per beat, doc line-range deleted only after its node lands)

1. **dag-pr-ci** — land the CI law (highest drift risk: it's currently only in two briefs). Delete L39's CI sentence + L80.
2. **dag-pr-deferrals** — the no-deferrals text whole. Delete L70–77.
3. **dag-pr-merge + dag-pr-retire** — approval gate, merge order, cleanup separation, author's-last-word. Delete L58–68.
4. **review steps** — protocol + the opencode→rotation fix. Delete L41–47.
5. **dag-pr-implement (+refactor)** — spawn mechanics + implementation guidelines. Delete L20–24, L30–38.
6. **lanes root** — board protocol (ops-only, commit-per-beat, git verbs). Delete L9–18.
7. **kernel rewrite** — the ~10-line instructions.md. Requires 1–6 landed.

Each beat: node desc written via MCP → the doc's covered lines replaced by a one-line pointer (or deleted) → one commit. The doc and the board never both claim to own a rule.

## Open questions for the human

- The dag template's two review steps: keep two named steps (rename opencode→pi) or one `review: <role>` step cloned N times per the lane's reviewer list?
- Does the evidence-recipes block (curl/ffmpeg) belong on dag-pr-evidence, or in a small standalone reference doc the step points at? (It's a recipe, not a rule.)
- The kernel keeps AskUserQuestion-for-planning (L11) or lets that stay conversational habit?
