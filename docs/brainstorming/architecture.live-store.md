# packages/store: architecture

Status: built and live as of phase 3; the open questions below were resolved on 2026-08-09 and are recorded as decisions. Location is decided: an olai workspace package, `packages/store` — generic over content (caller-supplied codec, no olai types), so it can become its own repo later without redesign.

Ancestry: Ema's `Dynamic` + unionmount (initial value + self-running updater; production-proven in emanote), TypeScript's `ts.sys` watch host (watcher triggers, re-stat is truth, keep-rest-valid), Watchman (settle before trust, recrawl over large uncertain deltas). In Effect terms, `Dynamic m a` becomes an initial snapshot + `SubscriptionRef`.

## Shape

```ts
Store.make({ root, codec, settle?, backstop?, watch? })
  : Effect<Store<S, E>, PlatformFailure, FileSystem | Path | Scope>

interface Store<S, E> {
  snapshot: SubscriptionRef<{ rev: Rev; value: S } | null>  // last-good, revision-tagged
  errors:   SubscriptionRef<E | null>                       // what's wrong right now, or null
  refresh:  Effect<void, PlatformFailure>                   // probe now, publish, then return
}
```

The codec is two-phase, mirroring "parse per line, validate the set":

```ts
codec: {
  match:    (path) => boolean                          // which files belong to the set
  decode:   (path, contents) => Result<F, E>           // per-file; cached by stamp
  validate: (files: Map<path, Result<F, E>>) => Result<S, E>  // whole-set invariants
}
```

The store never interprets file contents; olai's format core supplies `decode`/`validate`, keeping the one-validator rule intact. Note that `validate` sees each file's `Result` rather than a map of the ones that parsed: which of the two error scopes below applies is a question only the codec can answer, and a store that filtered the failures out first would have answered it for every codec by omission.

## The sync loop

One update fiber; readers never block it. It is serialized by a semaphore, so a `refresh` from a consumer and a watcher-triggered probe cannot interleave over the stamp table they both mutate.

1. **Trigger**: a watcher event, a `refresh()` call, or the periodic backstop. Triggers are coalesced; a settle delay absorbs bursts (a `git pull` is many events, one probe). Watcher: `@effect/platform` `FileSystem.watch` (recursive) — verified working under Bun on Linux with macOS covered by the darwin CI lane; its optional `WatchBackend` service is the escape hatch to @parcel/watcher if ever needed, without touching store code. The watcher is armed BEFORE the boot probe, so the only changes it can miss are ones the boot probe is about to read anyway. *(Amended 2026-08-15, `watcher-postboot-blind`: it is that recursive watch PLUS one per directory created after it was armed, which the walk arms as it finds them. The pinned runtime's recursive watch registers the tree it is given and never follows a new directory, so without them a folder made in a live vault stayed dark until the backstop. Same API, same options, no new service — the `WatchBackend` escape hatch is untouched.)*
2. **Probe** — the only source of truth: re-list the tree (pruning dot-directories and `node_modules`: a served directory is a working tree, and an unpruned walk would be at its most expensive precisely when git is the thing generating the events), re-stat everything; diff against the stamp table (path → mtime, size). Watcher payloads are never believed — the pinned implementation itself drops null-filename events (`if (!path) return`), inotify overflows under bursts, FSEvents coalesces under git-sized loads — so an event only means "probe soon". The probe is idempotent: after any disturbance, state converges to disk truth even if every event lied or none arrived. A listing identical to the last one ends the cycle right here: no re-decode, no revision, nothing published.
3. **Re-read** only stamped-changed files through `decode`; unchanged files keep their cached `F`. A decode failure is cached like a success — the same bytes fail the same way.
4. **Validate** the whole set. Valid → publish new snapshot, clear errors. Invalid → keep last-good snapshot, publish typed errors (`file:line`), keep stamps so the next change re-probes cheaply.

## Errors

`Data.TaggedError` classes, `file:line` mandatory, structured detail (not prose). The error `SubscriptionRef` is independent of the snapshot: consumers render last-good data and the error banner from two subscriptions, matching the surface mapping (snapshot `stream`, error `cell`).

## Decisions (2026-08-09)

These settle what was the "Open" section. They are load-bearing enough that the code points back here.

1. **Error scope is hybrid, per-file degrade.** A file that fails to decode renders its error *in place of that one outline*; the other outlines stay fully live (emanote-style). Cross-file validation failures (dangling refs, cycles) have no single home, so they hold the whole-set last-good snapshot and show the error banner. This is what shapes the codec contract above: decode failures flow into `validate`, so the published `S` can embed per-outline failures. In olai's format that lands as `OutlineSet.broken`, and the rule is: if the files that DID parse are clean, publish with the failures embedded; if anything else is wrong — or a rule had to withhold a finding because the missing nodes made it a guess — reject, and report the parse errors as the cause. Only `unknown-target` can be *invented* by a missing file; `parent` is same-file by rule, and a duplicate or a cycle can only be hidden by one, never conjured.
2. **Deletion is not special.** A deletion is just a probe diff. No inbound refs → the outline disappears from the sidebar. Inbound mirrors/edges now dangle → normal dangling-ref validation errors, handled by the policy above. No grace window, no tombstones — the settle delay already absorbs save-churn.
3. **Backstop probe stays**, slow cadence (~60s), alongside the watcher and `refresh()`. Watchman's experience is that a watcher is a latency optimisation and never a guarantee: a dropped inotify queue, a network mount or a container boundary all fail silently, and an unconditional listing when nothing has changed costs one syscall sweep and publishes nothing.
4. **Stamps are mtime+size**, not a content hash. Coarse — a same-second rewrite of the same length slips through — and cheap; hashing reads every file on every probe to catch a case the settle delay and the backstop already cover. Hash only if it ever bites.

## Writes: the gate that is not built yet

Not built. Nothing writes yet, so nothing needs it, and building the gate before the first writer would be designing against an imagined caller. The shape it lands in is settled:

Writes go through the store's one gate, with optimistic concurrency. Every snapshot carries a revision; `commit({baseRev, changes})` is writer-serialized and fails with a typed `StaleWrite{currentRev}` when the store has moved past `baseRev`. The caller (the ops layer) then re-derives its edit from the fresh snapshot and retries — and because ops are semantic (mark node X, move node Y), not whole-file writes, retries land cleanly unless the edits genuinely collide, in which case the op's own validation error speaks. So two parallel writers (a web edit, an ACP edit) can never silently lose one update: one commits, the other retries on the new base. Inside the gate: probe first (catches out-of-band disk changes since `baseRev`), apply changes to same-directory temp files, `validate` the whole set, atomic rename, publish snapshot + new rev. The git commit rides a consumer-supplied post-publish hook — the store stays git-agnostic. External writes (`git pull`) still enter via the probe and advance the rev like any commit, so an edit racing a pull retries against the pulled state.
