# Brief: mcp-roster-visible — the chat shows which MCP servers a conversation has, not just the failures

You are the AUTHOR of one PR in the olai repo. You are in a fresh worktree (`.worktrees/mcp-roster-visible`, branch `mcp-roster-visible`) of `/home/srid/code/olai`. Work only here.

## The roadmap item (verbatim, roadmap/features.olai → Chat panel → `mcp-roster-visible`)

> PR: the chat shows which MCP servers a conversation has, not just the failures
> (from: the human 2026-08-22 — asked opencode "what MCPs do you have" and it omitted kolu, then used kolu fine)
>
> - #140 (mcp-fail-visible) shows MCP FAILURES in a strip and deliberately nothing on a healthy session. But "which servers does this conversation have?" is a question people actually ask — and the motivating incident is the model answering it wrong (opencode listed olai and deepwiki, omitted kolu, then called `kolu_lifecycle_create` successfully). The UI should answer it, not the model.
>
> **What to draw, honest per layer:**
> - **Handed by olai** (fully knowable, already computed by #140's probe + the `servers` event on the chat cell): `olai` (its own HTTP route, alive by construction) and `kolu` (probe-verified at session open). Chips with a dot — `olai ✓ · kolu ✓` — in the chat header popover, or the #140 strip generalized into the roster with per-server state (failures keep their verbatim sentences).
> - **Actually connected, where the agent says so**: the Claude adapter's `_claude/sdkMessage` system-init carries per-MCP-server connection status — one more field read from the same message the live model already comes from (claude leg only).
> - **The agent's own servers** (e.g. deepwiki from the user's opencode.json): invisible to olai by construction — say "plus the agent's own", never pretend the list is complete.
>
> **Scope note:** the display is per-conversation (servers are handed at session open); the roster row lives with the agent identity the header already shows.

Study #140's PR (mcp-fail-visible, squash 1c56f90) first — this item generalizes its strip/probe/`servers`-event machinery into a roster.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` at the repo root in FULL before writing code, and follow them.
- Open a PR with your implementation. You must NEVER merge it.
- Keep docs up to date (README.md, docs/*.md) where they speak of what you change.
- **No deferrals.** The PR ships everything this item names and everything you spot in code you touch. If something genuinely cannot be done in this PR, do NOT write it down as a follow-up and carry on — STOP and ASK in this terminal (what, why it cannot be done here, the options) and wait. Your PR's `## Deferrals` section must say `No deferrals.` — anything else stalls the PR. One exception: a test found flaky on master that your PR does not own goes in the PR body under `## Observed` with the reproduction, and you carry on.
- The only sanctioned test bar at report time is the LOCAL suites: typecheck, unit tests, and the e2e features your change touches. Do NOT run full CI — the orchestrator gates that later, once, after reviews are addressed.

## After the implementation works (post-implementation, since this is a non-trivial code change)

Refactor your own PR, pushing each step as isolated commits:
1. Per https://github.com/juspay/kolu/blob/master/.agents/skills/architecture-first-principles/SKILL.md
2. Per hickey (https://github.com/srid/agency/blob/master/.apm/skills/hickey/SKILL.md) and lowy (https://github.com/srid/agency/blob/master/.apm/skills/lowy/SKILL.md) TOGETHER, with human intuition keeping the architecture simple.
3. Run /simplify.

## Evidence

Produce a screenshot (or short video) showing the roster live in the chat panel — a conversation with `olai ✓ · kolu ✓` (and the honest "plus the agent's own" wording), and that #140's failure sentences still render. Embed it in the PR body via the uploads endpoint (`curl -s "https://uploads.github.com/user-attachments/assets?name=<f>&content_type=<mime>&repository_id=<id>" -X POST -H "Authorization: Bearer $(gh auth token)" -H "Accept: application/json" --data-binary @<f>`; embed the returned `.url`). Never commit proof assets to the repo.

## When done

Report in this terminal, concisely: the PR URL and head SHA, what shipped per scope layer, the local-suite results (exact counts), the evidence link, and `No deferrals.` (or your stop-and-ask). Reviewers (Grok, opencode) will be pointed at the PR afterwards; stand by to address their findings when the orchestrator sends them.