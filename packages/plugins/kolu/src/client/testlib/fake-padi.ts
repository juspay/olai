#!/usr/bin/env bun

import { readFileSync } from "node:fs"

import { implementSurface, inMemoryStore } from "@kolu/surface/server"
import { serveOverUnixSocket } from "@kolu/surface/unix-socket"
import { CONTROL_CORE_VERSION } from "@kolu/surface-daemon/control-core"
import {
  PADI_SURFACE_VERSION,
  padiControlSibling,
  padiDaemonGroup,
  padiSurfaceSibling,
  TerminalNotFound,
} from "@kolu/padi-client/surface"
import { Effect, Queue, Stream } from "effect"

import { agentBucket, WATCH_DEFAULT_STATES } from "@kolu/terminal-vocab/agentProjection"
import type { PadiStateEvent } from "@kolu/padi-client/surface"

interface Fleet {
  readonly terminals: Record<string, unknown>
  readonly screens: Record<string, string>
  readonly urgency?: {
    readonly awaitingIds: ReadonlyArray<string>
    readonly finishedIds: ReadonlyArray<string>
    readonly workingIds: ReadonlyArray<string>
    readonly lingerIds: ReadonlyArray<string>
  }
  readonly surfaceVersion?: string
}


interface ScreenTextInput {
  readonly id: string
  readonly startLine?: number
  readonly endLine?: number
}

interface WatchInput {
  readonly states?: ReadonlyArray<string>
  readonly heldForMs?: number
  readonly nagMs?: number
  readonly nagCount?: number
  readonly ignoreIds?: ReadonlyArray<string>
  readonly id?: string
}

interface AgentRecord {
  readonly agent?: { readonly state?: string; readonly startedAt?: number } | null
}

let stateSeq = 0

const watchStates = (input: WatchInput): Stream.Stream<ReadonlyArray<PadiStateEvent>> =>
  Stream.callback<ReadonlyArray<PadiStateEvent>>((queue) =>
    Effect.gen(function*() {
      const wanted = new Set(input.states ?? WATCH_DEFAULT_STATES)
      const heldForMs = input.heldForMs ?? 0
      const ignored = new Set(input.ignoreIds ?? [])
      const matched: ReadonlyArray<{ readonly id: string; readonly state: string; readonly since: number }> =
        Object.entries(fleet.terminals)
          .filter(([id, record]: [string, unknown]) => {
            if ((input.id !== undefined && id !== input.id) || ignored.has(id)) return false
            const agent = (record as AgentRecord).agent
            if (agent?.state === undefined || agent.state === null) return false
            if (!wanted.has(agentBucket(agent.state as never))) return false
            return (agent.startedAt ?? Date.now()) + heldForMs <= Date.now()
          })
          .map(([id, record]: [string, unknown]) => {
            const agent = (record as AgentRecord).agent as NonNullable<AgentRecord["agent"]>
            return { id, state: agentBucket(agent.state as never), since: agent.startedAt ?? Date.now() }
          })
      const event = (
        kind: "snapshot" | "transition" | "nag",
        one: (typeof matched)[number],
        nag?: { readonly index: number; readonly left?: number },
      ): PadiStateEvent => {
        stateSeq += 1
        return {
          seq: stateSeq as never,
          id: one.id as never,
          kind,
          state: one.state as never,
          since: one.since as never,
          at: Date.now() as never,
          ...(nag === undefined ? {} : { nag }),
        } as never
      }
      Queue.offerUnsafe(queue, matched.map((one) => event("snapshot", one)))
      const timers: Array<ReturnType<typeof setTimeout>> = []
      if (input.nagMs !== undefined && matched.length > 0) {
        const cap = input.nagCount
        const arm = (index: number): void => {
          timers.push(setTimeout(() => {
            Queue.offerUnsafe(queue, matched.map((one) => event("nag", one, {
              index: index as never,
              ...(cap === undefined ? {} : { left: (cap - index) as never }),
            })))
            if (cap === undefined || index < cap) arm(index + 1)
          }, input.nagMs))
        }
        arm(1)
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => timers.forEach(clearTimeout)))
    }),
  )

const windowOf = (screen: string, input: ScreenTextInput): string => {
  const lines = screen.split("\n")
  const end = Math.min(lines.length, input.endLine ?? lines.length)
  const start = Math.max(0, input.startLine ?? 0)
  return lines.slice(start, Math.max(start, end)).join("\n")
}

