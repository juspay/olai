import type { NodesFrame, RunRow } from "@odu/service-client/surface"
import type { ServiceConnection } from "@odu/service-client/dial"
import { type SurfaceClientCallable, unenrolledStreamCall } from "@kolu/surface/client"
import { Cause, Effect, Fiber, type Scope, Stream } from "effect"

import { runOf, unknownOf } from "./project.ts"
import { type CiRun, liveOf, type RunCell } from "./wire/index.ts"

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

export interface BoardDeps {
  readonly publish: (runs: ReadonlyArray<CiRun>) => void
  readonly rang: (notice: RunNotice) => void
  readonly say: (line: string) => void
}

export interface Board {
  readonly bind: (scope: Scope.Scope) => void
  readonly reclaim: (ids: Iterable<string>) => void
  readonly attach: (connection: ServiceConnection) => void
  readonly detach: () => void
  readonly rows: () => ReadonlyArray<CiRun>
}

export interface Sub {
  firstRed: boolean
  wasLive: boolean
  reddened: Set<string>
}

interface Held {
  row?: RunRow
  frame?: NodesFrame
  projected?: CiRun
  sub?: Sub
  catalog?: Fiber.Fiber<void, never>
  nodes?: Fiber.Fiber<void, never>
}

export const advanceSub = (
  prev: Sub | undefined,
  row: CiRun,
): { readonly sub: Sub; readonly notices: ReadonlyArray<RunNotice> } => {
  const live = liveOf(row.state)
  const notices: Array<RunNotice> = []
  if (prev === undefined) {
    const sub: Sub = { firstRed: false, wasLive: live, reddened: new Set() }
    if (live) {
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
    wasLive: live,
    reddened: new Set(prev.reddened),
  }
  if (live && !sub.firstRed) {
    const first = row.cells.find((cell) => cell.red)
    if (first !== undefined) {
      sub.firstRed = true
      for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
      notices.push({ kind: "first-red", run: row, cell: first })
    }
  }
  for (const cell of row.cells) if (cell.red) sub.reddened.add(cell.id)
  if (prev.wasLive && !live) {
    notices.push({ kind: "settled", run: row, reddened: [...sub.reddened] })
  }
  return { sub, notices }
}

const runsGet = (
  client: SurfaceClientCallable,
): ((input: { readonly key: string }) => Stream.Stream<RunRow, unknown>) => {
  const get = client.surface["runs"]?.["get"]
  if (get === undefined) {
    throw new Error("odu: the service this build dialled serves no `runs` collection")
  }
  return get
}

export const makeBoard = (deps: BoardDeps): Board => {
  const held = new Map<string, Held>()
  let connection: ServiceConnection | null = null
  let scope: Scope.Scope | undefined

  const fork = (effect: Effect.Effect<void>): void => {
    if (scope === undefined) return
    Effect.runFork(effect.pipe(Effect.forkIn(scope), Effect.asVoid))
  }

  const rows = (): ReadonlyArray<CiRun> =>
    [...held.values()].flatMap((one) => one.projected === undefined ? [] : [one.projected])

  const publish = (): void => deps.publish(rows())

  const project = (id: string): void => {
    const one = held.get(id)
    if (one === undefined) return
    one.projected = one.row === undefined ? unknownOf(id) : runOf(one.row, one.frame)
  }

  const noticeOf = (id: string): void => {
    const one = held.get(id)
    const row = one?.projected
    if (one === undefined || row === undefined) return
    const next = advanceSub(one.sub, row)
    one.sub = next.sub
    for (const notice of next.notices) deps.rang(notice)
  }

  const apply = (id: string): void => {
    project(id)
    noticeOf(id)
    publish()
  }

  const dropSlot = (
    one: Held,
    slot: "catalog" | "nodes",
  ): Effect.Effect<void> =>
    Effect.gen(function*() {
      const fiber = one[slot]
      if (fiber === undefined) return
      one[slot] = undefined
      yield* Fiber.interrupt(fiber)
    })

  const hold = <A>(
    id: string,
    slot: "catalog" | "nodes",
    stream: Stream.Stream<A, unknown>,
    each: (value: A) => void,
  ): Effect.Effect<void> =>
    Effect.gen(function*() {
      const one = held.get(id)
      if (connection === null || one === undefined || one[slot] !== undefined) return
      let self: Fiber.Fiber<void, never> | undefined
      const work = Stream.runForEach(stream, (value) => Effect.sync(() => each(value))).pipe(
        Effect.catchCause((cause) =>
          Effect.sync(() =>
            deps.say(`olai: odu ${slot} ${id} ended (${String(Cause.squash(cause))})`),
          ),
        ),
        Effect.ensuring(Effect.sync(() => {
          const current = held.get(id)
          if (current !== undefined && current[slot] === self) current[slot] = undefined
        })),
      )
      if (scope === undefined) return
      self = yield* work.pipe(Effect.forkIn(scope))
      one[slot] = self
    })

  const sync = (): Effect.Effect<void> =>
    Effect.gen(function*() {
      if (connection === null) return
      const client = connection.client
      for (const [id, one] of held) {
        if (one.catalog === undefined) {
          yield* hold(
            id,
            "catalog",
            unenrolledStreamCall(runsGet(client), { key: id }),
            (record) => {
              if (record === null || record === undefined) onRemove(id)
              else onUpsert(id, record)
            },
          )
        }
        if (one.row !== undefined && one.frame?.done !== true && one.nodes === undefined) {
          yield* hold(
            id,
            "nodes",
            unenrolledStreamCall(client.surface.nodes.get, { runId: id }),
            (frame) => {
              const current = held.get(id)
              if (current === undefined) return
              current.frame = frame
              apply(id)
              if (frame.done) fork(dropSlot(current, "nodes"))
            },
          )
        }
      }
    })

  const onUpsert = (id: string, record: RunRow): void => {
    const one = held.get(id)
    if (one === undefined) return
    one.row = record
    apply(id)
    fork(sync())
  }

  const onRemove = (id: string): void => {
    const one = held.get(id)
    if (one === undefined) return
    one.row = undefined
    one.frame = undefined
    one.sub = undefined
    apply(id)
    fork(dropSlot(one, "nodes"))
  }

  const drop = (id: string): void => {
    const one = held.get(id)
    if (one === undefined) return
    held.delete(id)
    fork(dropSlot(one, "catalog"))
    fork(dropSlot(one, "nodes"))
  }

  const attach = (next: ServiceConnection): void => {
    connection = next
    for (const id of held.keys()) project(id)
    publish()
    fork(sync())
  }

  const detach = (): void => {
    connection = null
    for (const one of held.values()) {
      one.row = undefined
      one.frame = undefined
      one.projected = undefined
      one.sub = undefined
      fork(dropSlot(one, "catalog"))
      fork(dropSlot(one, "nodes"))
    }
    publish()
  }

  const reclaim = (ids: Iterable<string>): void => {
    const next = new Set(ids)
    for (const id of [...held.keys()]) {
      if (!next.has(id)) drop(id)
    }
    for (const id of next) {
      if (!held.has(id)) held.set(id, {})
    }
    if (connection !== null) {
      for (const id of held.keys()) project(id)
      publish()
      fork(sync())
    } else {
      for (const one of held.values()) one.projected = undefined
      publish()
    }
  }

  return {
    bind: (next) => { scope = next },
    reclaim,
    attach,
    detach,
    rows,
  }
}
