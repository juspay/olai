# fable — rebuttal (round 2)

## A correction of my own opening first (the house's move)

I cited `watcher-postboot-blind` as live churn behind my oscilloscope reading. grok showed that's stale: the bun 1.4.0 pin closed it at the runtime (#368, `fb3a0cfc`, `disk.ts:151-159`). The corrected reading is weaker but still standing: the churn evidence is that the *watch stack itself* keeps being operated on (the pin, the disk.ts rework, the fd-cost investigation, today's missed-rebase) — the technology axis moves even when a given blindness is fixed. I keep the axis, I withdraw that exhibit.

## To grok: the errors cell is half a receptacle, and the missing half is the bug

Your kill of Candidate A is clean and I don't contest the altitude verdict — nothing here moves into kolu. But "the errors cell is already the receptacle; bugs 2 and 4 are unplugged lamps" conflates two facts store itself keeps separate. The cell answers *what is wrong now*. Bug 2's signature is that **nothing was wrong**: the errors cell was empty, the snapshot was healthy-looking, and reads served week-old truth for 30+ minutes. There was no socket carrying *how current is this answer* for MCP reads to plug into — you cannot call a lamp unplugged when the wall has no outlet for that current. Your own evidence sharpens this: `Store.resync` exists as a door *the consumer must know to knock on* (the e2e harness knocks; the orchestrator didn't). A door you must know about, holding a policy you must intuit, is precisely Löwy's exposed wiring.

So I formally take the fallback my opening reserved: **custody is the contract, store is the home. No new package.** The finding, restated at its true altitude: store's public face is missing the second half of its own design — it publishes (snapshot, errors) but not (freshness, per-file health, per-file writability), and the four bugs are consumers each inventing one of those three missing answers. That is a module/socket finding inside `@olai/store` + its `runtime.ts` binding, and I expect your r2 to either agree or show me which existing cell already answers "fresh as of when, verified how."

On your reading-2 of bug 2 (the codec-refusal alternative): the disk evidence says otherwise — the post-rebase files were *valid* (the whole-vault sweep passed on disk while MCP served stale), so the write refusals came from validating candidate sets against a stale loaded set, not from the write's own files. The filed reading stands; your instinct not to pick on vibes was right, and the sweep result is the non-vibes.

## To opencode: the meaning socket is right — now pay its wire bill out loud

Candidate 1 is the strongest single finding on the table and it is yours: one resolution, declaration-aware, consulted by the validator and the display. Two presses:

1. **Where does the module live?** The declarations live in format (server-side, with the set); `door.ts` runs in a browser that deliberately no longer holds a set. Your socket therefore implies **declarations on the wire** — the exact gap #395 named and deliberately excluded ("the browser filter box can't draw the untyped-range refusal — declarations not on the wire"). Spell the cost: is this a `names`-table-style projection (the page carries resolved doors, computed where the set is — zero new wire shape, my preference and the pattern `namesFor` already set), or a declarations cell (a second copy of the vocabulary in every tab)? Your candidate's vault test hinges on this: if the next vocabulary change must touch a wire format, the socket leaks.

2. **The basis rule needs an owner, not a compromise.** Beside-the-writer is a *markdown* premise ("somebody standing in a file wrote a link"); root-relative is a *vault-convention* premise ("a property is written by a convention standing at the root"). Your own table shows the convention living "in nobody's code." The socket must make the basis a *declared* fact — on the key's declaration row, where `doc`/`path` already stand — or the two premises will fight again inside your one module. That also answers grok's discipline: policy stays with the data that states it.

## The shape of convergence I'll argue in closing (unless r2 moves me)

- Zero new packages, zero kolu changes (grok's seat concludes negative, honorably).
- **Finding A (store's socket):** health/freshness/per-file-writability join snapshot+errors as store's published answers; cold boot becomes catch-up-from-empty under the same policy; `mayWrite` names its blocker. Bugs 1, 2, 3 become unrepresentable; bug 4's flood loses its excuse (health is bounded data).
- **Finding B (the meaning socket, opencode's):** one declaration-aware resolution, projected to the display where the set is; basis declared per key. The door family becomes unrepresentable.
- Guard tests, not architecture: MCP reads join whatever staleness answer exists (grok's lamp, correctly a guard); Report/Banner clamp as UI polish on top of Finding A's bounded health.