const [, , socketPath, fleetPath] = process.argv
if (socketPath === undefined || fleetPath === undefined) {
  console.error("usage: fake-padi.ts <socket-path> <fleet.json>")
  process.exit(2)
}

const fleet = JSON.parse(readFileSync(fleetPath, "utf8")) as Fleet
const surfaceVersion = fleet.surfaceVersion ?? PADI_SURFACE_VERSION

const control = implementSurface(padiControlSibling, {
  cells: {
    version: { store: inMemoryStore({ controlCoreVersion: CONTROL_CORE_VERSION }) },
  },
  procedures: {
    core: {
      hello: () =>
        Effect.succeed({
          stateRoot: "/tmp/fake-padi",
          surfaceVersion,
          controlCoreVersion: CONTROL_CORE_VERSION,
          startedAt: 1_700_000_000_000,
        }),
      drain: () => Effect.void,
      controlVersion: () => Effect.succeed({ controlCoreVersion: CONTROL_CORE_VERSION }),
      clockNow: () => Effect.succeed({ epochMs: 1_700_000_000_000 }),
    },
  },
})

const spec = padiSurfaceSibling.spec as {
  cells?: Record<string, { default: unknown }>
  collections?: Record<string, unknown>
  streams?: Record<string, unknown>
  events?: Record<string, unknown>
  procedures?: Record<string, Record<string, unknown>>
}

const floor = <T,>(keys: Iterable<string>, one: (key: string) => T): Record<string, T> =>
  Object.fromEntries([...keys].map((key) => [key, one(key)]))

const unservedStream = () => Stream.never

const refusingProcedure = () => Effect.fail(new Error("this fake padi does not serve that verb"))

const EMPTY_URGENCY = {
  awaitingIds: [],
  finishedIds: [],
  workingIds: [],
  lingerIds: [],
}

const padi = implementSurface(padiSurfaceSibling, {
  cells: {
    ...floor(Object.keys(spec.cells ?? {}), (key) => ({
      store: inMemoryStore(spec.cells?.[key]?.default),
    })),
    urgency: { store: inMemoryStore(fleet.urgency ?? EMPTY_URGENCY) },
  },
  collections: {
    ...floor(Object.keys(spec.collections ?? {}), () => ({
      readAll: () => new Map(),
      upsert: () => {},
      remove: () => {},
    })),
    terminals: {
      readAll: () => new Map(Object.entries(fleet.terminals)),
      upsert: () => {},
      remove: () => {},
    },
  },
  streams: {
    ...floor(Object.keys(spec.streams ?? {}), () => ({ source: unservedStream })),
    watchStates: { source: (input: WatchInput) => watchStates(input) },
    terminalAttach: {
      source: ({ id }: { readonly id: string }) => {
        const screen = fleet.screens[id]
        if (screen === undefined) return Stream.fail(new TerminalNotFound({ id }))
        return Stream.concat(
          Stream.make({
            kind: "snapshot" as const,
            data: screen,
            topLine: 0,
            grid: { cols: 100, rows: 30 },
          }),
          Stream.never,
        )
      },
    },
  },
  events: floor(Object.keys(spec.events ?? {}), () => ({ source: unservedStream })),
  procedures: {
    ...floor(
      Object.keys(spec.procedures ?? {}),
      (group) => floor(Object.keys(spec.procedures?.[group] ?? {}), () => refusingProcedure),
    ),
    screen: {
      state: () => Effect.fail(new TerminalNotFound({ id: "" })),
      history: () => Effect.fail(new TerminalNotFound({ id: "" })),
      image: () => Effect.fail(new TerminalNotFound({ id: "" })),
      text: ({ input }: { input: ScreenTextInput }) => {
        const screen = fleet.screens[input.id]
        if (screen === undefined) return Effect.fail(new TerminalNotFound({ id: input.id }))
        return Effect.succeed(windowOf(screen, input))
      },
    },
  },
} as never)

const listener = await serveOverUnixSocket({
  socketPath,
  group: padiDaemonGroup,
  handlers: { ...control.handlers, ...padi.handlers },
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as never,
})

if (listener.outcome.kind !== "listening") {
  console.error(`fake-padi: could not bind ${socketPath}: ${JSON.stringify(listener.outcome)}`)
  process.exit(1)
}

process.stdout.write("listening\n")

const stop = (): void => {
  listener.close()
  void control.close()
  void padi.close()
  process.exit(0)
}
process.on("SIGTERM", stop)
process.on("SIGINT", stop)
