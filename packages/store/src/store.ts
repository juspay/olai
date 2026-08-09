/**
 * @olai/store — a directory of files, loaded and validated into one snapshot.
 *
 * The store is generic on purpose: it takes a caller-supplied codec and never
 * looks inside a file. It knows about paths, bytes, revisions and last-good
 * state; the codec knows about content. That line is what keeps olai's
 * one-validator rule intact (the format core supplies both halves of the
 * codec) and what would let this package move to its own repo without a
 * redesign. There is not one olai type in here.
 *
 * This phase is load-once: {@link make} reads the tree, decodes, validates and
 * publishes, and then nothing changes. The API is nonetheless the shape the
 * live store needs (docs/brainstorming/architecture.live-store.md), so phase 3
 * adds the watcher and probe behind `refresh`, and phase 4 adds `commit`,
 * without a consumer changing a line:
 *
 *   - the snapshot is a revision-tagged `SubscriptionRef`, so a consumer that
 *     subscribes today keeps working when a second revision appears;
 *   - errors are a SEPARATE `SubscriptionRef`, because last-good data and
 *     what-is-wrong-now are two independent facts (an invalid file must not
 *     blank the page), and they map onto surface's stream and cell;
 *   - decode is per file and validate is per set, so the probe can re-decode
 *     only what changed.
 */

import { Data, Effect, FileSystem, Path, Result, SubscriptionRef } from "effect"

/** Monotonic per store. A snapshot's revision is what a later write will name
 *  as the base it edited (phase 4's optimistic concurrency), so it is minted
 *  here from the beginning rather than retrofitted onto data consumers have
 *  already learned to read. */
export type Rev = number

export interface Snapshot<S> {
  readonly rev: Rev
  readonly value: S
}

/**
 * The two-phase codec, mirroring "parse per line, validate the set".
 *
 * `decode` sees one file and may be cached against its stamp; `validate` sees
 * all of them and is where every cross-file invariant lives. Both return a
 * `Result`, so a failure is a value the store publishes rather than a
 * throw it would have to guess how to describe.
 */
export interface Codec<F, S, E> {
  /** Which files under the root belong to the set. Paths are relative to the
   *  root and use `/`, so a codec's rules read the same on every platform. */
  readonly match: (path: string) => boolean
  readonly decode: (path: string, contents: string) => Result.Result<F, E>
  readonly validate: (files: ReadonlyMap<string, F>) => Result.Result<S, E>
  /** How several files' failures become the one error value published. The
   *  store cannot know whether `E` is an array, a tree or a tagged class — and
   *  it must not be possible to hand it a codec and a mismatched joiner, so
   *  the joiner lives on the codec. */
  readonly combine: (errors: ReadonlyArray<E>) => E
}

export interface Store<S, E> {
  /** Last good load, or `null` when there has never been one. Phase 3 makes
   *  `null` the boot-only case; today it is exactly "the initial load was
   *  invalid". */
  readonly snapshot: SubscriptionRef.SubscriptionRef<Snapshot<S> | null>
  /** What is wrong right now, or `null`. Independent of the snapshot by
   *  design: a broken file leaves the last good tree on screen under a banner. */
  readonly errors: SubscriptionRef.SubscriptionRef<E | null>
}

/**
 * Read the tree once, decode every matching file, validate the set, publish.
 *
 * A decode failure means the set is not knowable, so validation does not run:
 * cross-file claims about files that would not parse are guesses, and a screen
 * of them buries the one real cause. Errors from every file that failed are
 * still reported together — one pass should be enough to fix a directory.
 */
export const make = <F, S, E>(options: {
  readonly root: string
  readonly codec: Codec<F, S, E>
}) =>
  Effect.gen(function*() {
    const files = yield* readMatching(options.root, options.codec.match)

    const decoded = new Map<string, F>()
    const failures: Array<E> = []
    for (const [path, contents] of files) {
      const result = options.codec.decode(path, contents)
      if (Result.isFailure(result)) failures.push(result.failure)
      else decoded.set(path, result.success)
    }

    const outcome = failures.length > 0
      ? Result.fail(options.codec.combine(failures))
      : options.codec.validate(decoded)

    const snapshot = yield* SubscriptionRef.make<Snapshot<S> | null>(
      Result.isSuccess(outcome) ? { rev: 1, value: outcome.success } : null,
    )
    const errors = yield* SubscriptionRef.make<E | null>(
      Result.isFailure(outcome) ? outcome.failure : null,
    )

    return { snapshot, errors }
  })

/** The failure of reading the directory itself — a missing root, a permission
 *  denial. Distinct from anything the codec can say: the set was never seen,
 *  so there is no `file:line` to name and nothing to report but the reason.
 *  It never reaches a browser; it is what the binary exits on. */
export class PlatformFailure extends Data.TaggedError("PlatformFailure")<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `cannot read ${this.path}: ${
      this.cause instanceof Error ? this.cause.message : String(this.cause)
    }`
  }
}

/** Every matching file under `root`, keyed by its root-relative path, read in
 *  a stable order so two loads of one directory produce identical output. */
const readMatching = (root: string, match: (path: string) => boolean) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path_ = yield* Path.Path

    const entries = yield* fs.readDirectory(root, { recursive: true }).pipe(
      Effect.mapError((cause) => new PlatformFailure({ path: root, cause })),
    )

    const contents = new Map<string, string>()
    for (const entry of [...entries].sort()) {
      // `readDirectory` yields the platform's separator; the codec's rules and
      // every `file:line` a consumer prints are in `/`, so the conversion
      // happens once, here, at the edge — through the same Path service the
      // bytes come from, not through an ambient `process.platform`.
      const path = entry.split(path_.sep).join("/")
      if (!match(path)) continue
      contents.set(
        path,
        yield* fs.readFileString(path_.join(root, entry)).pipe(
          Effect.mapError((cause) => new PlatformFailure({ path, cause })),
        ),
      )
    }
    return contents
  })
