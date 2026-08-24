# Review brief: PR #358 — a sound + system notification when the chat awaits the human (chat-attention-alerts)

You are the REVIEWER. The PR: https://github.com/juspay/olai/pull/358, head c2903beb, branch chat-attention-alerts. You are in the author's worktree (`.worktrees/chat-attention-alerts`) — read, build, run; do not push to it.

## What to do

1. Read `HACKING.md` at the repo root in FULL and review the PR per its guidelines.
2. The roadmap item's ruled scope (roadmap/features.olai → `chat-attention-alerts`): alert ONLY when the agent awaits the human (question form / permission / plan — turn-complete deliberately silent); chime + service-worker system notification, PWA-shaped; App Badging API with title/favicon fallback; suppressed while the pane is focused; badge clears on focus, not on dismiss; notification click focuses the conversation at the prompt; one-time permission ask, denial leaves chime + badge working; default ON with Prefs toggles (alerts, sound); the awaiting fact read from the chat cell's own state, NO new wire signal. Honest limit ruled in: no push server — a fully-closed PWA hears nothing, and nothing should pretend otherwise.
3. Verify, don't trust: run typecheck, unit, and the touched e2e features yourself; check each ruled point against the diff; check the evidence video's claims against what the code does (it shows a real OS banner via dunst; its two stated limits — inaudible chime, worker-channel press — are argued on the video's captions and in the PR body: judge whether those limits are honest or load-bearing).
4. Sharp edges worth your attention (from the orchestrator, not verdicts): focus/visibility semantics across multiple panes and tabs (does a focused OTHER vault tab suppress?); the SW registration seam `@kolu/surface-app/notify` (new public surface?); permission-denied and permission-default paths; the badge count when several conversations await; no status reads anywhere in the circuit (the turn-complete-silent ruling).
5. Post your review as a PR COMMENT on #358: verdict OBJECT or DO-NOT-OBJECT, findings ranked MUST / SHOULD / NIT, each anchored to file:line, MUSTs with a concrete failure scenario.
6. Then report in this terminal: the verdict, the comment URL, one line per MUST.

Do not merge, do not push, do not edit the PR.