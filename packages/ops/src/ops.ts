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
  type OpFailure,
  type OutlineSet,
  serializeOutline,
  ValidationFailure,
} from "@olai/format"
import type { OutlineError, Store } from "./deps.ts"
import { Effect, Result, SubscriptionRef } from "effect"

import * as Git from "./git.ts"
import { type Context, plan } from "./plan.ts"
import type { Applied, Request } from "./request.ts"

export interface Options {
  readonly store: Store
  /** Absolute path of the served directory — where the git hook runs. */
  readonly root: string
  /** Commit each write to git when the directory is a work tree. On by
   *  default; `olai web --no-commit` is the opt-out, for a directory whose
   *  history is somebody else's job (a sync folder that happens to be a
   *  checkout). */
  readonly commit?: boolean
  /** Overridable so tests are deterministic: the id a new node gets and the
   *  date a mark is stamped with are the only two things about an op that are
   *  not a function of the snapshot. */
  readonly context?: Context
}

export interface Ops {
  /** Perform one op. Fails only with an {@link OpFailure} — every internal
   *  failure mode (a stale base, a file system error) is either retried or
   *  translated, because a caller of this interface is a tool call or a
   *  procedure and both need an answer they can render. */
  readonly run: (request: Request) => Effect.Effect<Applied, OpFailure>
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

  const run = (request: Request): Effect.Effect<Applied, OpFailure> =>
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

        let committed = false
        const outcome = yield* Effect.result(
          options.store.commit({
            baseRev: snapshot.rev,
            changes,
            afterPublish: options.commit === false
              ? Effect.void
              : Effect.map(
                Git.commit({ root: options.root, paths, message: about.summary }),
                (done) => {
                  committed = done
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

        return { ...about, rev: written.success, committed }
      }

      return yield* new BusyFailure({
        reason:
          `the outlines kept changing under this write — ${ROUNDS} attempts, each from a ` +
          `fresh read, all overtaken. Something else is writing continuously.`,
      })
    })

  return { run }
}

/** Re-exported so a consumer that only ever sees an `Applied` can still name
 *  the failure channel without reaching past this package. */
export type { OpFailure, OutlineError }
