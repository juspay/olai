/** File stored conversation heads through ordinary, independent Ops writes.
 * The caller owns scheduling; every row rechecks the vault, including trash. */
import type { InboxRegistry } from "@olai/plugin-api/services"
import { Deferred, Effect, Queue, type Scope } from "effect"
import { declarationsOf, isRegular, seatableIn, outlinePaths, sessionIn, sessionValue, textDeclaredAs,
  type OpFailure, type Reading, type WriteRequest as Request } from "@olai/format"
import type { Listed, SessionInfo } from "olai-plugin-chat/wire"
import { pastOf, chatKey } from "../lineage.ts"
import { ownKinds } from "../kinds.ts"
import { whenOf } from "../when.ts"
import { SESSION_TYPE } from "../binding.ts"

export interface Filing {
  readonly exclusive: <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly write: (request: Request) => Effect.Effect<unknown, OpFailure>
  readonly key: () => string
  readonly current: () => string | null
  readonly assigned: (to: { readonly agent: string; readonly session: string }) => Effect.Effect<void>
  readonly log: (line: string) => Effect.Effect<void>
}

export const CHATS = "chats"

/** Include put-away records: filing must never undo trash or archive. */
export const claimed = (reading: Reading, sessions: ReadonlyArray<SessionInfo>): ReadonlySet<string> => {
  const keys = new Set<string>()
  const declarations = declarationsOf(reading.derived, ownKinds)
  for (const located of reading.derived.nodes) {
    if (!isRegular(located)) continue
    const value = textDeclaredAs(declarations, located.node, SESSION_TYPE)
    const to = value === undefined ? null : sessionIn(value)
    if (to?.session == null) continue
    keys.add(chatKey(to.engine, to.session))
    for (const past of pastOf(sessions, to.engine, to.session)) keys.add(chatKey(past.agent, past.id))
  }
  return keys
}

/** Reuse a moved live Chats container. A trashed or occupied id is kept intact;
 * a numbered reserved id gives subsequent runs the same new live container. */
export const ensureChats = (filing: Pick<Filing, "read" | "write">, file: string): Effect.Effect<string, OpFailure> => Effect.gen(function*() {
  const reading = yield* filing.read
  let id = CHATS
  for (let suffix = 1; reading.derived.byId.has(id); suffix++) {
    const existing = reading.derived.byId.get(id)!
    if (isRegular(existing) && seatableIn(reading.derived, id)) return id
    id = `${CHATS}-${suffix}`
  }
  yield* filing.write(outlinePaths(reading.set).includes(file)
    ? { op: "add", file, id, title: "Chats" }
    : { op: "create", file, seed: { id, title: "Chats" } })
  return id
})

export const fileListed = (filing: Filing, file: string, listed: Listed): Effect.Effect<void> => filing.exclusive(Effect.gen(function*() {
  for (const row of listed.unreachable) yield* filing.log(`filer: ${row.agent}: ${row.why}`)
  if (filing.current() !== file) return
  const heads = listed.sessions.filter(row => row.supersededBy === null
    || !listed.sessions.some(next => next.agent === row.agent && next.id === row.supersededBy))
  const initial = yield* Effect.result(filing.read)
  if (initial._tag === "Failure") { yield* filing.log(`filer: ${initial.failure.message}`); return }
  const held = claimed(initial.success, listed.sessions)
  if (heads.every(row => held.has(chatKey(row.agent, row.id)))) return
  const ensured = yield* Effect.result(ensureChats(filing, file))
  if (ensured._tag === "Failure") { yield* filing.log(`filer: Chats: ${ensured.failure.message}`); return }
  for (const row of heads) {
    if (filing.current() !== file) return
    const outcome = yield* Effect.result(Effect.gen(function*() {
      const reading = yield* filing.read
      if (claimed(reading, listed.sessions).has(chatKey(row.agent, row.id))) return
      yield* Effect.uninterruptibleMask(restore => Effect.gen(function*() {
      yield* restore(filing.write({ op: "add", parent: ensured.success, title: row.title ?? row.id,
        ...noteOf(row),
        props: { [filing.key()]: sessionValue(row.agent, row.id) } }))
      yield* filing.assigned({ agent: row.agent, session: row.id })
      }))
    }))
    if (outcome._tag === "Failure") yield* filing.log(`filer: ${row.agent}/${row.id}: ${outcome.failure.message}`)
  }
}))

export const noteOf = (row: Pick<SessionInfo, "messageCount" | "updatedAt">): { readonly desc?: string } => {
  const minute = whenOf(row.updatedAt)
  const parts = [row.messageCount === null ? null : `${row.messageCount} messages`,
    minute === null ? null : `last ${minute}`].filter((part): part is string => part !== null)
  return parts.length === 0 ? {} : { desc: parts.join(" · ") }
}

/** One event queue belongs to chat's scope. Registry withdrawal invalidates
 * queued work and interrupts the current run; it never withdraws chat itself. */
export const makeFiler = (filing: Filing, inbox: InboxRegistry, listing: {
  readonly all: Effect.Effect<Listed>
  readonly one: (agent: string) => Effect.Effect<Listed>
}): Effect.Effect<{ readonly full: Effect.Effect<void>; readonly settled: (agent: string) => Effect.Effect<void> }, never, Scope.Scope> => Effect.gen(function*() {
  const requests = yield* Queue.unbounded<{ readonly epoch: number; readonly agent: string | null }>()
  let epoch = 0
  let file: string | null | undefined
  let running: { readonly stop: Deferred.Deferred<void> } | null = null
  const request = (agent: string | null) => Effect.suspend(() =>
    file == null ? Effect.void : Effect.asVoid(Queue.offer(requests, { epoch, agent })))
  yield* Effect.forkScoped(Effect.forever(Effect.gen(function*() {
    const next = yield* Queue.take(requests)
    const target = file
    if (target == null || next.epoch !== epoch) return
    const active = { stop: yield* Deferred.make<void>() }
    // Publish cancellation before listing can run or yield to a withdrawal.
    running = active
    yield* Effect.ensuring(Effect.raceFirst(Effect.gen(function*() {
      const listed = yield* next.agent === null ? listing.all : listing.one(next.agent)
      if (next.epoch !== epoch) return
      yield* fileListed(filing, target, listed)
      if (next.agent === null) yield* filing.log("filer: full run complete")
    }), Deferred.await(active.stop)), Effect.gen(function*() {
      if (running === active) running = null
    }))
  })))
  yield* inbox.changed(next => Effect.gen(function*() {
    if (next === file) return
    file = next
    epoch += 1
    const active = running
    if (active !== null) {
      yield* Deferred.succeed(active.stop, undefined)
    }
    yield* filing.log(next === null ? "filer: no Inbox entry; filing is inactive" : `filer: Inbox is ${next}`)
    if (next !== null) yield* request(null)
  }))
  return { full: request(null), settled: request }
})
