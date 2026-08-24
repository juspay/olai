# Brief: chat-attention-alerts — a sound + system notification when the chat awaits the human

You are the AUTHOR of one PR in the olai repo. You are in a fresh worktree (`.worktrees/chat-attention-alerts`, branch `chat-attention-alerts`) of `/home/srid/code/olai`. Work only here.

## The roadmap item (verbatim, roadmap/features.olai → Chat panel → `chat-attention-alerts`)

**The UX, as agreed with the human (2026-08-23):**
- When the agent is blocked on the human — a question form, a permission prompt, a plan approval (the states form-elicitation #110 made renderable) — and the pane is NOT focused: one short chime plus a system notification naming the conversation and the first line of what it wants. Clicking it focuses the right tab/pane, scrolled to the prompt.
- When the pane IS focused: nothing — the form appearing is the alert; no nagging about what is already on screen.
- A badge sticks until the human focuses the pane (not until the notification is dismissed): the App Badging API on the installed PWA icon (`navigator.setAppBadge` with the count of conversations awaiting), falling back to a title/favicon dot in a plain tab.
- Turn-complete is deliberately silent (ruled): only awaiting-the-human alerts.

**PWA-shaped (ruled — olai runs installed as a PWA):**
- The notification goes through the service worker (`registration.showNotification`), so it fires with the app window backgrounded; notification click routes focus through the SW's clients.
- One-time browser permission ask on first enable; if denied, chime + badge still work (neither needs permission).
- **Honest limit:** no push server in v1 — the trigger is the live websocket, so alerts fire while the app runs (foreground or background). A fully-closed PWA hears nothing; Web Push is out of scope (its own roadmap node if ever wanted).

**Default ON** (ruled), with Prefs toggles: alerts on/off, sound on/off — beside the chat's existing prefs.

**Scope note:** the "awaiting" fact must come from the chat cell's own state (the pending form/permission the panel already renders), not from a new wire signal — the panel knows it is drawing a form nobody has answered.

## Coordination note

PR #357 (mcp-roster-visible) is in flight on the chat panel header in another worktree. Do not fear it, but expect it: if master moves under you and your PR conflicts, merge latest master into your branch (a merge commit, never a rebase) — only on conflicts, per CLAUDE.md.

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

Produce a short video (preferred; screen + the notification visible) or screenshots showing: (1) a question form arriving with the pane unfocused → the system notification appears and the badge lands; (2) clicking the notification focuses the conversation at the prompt and the badge clears; (3) the same event with the pane focused → no notification. If the chime cannot be captured on video, say so and show the Prefs toggle instead. Embed via the uploads endpoint (`curl -s "https://uploads.github.com/user-attachments/assets?name=<f>&content_type=<mime>&repository_id=<id>" -X POST -H "Authorization: Bearer $(gh auth token)" -H "Accept: application/json" --data-binary @<f>`; embed the returned `.url` — for video, on its own bare line; transcode webm→mp4 with ffmpeg via Nix for broad playback). Never commit proof assets to the repo.

## When done

Report in this terminal, concisely: the PR URL and head SHA, what shipped against each ruled point, the local-suite results (exact counts), the evidence link, and `No deferrals.` (or your stop-and-ask). A reviewer (Grok) will be pointed at the PR afterwards; stand by to address its findings when the orchestrator sends them.