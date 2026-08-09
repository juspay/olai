# @olai/store — a directory of files as a validated snapshot

Files on disk, read and published as one revision-tagged snapshot, with what is
wrong on a second, independent channel. It knows about paths, bytes, revisions
and last-good state; the caller's codec knows about content.

There is not one olai type in here, and that is deliberate. The store is
generic over what a file contains — `Codec<F, S, E>` is supplied by the caller
— which is what keeps olai's one-validator rule intact and what would let this
package move to its own repo without a redesign. If `@olai/format` ever appears
in its `dependencies`, the seam has leaked.

## The codec is the whole of the coupling

`Codec` mirrors the format's own two phases: `decode` sees one file and may be
cached against its stamp, `validate` sees all of them and is where every
cross-file invariant lives. Both return a `Result`, so a failure is a value the
store publishes rather than a throw it would have to guess how to describe.
`combine` lives on the codec too — the store cannot know whether `E` is an
array, a tree or a tagged class, and it must not be possible to hand it a codec
and a mismatched joiner.

A decode failure means the set is not knowable, so validation does not run; but
every file that failed is still reported together, because one pass should be
enough to fix a directory.

## Built for a phase it is not in yet

This phase is load-once: `make` reads the tree, decodes, validates, publishes,
and then nothing changes. The API is nonetheless already the shape the live
store needs
([docs/brainstorming/architecture.live-store.md](../../docs/brainstorming/architecture.live-store.md)),
so phase 3 adds the watcher and probe behind `refresh` and phase 4 adds
`commit` without a consumer changing a line:

- the snapshot is a `SubscriptionRef`, so `changes` is already
  current-value-then-updates — surface's snapshot-then-deltas contract, for
  free;
- errors are a *separate* `SubscriptionRef`, because last-good data and
  what-is-wrong-now are two independent facts, and an invalid file must not
  blank the page;
- revisions are minted from the beginning rather than retrofitted onto data
  consumers have already learned to read.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, which re-exports
four names: `make`, `Store`, `Codec` and `Rev`.

## Layering

Depends on no workspace sibling, on purpose (see above). Only `server` depends
on it — it supplies the codec that joins this to `@olai/format`.
[docs/architecture.md](../../docs/architecture.md) has the reasoning.

## Running

There is no unit suite here yet; the store is exercised end to end by
`just e2e`, which serves real directories of fixture outlines. What this
package answers on its own is the types:

```sh
just typecheck                                   # every workspace member
bun run --filter @olai/store typecheck           # in the dev shell, this one
```
