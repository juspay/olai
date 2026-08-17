# kolu: the ring — settled terminals nag by default

Status: brainstorming, 2026-08-16, rev 3. Rev 2's five-command watchdog (watch open/next, expect, park, kill, four flags, ack cursors) was ruled too much. We own both kolu and olai — no backwards-compat constraints — so the design shrinks to the minimum that makes the guarantee true. Roadmap: `kolu-watch-next-cli`.

## The whole design

Kolu already computes the answer: the `urgency` cell's `lingerIds` — terminals that settled and stayed idle. Nothing consumes it. Promote that to first-class state and everything else falls away:

1. **The ring — default padi behavior, no opt-in.** An agent terminal that has been settled (turn ended AND output quiet — the debounce is part of the *definition* of settled, not a flag) for 60 seconds is **ringing**. Level-triggered: not an event to deliver, a condition padi keeps asserting. It clears only when the terminal starts working, dies, or is snoozed. Missed wakeups become structurally impossible — there is no delivery to miss; the state persists until reality changes.

2. **One verb: `kolu snooze <id> --for 2h --reason "darwin CI lease"`.** The only way to legitimize idleness. Reason and expiry are mandatory; expiry re-rings; the reason is visible on the canvas, so every quiet terminal carries a human-auditable why. (Dispatching work needs no verb — sending input makes the terminal working, which clears the ring by itself. Rev 2's `expect --working-within` solved a problem level-triggering doesn't have: a fumbled dispatch just leaves the terminal settled, so it rings again in 60s. `kill` already exists.)

3. **One face: `kolu ring --wait`** — block until at least one terminal is ringing, print them (id · agent · idle-for · last screen lines), exit 0. Backgrounded, its exit is the orchestrator's wake. Without `--wait` it prints the current list; empty output means everything is tended. The MCP face is the same state through the existing urgency resource; the web canvas paints ringing terminals loud.

## The loop this buys

One background `kolu ring --wait`; on its exit, every ringing terminal gets exactly one of **work, snooze --reason, kill**; re-arm. No subscriptions, no cursors, no acks, no per-terminal watchers, no client-side debounce, no state files.

## What rev 2 had, and why deleting it is safe

- **watch open / scopes / re-open bookkeeping** → the ring covers every terminal padi hosts; there is one operator, us.
- **durable queue + ack cursors** → level-triggered state needs no delivery guarantee; the "unacked events re-fire" machinery was rebuilding, in the client protocol, what a persistent condition gives for free.
- **expect / park as separate verbs** → expect is the ring re-asserting; park is snooze.
- **`--settled-ms`** → folded into what settled means.
- **screenTail-in-events** → state is current at read time by construction; there is no batch to go stale.

Both of today's lapses die under it: the missed settle (the ring persists until dealt with) and the mis-filed CI wait (idleness beyond a minute demands a written, expiring `snooze --reason` — a silent wrong assumption becomes a sentence the human can read and watch expire).
