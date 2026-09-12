/**
 * THE CI WATCH — one websocket to the service; the boarded ids; a stream
 * hold per live boarded run.
 *
 * Discovery is board-driven: the set of watched runs is the `odu-run` values
 * the vault names. A run nobody boards is not subscribed, whatever the service
 * knows about it. A settled boarded run costs nothing beyond its row. A live
 * boarded run holds `streams.nodes` until the frame says `done`.
 *
 * THE TWO NOTICES, per subscription:
 *   - first-red: once, on the first frame carrying a red node. A live run
 *     first seen already red rings. A settled run first seen red does not.
 *   - settle: once per settlement observed by this subscription, on the frame
 *     whose state leaves `running`. A run first seen already settled rings
 *     nothing.
 */

import type { NodesFrame, RunRow } from "@odu/service-client/surface"
import { oduServiceSurface } from "@odu/service-client/surface"
import type { ServiceConnection } from "@odu/service-client/dial"
import { mirrorRemoteSurface } from "@kolu/surface/mirror"
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

interface Sub {
  firstRed: boolean
  wasRunning: boolean
  reddened: Set<string>
}

const nowIso = (): string => new Date().toISOString()

export const makeWatch = (deps: WatchDeps): Watch => {
  let wanted = new Set<string>()
  const board = new Map<string, RunRow>()
  const frames = new Map<string, NodesFrame>()
  const rows = new Map<string, CiRun>()
  const subs = new Map<string, Sub>()
  const streams = new Map<string, Fiber.Fiber<void, never>>()
  let connection: ServiceConnection | null = null
  let mirrorAbort: AbortController | null = null
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
    let sub = subs.get(id)
    if (sub === undefined) {
      sub = { firstRed: false, wasRunning: row.state === "running", reddened: new Set() }
      subs.set(id, sub)
      // First sight: a live run already red rings; a settled one does not.
      if (row.live) {
        const first = row.cells.find((cell) => cell.red)
        if (first !== undefined) {
          sub.firstRed = true
          for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
          deps.rang({ kind: "first-red", run: row, cell: first })
        }
      }
      sub.wasRunning = row.state === "running"
      return
    }
    if (row.live && !sub.firstRed) {
      const first = row.cells.find((cell) => cell.red)
      if (first !== undefined) {
        sub.firstRed = true
        for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
        deps.rang({ kind: "first-red", run: row, cell: first })
      }
    }
    for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
    if (sub.wasRunning && row.state !== "running") {
      deps.rang({ kind: "settled", run: row, reddened: [...sub.reddened] })
    }
    sub.wasRunning = row.state === "running"
  }

  const apply = (id: string): void => {
    project(id)
    const row = rows.get(id)
    if (row !== undefined) noticeOf(id, row)
    publish()
  }

  const dropStream = (id: string): Effect.Effect<void> =>
    Effect.gen(function*() {
      const held = streams.get(id)
      if (held === undefined) return
      streams.delete(id)
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
            if (frame.done) fork(dropStream(id))
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

  const syncStreams = (): Effect.Effect<void> =>
    Effect.gen(function*() {
      for (const id of [...streams.keys()]) {
        if (!wanted.has(id) || !liveRow(id)) yield* dropStream(id)
      }
      for (const id of wanted) {
        if (liveRow(id) && !streams.has(id)) yield* holdStream(id)
      }
    })

  const liveRow = (id: string): boolean => {
    const row = board.get(id)
    return row !== undefined && (row.state === "provisioning" || row.state === "running")
  }

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
    fork(dropStream(id))
  }

  const attach = (held: ServiceConnection): void => {
    connection = held
    mirrorAbort?.abort()
    const abort = new AbortController()
    mirrorAbort = abort
    mirrorRemoteSurface(
      oduServiceSurface,
      held.client,
      {
        collections: {
          runs: {
            upsert: (id, record) => onUpsert(id as string, record as RunRow),
            remove: (id) => onRemove(id as string),
          },
        },
      },
      {
        signal: abort.signal,
        log: deps.say,
        onFault: (fault) =>
          deps.say(`olai: odu board fault on ${fault.label}: ${String(fault.err)}`),
      },
    )
    projectWanted()
    fork(syncStreams())
  }

  const detach = (): void => {
    mirrorAbort?.abort()
    mirrorAbort = null
    connection = null
    board.clear()
    frames.clear()
    subs.clear()
    for (const id of [...streams.keys()]) fork(dropStream(id))
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
    if (connection !== null) projectWanted()
    else {
      rows.clear()
      publish()
    }
    fork(syncStreams())
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
