# Address brief: PR #357 — both reviews are in

Both reviewers returned DO-NOT-OBJECT at c4a4f1db, zero MUSTs. Address every finding below — FOLD it, or ARGUE it back as a reply on the review comment; nothing silently dropped. Then CI, once.

## The reviews

- opencode: https://github.com/juspay/olai/pull/357#issuecomment-5388858594
- grok: https://github.com/juspay/olai/pull/357#issuecomment-5388875636

## The findings, deduped

1. **(grok SHOULD 1 — the real one)** `refusedOpen` writes `unopened` but does not clear `servers` — the roster strip answers "which servers does this conversation have?" about a conversation that does not exist. Fix as grok names it: `refusedOpen` also `move({ servers: [] })`, the same way `sessionOver` already does — and cover the unopened face with a test (the no-agent scenario's sibling invariant).
2. **(opencode SHOULD 1 = grok NIT 1)** `packages/surface/README.md:150` — the `arrayKey` table row still says `MissingServer`; the type is `ChatServer` now. One-word fix.
3. **(opencode NIT 2)** PR body test counts off by one in three places (16 not 17; 7 not 6; 7 not 6 — the enumeration omits "No conversation, no roster"). Fix the prose.
4. **(opencode NIT 3)** `readLiveServers` applies a forwarded `init` without checking which session it names. The reviewer says "fine to defer" — but the No-deferrals rule stands: either add the `sessionId` guard (if the adapter's params carry one reliably — check), or reply on the comment arguing why no-change is the right change (readLiveModel consistency, the fence you rely on). Deciding it beats deferring it.
5. Flakes grok observed in serve.test.ts / pending.test.ts are files you do not own — already filed in the orchestrator's Inbox; nothing for you to do beyond not chasing them.

## Then: CI, once

- Read https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md in FULL and run CI per it, Linux only (this PR does not impact macOS).
- Venue (the standing ruling): localhost x86_64-linux, under the flock `/tmp/olai-odu-localhost.lock`, with the mandatory host pin `--host x86_64-linux=localhost`. One run, at your final head.
- Do NOT merge master unless the PR has conflicts (it should not; master has not moved under you).

## Evidence

The refusedOpen fix changes a face: add one screenshot of the unopened state showing NO roster strip. Existing evidence stands otherwise.

## When done

Report here: final head SHA, what you did per finding (folded/argued, with the reply link if argued), CI result (the runs and their outcome, honestly), the new screenshot link. The PR then goes to the human for approval.