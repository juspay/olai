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
  /**
   * Told when what GIT is doing for this directory changes.
   *
   * Same argument as the observer above, one subject over: whether the
   * directory is a repository, and whether the last commit worked, is a fact
   * about this layer's writes rather than about whoever asked for one — so it
   * is reported from here, once, and a transport publishes it. The server puts
   * it in the app header; a terminal agent reads it as a resource of the same
   * surface.
   *
   * Called only on a CHANGE, and never for the first reading: the first is
   * whatever `git` below answers, which is what a caller seeds its cell from.
   */
  readonly onGit?: (state: Git.GitState) => void
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
  /**
   * What git is doing for this directory, as of now.
   *
   * Probes the directory the FIRST time it is asked and keeps the answer, so a
   * caller that wants to say something about git before any write has happened
   * — a server seeding the cell its header draws — asks for it, and the answer
   * costs one `rev-parse` per serve rather than one per op. Every later change
   * arrives on {@link Options.onGit}.
   */
  readonly git: Effect.Effect<Git.GitState>
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

  /**
   * TWO facts about git, and keeping them apart is the difference between a
   * state that recovers and one that gets stuck.
   *
   * What git makes of the DIRECTORY — a work tree, not one, or a git that could
   * not be run — is a property of the root, so it is probed once and kept:
   * asking per write meant a third subprocess inside the store's write gate
   * every time. A repository created after the server started is not noticed
   * until it restarts, which is the trade. `--no-commit` seeds it, so the
   * opt-out never spawns git at all — which is what keeps olai out of the
   * history of a directory whose history is somebody else's job.
   *
   * What the last COMMIT did is the other, and it is the one that moves. It is
   * kept as the refusal itself rather than as a second state, so what a reader
   * is told can be DERIVED from the two ({@link reading}) instead of written a
   * third time: the directory's own answer, unless a commit refused. That is
   * also what keeps a refusal from wedging the writes — the probe's answer is
   * still what decides whether a commit is attempted, so a directory that IS a
   * repository keeps being written to a repository however loudly the last
   * commit failed.
   */
  let probed: Git.GitState | null = options.commit === false ? Git.OFF : null
  let refused: string | null = null

  const asked: Effect.Effect<Git.GitState> = Effect.gen(function*() {
    probed ??= yield* Git.probe(options.root)
    return probed
  })

  const reading = (directory: Git.GitState): Git.GitState =>
    refused === null ? directory : Git.errorState(refused)

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
        /** Why not, when not — the sentence that used to go only to the log.
         *  It rides the reply, so a `committed: false` says what happened
         *  where the person who asked for the write is looking. */
        let why: string | undefined
        const outcome = yield* Effect.result(
          options.store.commit({
            baseRev: snapshot.rev,
            changes,
            afterPublish: Effect.gen(function*() {
              // Every state but `repo` is a reason, and each of them is a
              // different one — the opt-out, a directory that is not a work
              // tree, a git that cannot be run. None of them attempts a commit,
              // and all of them say so.
              const directory = yield* asked
              if (directory.status !== "repo") {
                why = Git.why(directory)
                return
              }
              const commitment = yield* Git.commit({
                root: options.root,
                paths,
                message: about.summary,
              })
              committed = commitment.kind === "committed"
              why = Git.why(commitment)
              // A refusal is the state of this directory until something
              // works: the header should say so while it is true, and stop
              // saying so when the next write lands. Published only when it
              // MOVED — a write landing in a healthy repository is the
              // ordinary case, and republishing it would wake every open tab
              // on every op.
              const before = refused
              refused = commitment.kind === "refused" ? commitment.said : null
              if (refused !== before) options.onGit?.(reading(directory))
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

        return {
          ...about,
          rev: written.success,
          committed,
          ...(why === undefined ? {} : { why }),
        }
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

  return { run: reported, read, git: Effect.map(asked, reading) }
}
