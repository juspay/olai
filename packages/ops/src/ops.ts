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
  stampOf,
  ValidationFailure,
} from "@olai/format"
import { Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import * as Git from "./git.ts"
import { type Context, plan } from "./plan.ts"
import { index } from "./query.ts"
import type { Applied, Request } from "./request.ts"
import type { Reading } from "./tools.ts"

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
   *  instant a mark is stamped with are the only two things about an op that
   *  are not a function of the snapshot. */
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
   *  procedure and both need an answer they can render. */
  readonly run: (request: Request) => Effect.Effect<Applied, OpFailure>
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
    // The clock, read through the format's own minting: a mark is stamped with
    // the instant it was made, in the zone the person marking it is standing
    // in, and what that text looks like is the format's business rather than
    // this file's (`@olai/format`'s `stampOf`).
    now: () => stampOf(new Date()),
  }

  /** Whether the served directory is a git work tree. Asked once and kept: it
   *  is a property of the root, and asking per write meant a third subprocess
   *  inside the store's write gate every time. A repository created after the
   *  server started is not noticed until it restarts, which is the trade. */
  let workTree: boolean | null = null

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
            afterPublish: options.commit === false ? Effect.void : Effect.gen(function*() {
              workTree ??= yield* Git.isWorkTree(options.root)
              if (!workTree) return
              committed = yield* Git.commit({
                root: options.root,
                paths,
                message: about.summary,
              })
            }),
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

  const reported = (request: Request): Effect.Effect<Applied, OpFailure> =>
    options.onRefusal === undefined
      ? run(request)
      : Effect.tapError(run(request), (failure) => options.onRefusal!(request, failure))

  return { run: reported, read }
}
