# @olai/store — a directory of files as a validated snapshot

Files on disk, published as one revision-tagged snapshot and kept current for
as long as the scope is open, with what is wrong on a second, independent
channel. It knows about paths, bytes, stamps, revisions and last-good state;
the caller's codec knows about content.

There is not one olai type in here, and that is deliberate. The store is
generic over what a file contains — `Codec<F, S, E>` is supplied by the caller
— which is what keeps olai's one-validator rule intact and what would let this
package move to its own repo without a redesign. If `@olai/format` ever appears
in its `dependencies`, the seam has leaked.

## The sync loop

Trigger, coalesce, probe, publish — and the rule that holds it together is that
the **probe decides and nothing else does**.

1. **Trigger**: a watcher event, a `refresh`, or the periodic backstop. None of
   them says what changed; all three say "look". Watcher payloads are dropped
   unread at the disk edge, because they cannot be trusted: the pinned
   implementation itself discards null-filename events, inotify overflows under
   bursts, and FSEvents coalesces under git-sized loads.
2. **Coalesce**: a settle delay after the first trigger of a burst. One editor
   save is a handful of events and one `git pull` is hundreds; both are one
   probe.
3. **Probe**: re-list the tree, re-stat everything, diff against a table of
   mtime+size stamps. The walk PRUNES dot-directories and `node_modules` — a
   served directory is somebody's working tree, and an unpruned walk would
   spend its time in `.git`, which is at once the largest thing under the root
   and the thing generating the events. Only stamped-changed files are re-read
   and re-decoded; an identical listing ends the cycle with nothing published
   at all, which is what makes a sixty-second backstop free. Because nothing is
   remembered except stamps, the probe is idempotent: state converges on disk
   truth after any disturbance, whether every event lied or none arrived.
4. **Publish**: valid → a new revision on the snapshot and the errors cleared;
   invalid → the last good snapshot is left exactly where it is and the errors
   published beside it. A broken file must not blank a page that was reading
   fine a second ago.

A published snapshot also says **what moved** to make it — `changed` (the paths
re-decoded) and `removed` (the paths the listing lost). That is the probe's own
stamp diff kept rather than thrown away: a consumer that publishes PER FILE
would otherwise re-derive it by comparing two whole snapshots, which is the
same walk done twice with less information. It is PATH talk, not content talk,
so it costs this package no knowledge of what a file holds.

The summary spans the gap between two PUBLISHED revisions rather than one
probe. A probe whose set the codec refuses publishes nothing, and the files it
re-decoded are still what changed when a later probe finally validates — so
they accumulate until a revision carries them out. The first revision names
every file, because everything is new to a consumer holding nothing.

Failures during a probe are logged and dropped rather than fatal: the next
trigger tries again, and a live page that is permanently stale is the one
failure mode a live store must not have.

## The codec is the whole of the coupling

`Codec` mirrors the format's own two phases: `decode` sees one file and is
cached against its stamp, `validate` sees all of them and is where every
cross-file invariant lives. Both return a `Result`, so a failure is a value the
store publishes rather than a throw it would have to guess how to describe.

`validate` is handed each file's `Result`, **decode failures included**, not a
map of the ones that parsed. That is the error-scope decision
([docs/brainstorming/architecture.live-store.md](../../docs/brainstorming/architecture.live-store.md),
resolved 2026-08-09): only the codec knows whether one unreadable file poisons
the set or is a hole the rest can be rendered around, so only the codec can
answer with a published `S` that has the failure embedded in it — one outline
showing its own error while its neighbours stay live — or with a failure that
holds the last good snapshot. A store that filtered the failures out first
would have made that call for every codec, by omission.

## Two channels, on purpose

- the snapshot is a `SubscriptionRef`, so `changes` is already
  current-value-then-updates — surface's snapshot-then-deltas contract, for
  free, which is why going live changed no consumer;
- errors are a *separate* `SubscriptionRef`, because last-good data and
  what-is-wrong-now are two independent facts;
- revisions are minted from the beginning rather than retrofitted onto data
  consumers have already learned to read.

## The write gate

`commit({baseRev, changes, afterPublish?})` is the one way in, and it takes the
same permit the probe does — so a write and a `git pull` can never interleave
over the stamp table they both read. Inside it the order is fixed:

1. **probe**, so a change that arrived out of band is part of the revision the
   write is judged against;
2. **the optimistic-concurrency check**: a `baseRev` the store has moved past
   fails with `StaleWrite{baseRev, currentRev}`, and the caller re-derives its
   edit from the newer snapshot. Because ops are SEMANTIC — mark node X, move
   node Y — a retry lands cleanly unless the two edits genuinely collide;
3. **validate** the set the write WOULD produce: the last decode with the
   changed files swapped in. A refusal costs nothing on disk, which is why this
   happens before any bytes move;
4. **stage then rename**: every file is written to a temp beside its
   destination, and only then are they all renamed. A reader sees the old bytes
   or the new ones, never a partial write, and a write that cannot be written
   at all fails with the destinations untouched;
5. **re-probe and publish**. The changed files are re-read because the gate says
   so, not because a stat noticed: stamps are mtime+size, and a write that
   lands in the same second at the same length is exactly what they cannot see.
   For a change from outside that is the accepted trade; for one this process
   just made it would mean a browser never getting the frame.

Two channels, and the split says who is at fault. `StaleWrite` is a FAILURE —
the caller re-derives and asks again. A set the codec REFUSES is an ANSWER, in
the success channel as `Result.fail`: the write was well-formed and the tree it
would make is not, so the caller renders the errors rather than retrying.

`afterPublish` is the caller's Effect, run after the snapshot moves and still
inside the gate. It is how the git commit rides along without this package ever
learning what git is. Typed as unfailing: the bytes are already on disk and
already visible, so there is nothing here that could undo them.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`. Inside, one file per
job: `codec.ts` is the contract with the caller, `disk.ts` is everything a
directory is allowed to be asked, `probe.ts` is the stamp table and the decode
cache, `store.ts` is the loop and the two refs.

## Layering

Depends on no workspace sibling, on purpose (see above). `@olai/ops` is what
joins it to `@olai/format` — it owns the codec and everything that writes
through this gate — and `server` composes the two.
[docs/architecture.md](../../docs/architecture.md) has the reasoning.

## Running

```sh
just test                                        # the whole workspace
bun test packages/store                          # this package, in the dev shell
just typecheck                                   # every workspace member
```

`src/store.test.ts` runs against real temp directories with a test codec of its
own — the store is generic, so proving it needs no outlines, and a codec
written there is the only way to exercise both error scopes. Most of it drives
the probe through `refresh` with the watcher off, because a watcher event and a
`refresh` reach the same code; the tests that turn the watcher on are the ones
about the watcher.
