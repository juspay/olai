/** The activation owns the cursor, pending digests and one sequential poll fiber.
 * Chat asks a thunk only when it writes the delivery row, including after a busy turn. */
import { Effect } from "effect"
import type { Clock, Deliveries } from "@olai/plugin-api/services"
import type { AccountMachine } from "./account.ts"
import type { InboxBind, InboxReading } from "./inbox.ts"
import type { Memory } from "./local.ts"
import type { openMailbox } from "./mailbox.ts"
import type { rowOf } from "./himalaya/threads.ts"
import { arrivingIn } from "./himalaya/history.ts"

type Row = ReturnType<typeof rowOf>
type Mailbox = Pick<Effect.Success<ReturnType<typeof openMailbox>>, "history" | "seed" | "summary">
const keyOf = (bind: InboxBind) => JSON.stringify([bind.node, bind.engine, bind.session])
const line = (text: string) => text.replace(/[\r\n]+/g, " ")
export const digest = (address: string, since: string, rows: ReadonlyArray<Row>): string => [
  `New mail in ${address} — ${rows.length} ${rows.length === 1 ? "thread" : "threads"} since ${since.slice(11, 16)} UTC.`,
  ...rows.slice(0, 50).flatMap(row => [`- ${line(row.from)} · ${line(row.subject)} · ${line(row.date)} · ${row.id}${row.unread ? " (unread)" : ""}`, `  ${line(row.snippet)}`]),
  ...(rows.length > 50 ? [`${rows.length - 50} more threads; use mail_inbox for the rest.`] : []),
  "Written by olai's mail watcher, not by a person.",
].join("\n")

export const makeWatch = (deps: {
  readonly mailbox: Mailbox
  readonly memory: Memory
  readonly machine: Pick<AccountMachine, "current" | "usable">
  readonly deliveries: Pick<Deliveries, "notify">
  readonly clock: Clock
  readonly debug: (line: string) => void
  readonly warn: (line: string) => void
}) => {
  const { mailbox, memory, machine, deliveries, clock, debug, warn } = deps
  let reading: InboxReading = { binds: [], named: [] }
  let observed = false
  let reseed = false
  let generation = 0
  let since = clock.now()
  let warned = false
  let gapSaid = false
  const notices = new Set<string>()
  const pending = new Map<string, { since: string; rows: Map<string, Row>; connection: string }>()
  const revision = (next: InboxReading): boolean => {
    const stopped = next.binds.length === 0 && (!observed || reading.binds.length > 0)
    const keys = new Set(next.binds.map(keyOf))
    for (const key of pending.keys()) if (!keys.has(key)) pending.delete(key)
    if (stopped) { reseed = true; generation++ }
    reading = next
    observed = true
    return stopped
  }
  const poll = Effect.gen(function*() {
    const binds = [...reading.binds]
    if (!binds.length) { debug("mail inbox dropped why=no-binds"); return }
    if (!machine.usable()) {
      if (machine.current().status === "absent") for (const bind of binds) {
        const key = keyOf(bind)
        if (notices.has(key)) continue
        yield* deliveries.notify({ agent: bind.engine, session: bind.session }, () =>
          reading.binds.some(now => keyOf(now) === key) && machine.current().status === "absent"
            ? "this node asks for inbox wakes but this serve has no Gmail account connected — connect one in ⧉ plugins" : null)
        notices.add(key)
      }
      debug("mail inbox dropped why=not-usable")
      return
    }
    const record = memory.current()
    if (!record || !record.address) return
    const connection = record.connectedAt
    const epoch = generation
    const current = () => machine.usable() && memory.current()?.connectedAt === connection && memory.current()?.address === record.address && generation === epoch
    if (reseed || record.historyId === null) {
      const id = yield* mailbox.seed
      if (!current()) return
      yield* memory.advance(connection, id)
      reseed = false
      since = clock.now()
      return
    }
    const ids = new Set<string>()
    const pages = new Set<string>()
    let page: string | undefined
    let newest = record.historyId
    let added = 0
    do {
      const answer = yield* Effect.result(mailbox.history(record.historyId, page))
      if (answer._tag === "Failure") {
        if (/\b404\b|notFound|not found/i.test(answer.failure.reason)) {
          const seed = yield* mailbox.seed
          if (!current()) return
          yield* memory.advance(connection, seed)
          pending.clear()
          since = clock.now()
          if (!gapSaid) { debug("mail inbox history expired; reseeded without ringing for the gap"); gapSaid = true }
          return
        }
        return yield* Effect.fail(answer.failure)
      }
      const value = answer.success
      newest = value["history-id"]
      added += value.history.reduce((n, row) => n + row["messages-added-details"].length, 0)
      for (const id of arrivingIn(value)) ids.add(id)
      page = value.next_page ?? undefined
      if (page && pages.has(page)) throw new Error("Himalaya repeated a history page token")
      if (page) pages.add(page)
    } while (page)
    const rows = yield* Effect.forEach([...ids], id => mailbox.summary(id), { concurrency: 4 })
    if (!current()) return
    debug(`mail inbox poll since=${record.historyId} added=${added} threads=${rows.length} binds=${binds.length}`)
    if (!rows.length) debug("mail inbox dropped why=empty")
    for (const bind of binds) {
      const key = keyOf(bind)
      if (!reading.binds.some(now => keyOf(now) === key) || !rows.length) continue
      let held = pending.get(key)
      if (!held || held.connection !== connection) {
        held = { since, rows: new Map(), connection }
        pending.set(key, held)
      }
      for (const row of rows) held.rows.set(row.id, row)
      const batch = held
      yield* deliveries.notify({ agent: bind.engine, session: bind.session }, () => {
        if (pending.get(key) !== batch || !reading.binds.some(now => keyOf(now) === key) || memory.current()?.connectedAt !== connection || !machine.usable()) return null
        const body = digest(record.address!, batch.since, [...batch.rows.values()])
        debug(`mail inbox delivering session=${bind.session} threads=${batch.rows.size}`)
        pending.delete(key)
        debug("mail inbox delivered")
        return body
      }, { coalesce: "mail:inbox" })
    }
    // Only after every recipient has accepted its thunk; disk failure retries.
    if (current()) yield* memory.advance(connection, newest)
    since = clock.now()
  }).pipe(Effect.catchCause(cause => Effect.sync(() => {
    if (!warned) { warn(`mail inbox poll failed; retrying next poll: ${String(cause)}`); warned = true }
  })))
  return { revision, poll }
}
