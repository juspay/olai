# Address brief: PR #358 — grok's review is in

Grok returned DO-NOT-OBJECT at c2903beb (it reviewed pre-merge; your master merge landed mid-review — reconcile every finding against the merged head ab1e66e0 as you fold). Zero MUSTs. Address every finding — FOLD it, or ARGUE it back as a reply on the comment; nothing silently dropped, nothing deferred.

The review: https://github.com/juspay/olai/pull/358#issuecomment-5389416749

## The findings

1. **SHOULD 1 — a second same-vault tab chimes while the focused tab shows the form** (watching.ts:66). The nag-while-looking failure the ruling exists to prevent; the OS tag replaces the banner but not the chime. Fold grok's fix: a one-bit "this origin is watched" (BroadcastChannel or a leader bit), so a sibling tab that is visible+focused+open suppresses the rest. Cover it (two-document unit or browser-condition test).
2. **SHOULD 2 — a press during hydration is spent as jump-to-bottom** (Transcript.tsx:178). The reveal effect wakes on keys, not values; `entry(key)` undefined ≠ answered. Fold: stay asked until every key has a value (or the form is found); only then treat absence as answered. Cover the race if a test can hold it (a delayed-value fixture).
3. **SHOULD 3 — permission-denied independence is ruled and untested**. Add the test: `Notification.permission === "denied"`, the chime still arms and the tab still takes the mark. Unit of the circuit or an @alerts scenario with denial — whichever HACKING.md's bar wants.
4. **SHOULD 4 — the e2e press exercises kolu's no-id fallback, not the production click path**. Decide, don't defer: either make the step send the production envelope (id + source + the sessionStorage claim it needs), or pin the ack path in a unit test at the seam, or argue on the comment why kolu's own notify.test.ts owns that claim — pick one and say which.
5. **NIT 1** — README.md:423 names `banner.ts`; the modules are `notice.ts` + `notify.ts`. Fix.
6. **NIT 2** — badge counts pending questions, not conversations. Fine under the no-new-wire rule — make the docs say the number's meaning so a dock `3` is not read as three chats.

## Then: CI, once

- Read https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md in FULL and run CI per it at your FINAL head, once.
- Venue: localhost x86_64-linux under the flock /tmp/olai-odu-localhost.lock with the mandatory pin --host x86_64-linux=localhost (the box is quiet now). Either platform green is the bar for olai PRs; Linux only — this PR does not impact macOS.

## When done

Report here: final head SHA, per finding folded/argued (reply link if argued), CI result honestly, any evidence retaken if a face changed. The human has ALREADY approved this PR conditioned on evidence verification (done, passed) — after your report the orchestrator merges without a further ask, so your report is the last gate. Make it true.