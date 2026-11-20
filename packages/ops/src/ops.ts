import { serialized } from "./encode.ts"
import {
  admits,
  blamed,
  BusyFailure,
  byPath,
  implicatedBy,
  type CommitRequest,
  type CommitResult,
  type HomesAnswer,
  type HomesRequest,
  type KindVocabulary,
  NO_KINDS,
  type MovingAnswer,
  type MovingRequest,
  type NamedAnswer,
  type NamedRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  NOTHING_WRONG,
  type OpFailure,
  type OutlineError,
  type PageReading,
  type PageRequest,
  type PushResult,
  type Reading,
  type SearchAnswer,
  type SearchRequest,
  parserFor,
  type Claims,
  type OutlineFormat,
  stampOf,
  type TagsAnswer,
  type TagsRequest,
  UsageFailure,
  ValidationFailure,
  type Verdict,
  type Writer,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import { Effect, Result, Scope, SubscriptionRef } from "effect"

import type { Snapshot } from "@olai/store"
import type { Store } from "./deps.ts"
import { type SessionRule, barred, doorRefusal } from "./door.ts"
import { type Context, plan, scoping } from "./plan.ts"
import * as Query from "./query.ts"
import { standing } from "./standing.ts"
import { sortOfWrite } from "./sorted.ts"
import { asking, type Asking } from "./tools.ts"

export interface Ledger {
  readonly wrote: (writer: Writer) => void
  readonly whyWaiting: (writer: Writer) => Effect.Effect<string>
  readonly waiting: Effect.Effect<ReadonlyArray<{ readonly file: string; readonly path: string }>>
  readonly record: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
  readonly resume: Effect.Effect<void>
  readonly hold: Effect.Effect<void, never, Scope.Scope>
}

export interface Search {
  readonly nodes: (ask: {
    readonly at: Reading
    readonly query: SearchRequest
    readonly now: string
    readonly kinds: KindVocabulary
  }) => Effect.Effect<SearchAnswer>
}

export const NO_SEARCH: Search = {
  nodes: ({ query }) =>
    Effect.succeed({
      hits: [],
      total: 0,
      refusals: [{
        token: query.text,
        reason: "the `search` plugin is not running on this serve, so there is "
          + "no matcher to look this up in",
      }],
    }),
}

export const NO_LEDGER: Ledger = {
  wrote: () => {},
  waiting: Effect.succeed([]),
  whyWaiting: () =>
    Effect.succeed("nobody is recording writes here, so they land and wait for nobody"),
  record: () =>
    Effect.succeed({
      _tag: "Failed",
      said: "nobody is recording writes here, so there is nobody to record a write",
      lock: null,
    }),
  push: Effect.succeed({
    _tag: "Failed",
    said: "nobody is recording writes here, so there is nobody to push",
  }),
  resume: Effect.void,
  hold: Effect.void,
}

export interface Options {
  readonly claims: { readonly current: Claims }
  readonly format: string
  readonly store: Store
  readonly root: string
  readonly ledger?: Ledger
  readonly search?: Search
  readonly context?: Context
  readonly kinds?: KindVocabulary
  readonly onRefusal?: (request: Request, failure: OpFailure, writer: Writer) => Effect.Effect<void>
}

export interface Ops extends Asking {
  readonly parserFor: (path: string) => { readonly claims: Claims; readonly format: OutlineFormat } | null
  readonly narrowing: (
    request: NarrowingRequest,
  ) => Effect.Effect<NarrowingAnswer, OpFailure>
  readonly named: (
    request: NamedRequest,
  ) => Effect.Effect<NamedAnswer, OpFailure>
  readonly homes: (
    request: HomesRequest,
  ) => Effect.Effect<HomesAnswer, OpFailure>
  readonly page: (
    request: PageRequest,
  ) => Effect.Effect<PageReading, OpFailure>
  readonly moving: (
    request: MovingRequest,
  ) => Effect.Effect<MovingAnswer, OpFailure>
  readonly tags: (
    request: TagsRequest,
  ) => Effect.Effect<TagsAnswer, OpFailure>
  readonly run: (
    request: Request,
    writer: Writer,
    rule?: SessionRule,
  ) => Effect.Effect<Applied, OpFailure>
  readonly idle: Effect.Effect<void>
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
  readonly waiting: Effect.Effect<ReadonlyArray<{ readonly file: string; readonly path: string }>>
  readonly resume: Effect.Effect<void>
  readonly hold: Effect.Effect<void, never, Scope.Scope>
  readonly read: Effect.Effect<Reading & { readonly outlineRow: string }, OpFailure>
}

const ROUNDS = 5

const REPAIRS = 1

const blockerOf = (
  verdict: Verdict,
  paths: ReadonlyArray<string>,
  alreadyBroken: boolean,
): string | undefined => {
  const entries = blamed(verdict.findings)
  const admission = admits(entries, paths)
  if (admission._tag === "implicated") return admission.file
  return alreadyBroken ? undefined : entries[0]?.file
}

const aboutFiles = (findings: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  [
    ...new Set(
      findings.flatMap((finding) => implicatedBy(finding)),
    ),
  ].sort(byPath)

export const NO_DIRECTORY = new UsageFailure({ reason: "this process is serving no directory, so there is nothing to write to" })

export const make = (options: Options): Ops & { readonly close: Effect.Effect<void> } => {
  let closed = false
  const currentStore = Effect.suspend(() => closed ? Effect.fail(NO_DIRECTORY) : Effect.succeed(options.store))
  const kinds = options.kinds ?? NO_KINDS
  const context: Context = options.context ?? {
    mint: () => Math.random().toString(36).slice(2, 10),
    now: () => stampOf(new Date()),
  }

  const views = standing(context.now, kinds)

  const ledger = options.ledger ?? NO_LEDGER
  const search = options.search ?? NO_SEARCH

  const read: Effect.Effect<Reading & { readonly outlineRow: string }, OpFailure> = Effect.gen(function*() {
    const store = yield* currentStore
    const { snapshot } = yield* store.read("cheap")
    if (snapshot === null) {
      const errors = yield* SubscriptionRef.get(store.errors)
      return yield* new ValidationFailure({
        reason: "the served directory has never loaded, so there is nothing to read",
        verdict: errors ?? NOTHING_WRONG,
      })
    }
    return { ...snapshot.value, outlineRow: options.format }
  })

  const run = (
    request: Request,
    writer: Writer,
    rule?: SessionRule,
  ): Effect.Effect<Applied, OpFailure> =>
    Effect.gen(function*() {
      const store = yield* currentStore
      let repairBudget = REPAIRS
      let summary: string | undefined
      let staleWrites = 0
      let claimsMismatches = 0
      let firstRev: number | undefined
      let lastRev: number | undefined
      const movements = new Map<string, { rounds: number; removals: number }>()
      let lostBaseRev: number | undefined
      const observeRace = (snapshot: Snapshot<Reading> | null) => {
        if (lostBaseRev === undefined) return
        if (snapshot !== null && snapshot.rev > lostBaseRev) {
          const removed = new Set(snapshot.removed)
          for (const path of new Set([...snapshot.changed, ...snapshot.removed])) {
            const held = movements.get(path)
            movements.set(path, { rounds: (held?.rounds ?? 0) + 1, removals: (held?.removals ?? 0) + (removed.has(path) ? 1 : 0) })
          }
        }
        lostBaseRev = undefined
      }
      const healOnce = (files: ReadonlyArray<string>): Effect.Effect<boolean> =>
        Effect.gen(function*() {
          if (repairBudget === 0 || files.length === 0) return false
          const drifted = yield* Effect.result(store.drifted(files))
          if (!Result.isSuccess(drifted) || drifted.success.length === 0) return false
          repairBudget -= 1
          const resynced = yield* Effect.result(store.refresh("verified"))
          return Result.isSuccess(resynced)
        })
      while (staleWrites + claimsMismatches < ROUNDS) {
        const { snapshot } = yield* store.read("cheap")
        observeRace(snapshot)
        if (snapshot === null) {
          const errors = yield* SubscriptionRef.get(store.errors)
          return yield* new ValidationFailure({
            reason:
              "the served directory has never loaded, so there is nothing to write to",
            verdict: errors ?? NOTHING_WRONG,
          })
        }

        if (snapshot.value.claims !== options.claims.current) {
          claimsMismatches += 1
          yield* Effect.mapError(store.refresh("verified"), failure => new ValidationFailure({ reason: failure.message, verdict: NOTHING_WRONG }))
          continue
        }
        const planned = plan(scoping(snapshot.value, context, kinds, options.format), request)
        if (Result.isFailure(planned)) {
          const held = snapshot.value.set.broken
          const tag = planned.failure._tag
          if (
            (tag === "NotFoundFailure" || tag === "ValidationFailure") &&
            held.length > 0 &&
            (yield* healOnce(aboutFiles(held.flatMap((entry) => entry.errors))))
          ) {
            continue
          }
          return yield* planned.failure
        }
        const { files, documents = [], removed = [], ...about } = planned.success
        summary = about.summary

        if (rule !== undefined) {
          if (rule._tag === "closed") {
            return yield* new UsageFailure({
              reason: doorRefusal({ why: "closed" }),
            })
          }
          if (rule.confined != null && (request.op === "trash" || request.op === "empty" || request.op === "delete")) {
            return yield* new UsageFailure({
              reason: doorRefusal({ why: "trash", says: rule.confined.says }),
            })
          }
          const reached = barred(rule.forbidden, snapshot.value.derived, planned.success, snapshot.value.set, rule.confined ?? null)
          if (reached !== null) {
            return yield* new UsageFailure({
              reason: doorRefusal(reached),
            })
          }
        }

        const outlines = yield* Effect.forEach(files, file => {
          const value = serialized(snapshot.value.claims, file.file, file.nodes)
          return Result.isFailure(value) ? Effect.fail(value.failure)
            : Effect.succeed({ path: file.file, contents: value.success })
        })
        const changes = [
          ...outlines,
          ...documents.map((doc) => ({ path: doc.file, contents: doc.text })),
          ...removed.map((path) => ({ path, contents: null })),
        ]
        const outcome = yield* Effect.result(
          store.commit({ baseRev: snapshot.rev, changes }),
        )

        if (Result.isFailure(outcome)) {
          if (outcome.failure._tag === "StaleWrite") {
            staleWrites++
            firstRev ??= outcome.failure.baseRev
            lastRev = outcome.failure.currentRev
            lostBaseRev = outcome.failure.baseRev
            continue
          }
          return yield* new ValidationFailure({
            reason: `the write could not be made: ${outcome.failure.message}`,
            verdict: NOTHING_WRONG,
          })
        }

        const written = outcome.success
        if (Result.isFailure(written)) {
          if (yield* healOnce(aboutFiles(written.failure.findings))) continue
          const paths = changes.map((change) => change.path)
          const alreadyBroken =
            (yield* SubscriptionRef.get(store.errors)) !== null
          const blocker = blockerOf(written.failure, paths, alreadyBroken)
          return yield* new ValidationFailure({
            reason: blocker !== undefined
              ? `\`${about.summary}\` would leave \`${blocker}\` invalid, so ` +
                `nothing was written`
              : `\`${about.summary}\` was not written: ${
                paths.map((path) => `\`${path}\``).join(", ")
              } changed while the served outlines were not loading, so this edit ` +
                `would be made from an older copy of them`,
            verdict: written.failure,
          })
        }

        ledger.wrote(writer)
        for (const document of documents) {
          const held = yield* Effect.result(store.body(document.file))
          if (Result.isFailure(held)) {
            return yield* new ValidationFailure({
              reason:
                `\`${about.summary}\` landed — rev ${written.success} is published and ` +
                `\`${document.file}\` is on disk — but reading it back failed: ` +
                `${held.failure.message} \`markdown_read\` shows what is there and ` +
                `\`markdown_write\` is the way back.`,
              verdict: NOTHING_WRONG,
            })
          }
          if (held.success === null) {
            return yield* new ValidationFailure({
              reason:
                `\`${about.summary}\` landed — rev ${written.success} is published — but ` +
                `the served set does not hold \`${document.file}\` now: something outside ` +
                `this write took it out of the set inside the write's own window. Check ` +
                `the directory, and \`markdown_write\` is the way back to the text that ` +
                `was asked for.`,
              verdict: NOTHING_WRONG,
            })
          }
          if (held.success !== document.text) {
            const wrote = new TextEncoder().encode(document.text).length
            const kept = new TextEncoder().encode(held.success).length
            return yield* new ValidationFailure({
              reason:
                `\`${about.summary}\` landed — rev ${written.success} is published and ` +
                `\`${document.file}\` is on disk — but it holds ${
                  kept === wrote
                    ? `different bytes of the same ${kept}-byte length`
                    : `${kept} bytes where ${wrote} were written`
                }. The set serves what the disk holds; \`markdown_write\` is the way ` +
                `back (the file exists now, so create is refused).`,
              verdict: NOTHING_WRONG,
            })
          }
        }

        const why = yield* ledger.whyWaiting(writer)
        const { set, derived } = snapshot.value
        const sort = sortOfWrite(set, derived, planned.success)
        return {
          ...about,
          rev: written.success,
          why,
          ...(sort === undefined ? {} : { sort }),
        }
      }

      if (lostBaseRev !== undefined) observeRace((yield* store.read("cheap")).snapshot)
      const subject = summary === undefined ? "this write" : `\`${summary}\``
      const paths = [...movements].sort(([a, left], [b, right]) => right.rounds - left.rounds || a.localeCompare(b))
      const frequency = (count: number) => count === 1 ? "once" : count === staleWrites ? "every time" : `${count} times`
      const named = paths.slice(0, 4).map(([path, movement]) => {
        const removal = movement.removals === movement.rounds
          ? " removed"
          : ""
        const sometimesRemoved = movement.removals > 0 && movement.removals < movement.rounds
          ? ` (removed ${frequency(movement.removals)})`
          : ""
        return `\`${path}\`${removal} ${frequency(movement.rounds)}${sometimesRemoved}`
      })
      if (paths.length > 4) named.push(`and ${paths.length - 4} more`)
      return yield* new BusyFailure({
        reason: staleWrites === 0
          ? `${subject} was not written: the directory's set of file kinds was out of date on all ${claimsMismatches} attempts ` +
            `and a refresh never caught up. That is olai's own fault, not the directory's — restart the server.`
          : `${subject} was not written: the directory changed under it on ${staleWrites === ROUNDS ? `all ${ROUNDS}` : `${staleWrites} of ${ROUNDS}`} attempts ` +
            `(revision ${firstRev} → ${lastRev})${named.length === 0 ? "" : ` — ${named.join(", ")}`}. ` +
            (claimsMismatches === 0 ? "" : `The directory's set of file kinds was also out of date on ${claimsMismatches} attempts. `) +
            `Something is rewriting ${named.length === 0 ? "the directory" : "those files"}; wait for it to stop, or stop it, then try again.`,
      })
    })

  const reported = (
    request: Request,
    writer: Writer,
    rule?: SessionRule,
  ): Effect.Effect<Applied, OpFailure> =>
    options.onRefusal === undefined
      ? run(request, writer, rule)
      : Effect.tapError(
        run(request, writer, rule),
        (failure) => options.onRefusal!(request, failure, writer),
      )

  let inflight = 0
  const waiters: Array<() => void> = []
  const beginWrite = (): void => {
    inflight++
  }
  const endWrite = (): void => {
    inflight--
    if (inflight === 0) {
      const pending = waiters.splice(0)
      for (const wake of pending) wake()
    }
  }
  const idle: Effect.Effect<void> = Effect.callback<void>((resume) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resume(Effect.void)
    }
    if (inflight === 0) {
      finish()
      return
    }
    waiters.push(finish)
  })
  const tracked = (
    request: Request,
    writer: Writer,
    rule?: SessionRule,
  ): Effect.Effect<Applied, OpFailure> =>
    Effect.suspend(() => {
      beginWrite()
      return Effect.ensuring(reported(request, writer, rule), Effect.sync(endWrite))
    })

  return {
    parserFor: path => {
      if (closed) return null
      const claims = options.claims.current
      const format = parserFor(claims, path)
      return format === null ? null : { claims, format }
    },
    run: tracked,
    close: Effect.andThen(Effect.sync(() => { closed = true }), idle),
    idle,
    read,
    ...asking(read, context.now, kinds, search),
    narrowing: (request) => Effect.map(read, (at) => views.narrowing(at, request)),
    named: (request) => Effect.map(read, (at) => Query.named(at.derived, request)),
    homes: (request) => Effect.map(read, (at) => Query.homes(at, request)),
    page: (request) => Effect.map(read, (at) => views.page(at, request)),
    moving: (request) => Effect.map(read, (at) => views.moving(at, request)),
    tags: (request) =>
      Effect.map(read, (at) => Query.tags(at.derived, request)),
    commit: (request, writer) => Effect.suspend(() => closed
      ? Effect.succeed({ _tag: "Failed" as const, said: NO_DIRECTORY.reason, lock: null })
      : ledger.record(request, writer)),
    push: Effect.suspend(() => closed
      ? Effect.succeed({ _tag: "Failed" as const, said: NO_DIRECTORY.reason })
      : ledger.push),
    waiting: Effect.suspend(() => closed ? Effect.succeed([]) : ledger.waiting),
    resume: Effect.suspend(() => closed ? Effect.void : ledger.resume),
    hold: Effect.suspend(() => closed ? Effect.void : ledger.hold),
  }
}
