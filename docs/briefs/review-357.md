# Review brief: PR #357 — the panel says which MCP servers a conversation has (mcp-roster-visible)

You are a REVIEWER. The PR: https://github.com/juspay/olai/pull/357, head c4a4f1db, branch mcp-roster-visible. You are in the author's worktree (`.worktrees/mcp-roster-visible`) — read, build, run; do not push to it.

## What to do

1. Read `HACKING.md` at the repo root in FULL and review the PR per its guidelines.
2. The roadmap item's ruled scope (roadmap/features.olai → `mcp-roster-visible`): three honest layers — (a) rows handed by olai off the literal `mcpServers` given to session/new; (b) upgraded to connected only where the agent's own system/init says so (claude leg verbatim; opencode forwards nothing → names with no tick, honestly); (c) the agent's own servers get "plus the agent's own" wording and NO rows. On (c) the author made a documented judgment: even though the claude init names the agent's own servers, they stay row-less (olai has no probe under them; once-per-turn news from an agent free to reconnect between turns cannot be kept honest — argued in the PR body and servers.ts). Engage with that reasoning on its merits; it was decided, not missed.
3. Verify, don't trust: run the local suites yourself (typecheck, unit, the touched e2e features); check the author's claims against the diff; check #140's failure sentences still render verbatim; check the evidence images against what the code draws.
4. Post your review as a PR COMMENT on #357: a verdict — OBJECT or DO-NOT-OBJECT — with findings ranked MUST / SHOULD / NIT, each anchored to file:line. Be concrete: a MUST needs a failure scenario, not a taste.
5. Then report in this terminal: the verdict, the comment URL, one line per MUST.

Do not merge, do not push, do not edit the PR.