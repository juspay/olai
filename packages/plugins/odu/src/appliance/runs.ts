/**
 * THE CI WATCH — one websocket to the service; the boarded ids; a stream
 * hold per live boarded run.
 *
 * Discovery is board-driven: the set of watched runs is the `odu-run` values
 * the vault names. A run nobody boards is not subscribed, whatever the service
 * knows about it. Each boarded id holds `runs.get` for that key — the catalog
 * is every run of the last 30 days, and the cost stays proportional to the
 * board. A boarded run holds `streams.nodes` until the frame says `done`,
 * including a run first seen already settled, so the matrix has cells.
 *
 * THE TWO NOTICES, per subscription:
 *   - first-red: once, on the first frame carrying a red node. A live run
 *     first seen already red rings. A settled run first seen red does not.
 *   - settle: once per settlement observed by this subscription, when `live`
 *     goes from true to false. A run first seen already settled rings
 *     nothing.
 */

import type { NodesFrame, RunRow } from "@odu/service-client/surface"
import type { ServiceConnection } from "@odu/service-client/dial"
import { unenrolledStreamCall } from "@kolu/surface/client"
import { Cause, Effect, Fiber, type Scope, Stream } from "effect"

import { type DialService, originIn, runLink, SPEAKS } from "./link.ts"
import { runOf, unknownOf } from "./project.ts"
import { type CiRun, type OduLink, type RunCell, ODU_UNDIALED, tallyOf } from "./wire/index.ts"

export interface BoardedRun {
  readonly id: string
  readonly node: string
  readonly title: string
}

export type RunNotice =
  | {
    readonly kind: "first-red"
    readonly run: CiRun
    readonly cell: RunCell
  }
  | {
    readonly kind: "settled"
    readonly run: CiRun
    readonly reddened: ReadonlyArray<string>
  }

export interface WatchDeps {
  readonly publish: (runs: ReadonlyArray<CiRun>) => void
  readonly service: (state: OduLink) => void
  readonly rang: (notice: RunNotice) => void
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly env: Record<string, string | undefined>
  readonly now?: () => string
  readonly dial?: DialService
}

export interface Watch {
  readonly reclaim: (boarded: Iterable<BoardedRun>) => void
  readonly run: Effect.Effect<never>
  readonly rows: () => ReadonlyArray<CiRun>
}

export interface Sub {
  firstRed: boolean
  wasLive: boolean
  reddened: Set<string>
}

/** First-sight and later crossings for one boarded id. Pure, so the bench
 *  can name a `provisioning → settled` settle without a live websocket. */
export const advanceSub = (
  prev: Sub | undefined,
  row: CiRun,
): { readonly sub: Sub; readonly notices: ReadonlyArray<RunNotice> } => {
  const notices: Array<RunNotice> = []
  if (prev === undefined) {
    const sub: Sub = { firstRed: false, wasLive: row.live, reddened: new Set() }
    if (row.live) {
      const first = row.cells.find((cell) => cell.red)
      if (first !== undefined) {
        sub.firstRed = true
        for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
        notices.push({ kind: "first-red", run: row, cell: first })
      }
    }
    return { sub, notices }
  }
  const sub: Sub = {
    firstRed: prev.firstRed,
    wasLive: row.live,
    reddened: new Set(prev.reddened),
  }
  if (row.live && !sub.firstRed) {
    const first = row.cells.find((cell) => cell.red)
    if (first !== undefined) {
      sub.firstRed = true
      for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
      notices.push({ kind: "first-red", run: row, cell: first })
    }
  }
  for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
  if (prev.wasLive && !row.live) {
    notices.push({ kind: "settled", run: row, reddened: [...sub.reddened] })
  }
  return { sub, notices }
}

const nowIso = (): string => new Date().toISOString()

