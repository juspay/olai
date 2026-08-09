# packages/store: architecture

Status: brainstorming the component's internals. Location is decided: an olai workspace package, `packages/store` — generic over content (caller-supplied codec, no olai types), so it can become its own repo later without redesign.

Ancestry: Ema's `Dynamic` + unionmount (initial value + self-running updater; production-proven in emanote), TypeScript's `ts.sys` watch host (watcher triggers, re-stat is truth, keep-rest-valid), Watchman (settle before trust, recrawl over large uncertain deltas). In Effect terms, `Dynamic m a` becomes an initial snapshot + `SubscriptionRef`.

## Shape

```ts
Store.make({ root, codec }): Effect<Store<S, E>, StoreBootError, Scope>

interface Store<S, E> {
  snapshot: SubscriptionRef<{ rev: Rev; value: S }>  // last-good, always valid, revision-tagged
  errors:   SubscriptionRef<E | null>                 // what's wrong right now, or null
  refresh:  Effect<void>                              // run the probe now
  commit:   (tx: { baseRev: Rev; changes: FileChanges }) => Effect<Rev, StaleWrite | E>
}
```

The codec is two-phase, mirroring "parse per line, validate the set":

```ts
codec: {
  match:    (path) => boolean                       // which files belong to the set
  decode:   (path, bytes) => Either<E, F>           // per-file; cacheable by stamp
  validate: (files: Map<path, F>) => Either<E, S>   // whole-set; cross-file invariants live here
}
```

The store never interprets file contents; olai's format core supplies `decode`/`validate`, keeping the one-validator rule intact.

## The sync loop

One update fiber; readers never block it.

1. **Trigger**: a watcher event, a `refresh()` call, or a periodic backstop schedule. Triggers are coalesced; a settle delay absorbs bursts (a `git pull` is many events, one probe). Watcher decided 2026-08-09: `@effect/platform` `FileSystem.watch` (recursive) — verified working under Bun on Linux (tested) with macOS covered by the darwin CI lane; its optional `WatchBackend` service is the escape hatch to @parcel/watcher if ever needed, without touching store code.
2. **Probe** — the only source of truth: re-list the tree, re-stat everything; diff against the stamp table (path → mtime, size). Watcher payloads are never believed — the pinned implementation itself drops null-filename events (`if (!path) return`), inotify overflows under bursts, FSEvents coalesces under git-sized loads — so an event only means "probe soon". The probe is idempotent: after any disturbance, state converges to disk truth even if every event lied or none arrived.
3. **Re-read** only stamped-changed files through `decode`; unchanged files keep their cached `F`.
4. **Validate** the whole set. Valid → publish new snapshot, clear errors. Invalid → keep last-good snapshot, publish typed errors (`file:line`), keep stamps so the next change re-probes cheaply.

Writes go through the store's one gate, with optimistic concurrency. Every snapshot carries a revision; `commit({baseRev, changes})` is writer-serialized and fails with a typed `StaleWrite{currentRev}` when the store has moved past `baseRev`. The caller (the ops layer) then re-derives its edit from the fresh snapshot and retries — and because ops are semantic (mark node X, move node Y), not whole-file writes, retries land cleanly unless the edits genuinely collide, in which case the op's own validation error speaks. So two parallel writers (a web edit, an ACP edit) can never silently lose one update: one commits, the other retries on the new base. Inside the gate: probe first (catches out-of-band disk changes since `baseRev`), apply changes to same-directory temp files, `validate` the whole set, atomic rename, publish snapshot + new rev. The git commit rides a consumer-supplied post-publish hook — the store stays git-agnostic. External writes (`git pull`) still enter via the probe and advance the rev like any commit, so an edit racing a pull retries against the pulled state.

## Errors

`Data.TaggedError` classes, `file:line` mandatory, structured detail (not prose). The error `SubscriptionRef` is independent of the snapshot: consumers render last-good data and the error banner from two subscriptions, matching the surface mapping (snapshot `stream`, error `cell`).

## Open

- **Per-entity errors** (emanote-style: a broken file renders its own failure in place, rest stays live) vs whole-set last-good (plan's current wording). Whole-set is forced whenever cross-file validation fails; per-file decode errors could plausibly degrade per-entity instead. Worth deciding before phase 3.
- **Deletion semantics**: a deleted file that others mirror into — is that an invalid set (hold last-good) or a valid smaller set? Falls out of `validate`, but the UX should be chosen deliberately.
- **Backstop cadence** and whether the periodic probe is even needed once `refresh()` covers our own writes and the watcher covers everything else — Watchman's experience says yes, keep it.
- **Stamp granularity**: mtime+size is cheap but coarse (same-second rewrites); content hash is exact but reads every file. TS uses versions, Watchman uses clocks. Probably mtime+size now, hash if it ever bites.
