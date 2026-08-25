# fable — opening (round 1) · new-packages altitude

One candidate. The house has killed every package proposal for three sittings, and the lesson of those kills is that a package earns its wall socket only when the volatility is real, measured, and *crossing boundaries because it has no home*. Today produced the measurement.

## The candidate: CUSTODY — the answer to "what set are we serving, and how healthy is it?"

**The claim.** Bugs 1–4 are one bug class wearing four coats: *the question "what is the served set, and what do we know about its honesty against disk" has no owner, so every call site derives its own answer.* Four derivations, four policies:

- **Cold load** answers: "the set is what validates, else NOTHING" (`store.ts` ~292: cold start is special-cased *in a comment* — "there is no last-good to fall back to"). → bug 1: two dangling `see` edges, tolerated for days by the running policy, brick the vault under the cold policy. Chat dies because chat's own transport plugs into the same nothing.
- **The running watch** answers: "the set is last-good per file, caught up on events, backstopped at 60s" (`store.ts:12,317,568`). → bug 2: a git rebase's rename-over replacement produced no event the watcher saw, and the *unconditional* 60s probe (:568 — its own words) still missed it. Reads served the stale set errorlessly for 30+ minutes. The mechanism's one promise — the backstop catches what the watcher misses — broke, and nothing noticed, because freshness is a private implementation detail rather than an answer anyone can check.
- **The write gate** answers: "the set is valid iff EVERYTHING validates" (ops' whole-set validation). → bug 3: one broken file froze writes to every healthy file, and the refusal couldn't even name the blocker — because the gate doesn't *have* per-file health; it has a boolean.
- **The banner** answers: "the set is last-good, and here is the validator's raw log" → bug 4: health isn't data anywhere, so the UI improvises with the only thing it has — the full row enumeration — and floods every page.

Four sites, four spellings, and the four bugs are precisely the pairwise disagreements between them. That is Löwy's oscilloscope trace, drawn by one afternoon.

**The receptacle.** A package — working name `@olai/custody` — owning the one contract:

```
Custody(directory) ⟶ subscribe: (set, health)
  health: per-file { fresh | last-good(since) | broken(rows) } + corpus freshness
  mayWrite(files) ⟶ ok | blocked(file, rows)   // per-file, names the blocker
```

Behind the socket, all the volatility that actually churned: watcher technology (bun 1.3.13's post-boot blindness, the 1.3.14 rewrite pending — `watcher-postboot-blind`), backstop strategy (poll vs mtime-verify-on-read — the fix bug 2 demands), git's rename-over replacement semantics, cold-vs-running unification (cold boot becomes *catch-up from the empty set* — one policy, so bug 1's class dies structurally), and health representation. Consumers — server pages, the MCP surface, the write gate, the banner — plug into (set, health) and cannot tell which watcher, which backstop, or which git trick produced them.

**Why each bug class becomes impossible, not just caught:**
1. Cold-boot outage: there is no cold path to diverge — booting is catching up from empty, per file, under the same last-good policy. A broken file at boot serves last-good-or-broken *for that file*, like at runtime.
2. Stale-set-without-errors: freshness is part of the answer, not a hope. A consumer holding (set, health) where health says fresh-as-of-T can demand verify-on-read; the contract makes "stale but healthy-looking" unrepresentable.
3. Healthy-write freeze: `mayWrite` is per-file by signature. The whole-set boolean that caused the freeze cannot be expressed through the socket.
4. Banner flood: health is bounded data (a state + counts per file); the UI draws data. The raw row-log isn't on the wire to flood with.

**The four tests, explicitly:**
- *Opaque socket:* consumers see (set, health, mayWrite). Swapping bun's watcher for the 1.3.14 rewrite, adding mtime-verify, changing backstop cadence, handling a new git operation — all invisible behind it. Today's consumers can name the watcher tech only because there is no socket.
- *Functional but not domain-functional:* "keep a loaded corpus honest against a changing directory, degrade per file, answer for your own freshness" mentions no outline, no mark, no property. Any served-directory app needs exactly this. It is not "the outlines domain," and it is not utilities.
- *Oscilloscope:* 17 commits into `packages/store` since 08-13 (the "stillness" the second sitting celebrated was already corrected by the third; the trace keeps rising); the bun-watcher investigation and pending bump; the last-good machinery itself churning; and today: four filed bugs plus one total outage in one afternoon, each a disagreement between the four private spellings.
- *Vault test:* the next changes of this kind — a new invalidation source (git worktree ops, an rsync deploy), a new health state (typed violations vs parse failures, which today are conflated), a new verification strategy — land inside the package. No consumer edits. Today every one of them would touch store, ops, and web.

**The honest boundary question, pre-empted.** Is this a new package or `@olai/store` finally growing its missing socket? Store today braids three things: disk/codec, the watch-freshness machinery, and last-good policy. My position: the *contract* is the finding; whether it ships as a new package or as store's re-founded public face is an implementation vote I will yield in round 3 to whoever shows the smaller honest diff — but the socket itself is package-shaped, because its consumers span three packages today (store, ops, web) and its volatility (watcher tech, git semantics) is none of their business. If the house lands on "store *is* the receptacle, give it the socket," I count that as this candidate winning, not losing: the electricity analogy never demanded a new wall, only that the wiring stop being every appliance's problem.

**What I am deliberately not claiming.** The door.ts family is a module-boundary finding (pi's seat — one resolver, declaration-aware; I'll argue against any package there). Watcher robustness upstream is grok's to press. And no second candidate: the house record says one earned socket beats three plausible ones.