export const makeWatch = (deps: WatchDeps): Watch => {
  let wanted = new Set<string>()
  const board = new Map<string, RunRow>()
  const frames = new Map<string, NodesFrame>()
  const rows = new Map<string, CiRun>()
  const subs = new Map<string, Sub>()
  const streams = new Map<string, Fiber.Fiber<void, never>>()
  const holds = new Map<string, Fiber.Fiber<void, never>>()
  let connection: ServiceConnection | null = null
  let scope: Scope.Scope | undefined

  const fork = (effect: Effect.Effect<void>): void => {
    if (scope === undefined) return
    Effect.runFork(effect.pipe(Effect.forkIn(scope), Effect.asVoid))
  }

  const publish = (): void => deps.publish([...rows.values()])

  const project = (id: string): void => {
    if (!wanted.has(id)) {
      rows.delete(id)
      return
    }
    const row = board.get(id)
    rows.set(id, row === undefined ? unknownOf(id) : runOf(row, frames.get(id)))
  }

  const projectWanted = (): void => {
    for (const id of [...rows.keys()]) {
      if (!wanted.has(id)) rows.delete(id)
    }
    for (const id of wanted) project(id)
    publish()
  }

  const noticeOf = (id: string, row: CiRun): void => {
    if (!wanted.has(id)) return
    const next = advanceSub(subs.get(id), row)
    subs.set(id, next.sub)
    for (const notice of next.notices) deps.rang(notice)
  }

  const apply = (id: string): void => {
    project(id)
    const row = rows.get(id)
    if (row !== undefined) noticeOf(id, row)
    publish()
  }

  const dropFiber = (
    id: string,
    table: Map<string, Fiber.Fiber<void, never>>,
  ): Effect.Effect<void> =>
    Effect.gen(function*() {
      const held = table.get(id)
      if (held === undefined) return
      table.delete(id)
      yield* Fiber.interrupt(held)
    })

  const holdStream = (id: string): Effect.Effect<void> =>
    Effect.gen(function*() {
      if (connection === null || streams.has(id)) return
      const client = connection.client
      let self: Fiber.Fiber<void, never> | undefined
      const work = Stream.runForEach(
        unenrolledStreamCall(client.surface.nodes.get, { runId: id }),
        (frame: NodesFrame) =>
          Effect.sync(() => {
            frames.set(id, frame)
            apply(id)
            if (frame.done) fork(dropFiber(id, streams))
          }),
      ).pipe(
        Effect.catchCause((cause) =>
          Effect.sync(() =>
            deps.say(`olai: odu nodes ${id} ended (${String(Cause.squash(cause))})`),
          ),
        ),
        Effect.ensuring(Effect.sync(() => {
          if (self !== undefined && streams.get(id) === self) streams.delete(id)
        })),
      )
      if (scope === undefined) return
      self = yield* work.pipe(Effect.forkIn(scope))
      streams.set(id, self)
    })

  const holdRow = (id: string): Effect.Effect<void> =>
    Effect.gen(function*() {
      if (connection === null || holds.has(id)) return
      const client = connection.client
      let self: Fiber.Fiber<void, never> | undefined
      const work = Stream.runForEach(
        unenrolledStreamCall(client.surface.runs.get, { key: id }),
        (record: RunRow) =>
          Effect.sync(() => {
            if (record === null || record === undefined) onRemove(id)
            else onUpsert(id, record)
          }),
      ).pipe(
        Effect.catchCause((cause) =>
          Effect.sync(() =>
            deps.say(`olai: odu run ${id} ended (${String(Cause.squash(cause))})`),
          ),
        ),
        Effect.ensuring(Effect.sync(() => {
          if (self !== undefined && holds.get(id) === self) holds.delete(id)
        })),
      )
      if (scope === undefined) return
      self = yield* work.pipe(Effect.forkIn(scope))
      holds.set(id, self)
    })

  const syncHolds = (): Effect.Effect<void> =>
    Effect.gen(function*() {
      for (const id of [...holds.keys()]) {
        if (!wanted.has(id)) yield* dropFiber(id, holds)
      }
      for (const id of wanted) {
        if (!holds.has(id)) yield* holdRow(id)
      }
    })

  const syncStreams = (): Effect.Effect<void> =>
    Effect.gen(function*() {
      for (const id of [...streams.keys()]) {
        if (!wanted.has(id) || frames.get(id)?.done === true) yield* dropFiber(id, streams)
      }
      for (const id of wanted) {
        if (board.has(id) && frames.get(id)?.done !== true && !streams.has(id)) {
          yield* holdStream(id)
        }
      }
    })

  const onUpsert = (id: string, record: RunRow): void => {
    if (!wanted.has(id)) return
    board.set(id, record)
    apply(id)
    fork(syncStreams())
  }

  const onRemove = (id: string): void => {
    board.delete(id)
    frames.delete(id)
    subs.delete(id)
    if (wanted.has(id)) apply(id)
    else {
      rows.delete(id)
      publish()
    }
    fork(dropFiber(id, streams))
  }

  const attach = (held: ServiceConnection): void => {
    connection = held
    projectWanted()
    fork(syncHolds())
    fork(syncStreams())
  }

  const detach = (): void => {
    connection = null
    board.clear()
    frames.clear()
    subs.clear()
    for (const id of [...holds.keys()]) fork(dropFiber(id, holds))
    for (const id of [...streams.keys()]) fork(dropFiber(id, streams))
    // Chips vanish for the redial gap rather than lingering as a last
    // reading. A reconnect is a new first sight.
    rows.clear()
    publish()
  }

  const reclaim = (boarded: Iterable<BoardedRun>): void => {
    const next = new Set<string>()
    for (const one of boarded) {
      if (!next.has(one.id)) next.add(one.id)
    }
    wanted = next
    for (const id of [...subs.keys()]) {
      if (!wanted.has(id)) subs.delete(id)
    }
    for (const id of [...board.keys()]) {
      if (!wanted.has(id)) board.delete(id)
    }
    for (const id of [...frames.keys()]) {
      if (!wanted.has(id)) frames.delete(id)
    }
    if (connection !== null) {
      projectWanted()
      fork(syncHolds())
      fork(syncStreams())
    } else {
      rows.clear()
      publish()
    }
  }

  const watch: Watch = {
    reclaim,
    rows: () => [...rows.values()],
    run: Effect.scoped(Effect.gen(function*() {
      scope = yield* Effect.scope
      deps.service({
        ...ODU_UNDIALED,
        origin: originIn(deps.env),
        speaks: SPEAKS,
        since: (deps.now ?? nowIso)(),
      })
      yield* runLink(
        {
          link: deps.service,
          face: (face) => {
            if (face === null) detach()
            else attach(face)
          },
          say: deps.say,
          warn: deps.warn,
        },
        deps.env,
        deps.now ?? nowIso,
        deps.dial,
      )
    })) as Effect.Effect<never>,
  }
  return watch
}

export type { DialService }
export { tallyOf }
