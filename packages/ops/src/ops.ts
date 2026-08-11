/**
 * The ops layer: the one way anything writes an outline.
 *
 * `@olai/format` says what a record is, `@olai/store` says how bytes become
 * durable, {@link ./plan.ts} says what an edit MEANS. This file is the loop
 * that joins them, and the loop is short because the hard parts are elsewhere:
 *
 *   read the snapshot → PLAN against it → commit at that revision →
 *   if the store moved, read again and plan AGAIN.
 *
 * Re-planning rather than re-sending is the whole point of optimistic
 * concurrency here. "Mark `order` done" means the same thing against a newer
 * snapshot, so a retry lands cleanly — a `git pull`, another tab and the agent
 * can all be writing and none of them loses an update. Only edits that
 * genuinely collide survive the retry, and then it is the op's own refusal that
 * speaks: the node is gone, or somebody else already marked it.
 *
 * A retry that SUCCEEDS is invisible, and deliberately so (docs/brainstorming/
 * acp.md). Everything else is not: a refusal comes back as an `OpFailure` with
 * its structured detail, and a retry that keeps colliding comes back as `busy`
 * rather than as silence.
 */

import {
  BusyFailure,
  type CommitMode,
  type CommitRequest,
  type CommitResult,
  type OpFailure,
  type OutlineSet,
  type Pending,
  serializeOutline,
  ValidationFailure,
  type Writer,
} from "@olai/format"
import { Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import * as Committing from "./pending.ts"
import { type Context, plan } from "./plan.ts"
import { index } from "./query.ts"
import type { Applied, Request } from "./request.ts"
import type { Reading } from "./tools.ts"

export interface Options {
  readonly store: Store
  /** Absolute path of the served directory — where git runs. */
  readonly root: string
  /**
   * How writes reach git. `manual` is the point of the whole thing: a write
   * lands on disk and WAITS, and something asks for a commit — the button, or
   * the agent's `commit` tool. `auto` is for a headless server with no browser
   * to press anything, and commits each write on its own the way olai used to.
   * `off` is `--no-commit`, for a directory whose history is somebody else's
   * job (a sync folder that happens to be a checkout).
   *
   * Required, with no default here: `main.ts` already carries one for the flag,
   * and a second would be a second answer to what happens when nobody says.
   */
  readonly commits: CommitMode
  /** Overridable so tests are deterministic: the id a new node gets and the
   *  date a mark is stamped with are the only two things about an op that are
   *  not a function of the snapshot. */
  readonly context?: Context
  /**
   * Told about every write this layer REFUSED.
   *
   * It hangs here rather than on any one caller because "a refusal is never
   * silently ignored" is a property of WRITES, not of whichever transport
   * asked for one: an observer on the MCP server would leave a second writer —
   * the web UI's own ops procedures, when they arrive — reporting nothing.
   * The agent gets the same detail in its tool result; this is what puts it in
   * front of the person watching.
   */
  readonly onRefusal?: (request: Request, failure: OpFailure) => Effect.Effect<void>
}

export interface Ops {
  /** Perform one op. Fails only with an {@link OpFailure} — every internal
   *  failure mode (a stale base, a file system error) is either retried or
   *  translated, because a caller of this interface is a tool call or a
   *  procedure and both need an answer they can render.
   *
   *  `writer` is INTENT, not identity: git records the repository's own name
   *  and email whoever asked, so this is the only thing that can tell an
   *  agent's edits from a person's. It is required rather than defaulted —
   *  a transport that forgot to say would be a transport whose writes are
   *  attributed to somebody else. */
  readonly run: (
    request: Request,
    writer: Writer,
  ) => Effect.Effect<Applied, OpFailure>
  /** What is waiting to be committed. Derived from git every time it is asked
   *  ({@link ./pending.ts}), so nothing above this layer holds a copy that
   *  could be wrong. */
  readonly pending: Effect.Effect<Pending>
  /** Commit what is waiting. Both doors — the button's procedure and the MCP
   *  tool — are callers of this one thing. */
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  /**
   * The set as a reader sees it, or the one refusal for a directory that has
   * never loaded.
   *
   * Here rather than at each reader so there is ONE answer to "there is
   * nothing to read yet" — the writer's and the query tools' used to be two
   * different shapes for the same condition — and so nothing above this layer
   * has to reach into the store to find out.
   */
  readonly read: Effect.Effect<Reading, OpFailure>
}

/** How many times a write may be re-derived before it gives up. Each round is
 *  a fresh read and a fresh plan; something that has lost five in a row is not
 *  losing a race, it is contending with a writer that never stops. */
const ROUNDS = 5

export const make = (options: Options): Ops => {
  const context: Context = options.context ?? {
    mint: () => Math.random().toString(36).slice(2, 10),
    today: () => new Date().toISOString().slice(0, 10),
  }

  const committing = Committing.make({
    store: options.store,
    root: options.root,
    mode: options.commits,
  })

  const read: Effect.Effect<Reading, OpFailure> = Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
    if (snapshot === null) {
      const errors = yield* SubscriptionRef.get(options.store.errors)
      return yield* new ValidationFailure({
        reason: "the served directory has never loaded, so there is nothing to read",
        errors: errors ?? [],
      })
    }
    const set = snapshot.value as OutlineSet
    return { set, derived: index(set) }
  })

  const run = (
    request: Request,
    writer: Writer,
  ): Effect.Effect<Applied, OpFailure> =>
    Effect.gen(function*() {
      for (let round = 0; round < ROUNDS; round++) {
        const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
        if (snapshot === null) {
          const errors = yield* SubscriptionRef.get(options.store.errors)
          return yield* new ValidationFailure({
            reason:
              "the served directory has never loaded, so there is nothing to write to",
            errors: errors ?? [],
          })
        }

        const planned = plan(snapshot.value as OutlineSet, context, request)
        if (Result.isFailure(planned)) return yield* planned.failure
        const { files, ...about } = planned.success

        const changes = files.map((file) => ({
          path: file.file,
          contents: serializeOutline(file.nodes),
        }))
        const paths = changes.map((change) => options.store.resolve(change.path))

        // The post-publish hook, which is the whole of what `--commit=auto`
        // still does inside the write gate: the bytes are on disk and the
        // browser has seen them, and this cannot fail the write. In every
        // other mode it answers `false` without spawning anything, so what
        // decides is one module and not two.
        let committed = false
        const outcome = yield* Effect.result(
          options.store.commit({
            baseRev: snapshot.rev,
            changes,
            afterPublish: Effect.map(
              committing.automatic(paths, about.summary, writer),
              (did) => {
                committed = did
              },
            ),
          }),
        )

        if (Result.isFailure(outcome)) {
          // A store that moved is the retry; anything else is a disk that
          // cannot be written, which no re-plan will fix.
          if (outcome.failure._tag === "StaleWrite") continue
          return yield* new ValidationFailure({
            reason: `the write could not be made: ${outcome.failure.message}`,
            errors: [],
          })
        }

        const written = outcome.success
        if (Result.isFailure(written)) {
          return yield* new ValidationFailure({
            reason:
              `\`${about.summary}\` would leave the outlines invalid, so nothing was ` +
              `written`,
            errors: written.failure,
          })
        }

        // Recorded AFTER the write landed and only then: the counter answers
        // "how many ops are waiting", and a refused one is not waiting.
        committing.wrote(writer)
        return { ...about, rev: written.success, committed }
      }

      return yield* new BusyFailure({
        reason:
          `the outlines kept changing under this write — ${ROUNDS} attempts, each from a ` +
          `fresh read, all overtaken. Something else is writing continuously.`,
      })
    })

  const reported = (
    request: Request,
    writer: Writer,
  ): Effect.Effect<Applied, OpFailure> =>
    options.onRefusal === undefined
      ? run(request, writer)
      : Effect.tapError(
        run(request, writer),
        (failure) => options.onRefusal!(request, failure),
      )

  return {
    run: reported,
    read,
    pending: committing.pending,
    commit: committing.commit,
  }
}
