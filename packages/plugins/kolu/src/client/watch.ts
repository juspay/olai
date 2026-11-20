import { watchAgentStates } from "@kolu/padi-client/watch"
import type { PadiSurfaceClient } from "./link.ts"
import type { PadiStateEvent, PadiWatchStatesInput } from "@kolu/padi-client/surface"
import { narrowAgentState } from "@kolu/solid-dockrow/rowValues"
import { agentBucket, WATCH_DEFAULT_STATES } from "@kolu/terminal-vocab/agentProjection"

import type { FleetTerminal, KoluEvent } from "./wire/index.ts"

export interface WatchNag {
  readonly ms: number
  readonly count?: number
}

export interface WatchConfig {
  readonly heldForMs: number
  readonly nagMs: WatchNag
  readonly heartbeatMs: number
}

export const DEFAULT_WATCH: WatchConfig = {
  heldForMs: 60_000,
  nagMs: { ms: 600_000 },
  heartbeatMs: 1_800_000,
}

export const WATCH_RING = 200

export const WATCH_LANES = 2000

const cap = <K, V>(map: Map<K, V>, bound: number): void => {
  while (map.size > bound) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export interface WatchSink {
  readonly emit: (event: KoluEvent) => void
  readonly evict: (id: string) => void
  readonly beat: (receivedAt: string, everyMs: number) => void
}

export interface Watch {
  readonly attach: (client: PadiSurfaceClient | null) => void
  readonly observe: (id: string, row: FleetTerminal) => void
  readonly reconfigure: (config: WatchConfig) => void
  readonly events: () => Map<string, KoluEvent>
  readonly stop: () => void
}

const inputOf = (config: WatchConfig): PadiWatchStatesInput => ({
  heldForMs: config.heldForMs,
  nagMs: config.nagMs.ms,
  ...(config.nagMs.count === undefined ? {} : { nagCount: config.nagMs.count }),
})

const sameQuestion = (a: WatchConfig, b: WatchConfig): boolean =>
  a.heldForMs === b.heldForMs && a.nagMs.ms === b.nagMs.ms && a.nagMs.count === b.nagMs.count

const HELD_BUCKETS: ReadonlySet<string> = new Set(WATCH_DEFAULT_STATES)

export const heldStateOf = (row: FleetTerminal): HeldState | null => {
  const narrowed = narrowAgentState(row.agentState)
  if (narrowed.state === undefined) return null
  const bucket = agentBucket(narrowed.state)
  return HELD_BUCKETS.has(bucket) ? { bucket, spelled: narrowed.state } : null
}

export interface HeldState {
  readonly bucket: string
  readonly spelled: string
}

interface Run {
  readonly input: WatchConfig
  readonly controller: AbortController
}

export const makeWatch = (
  sink: WatchSink,
  options: {
    readonly now: () => number
    readonly say?: (line: string) => void
    readonly warn?: (line: string) => void
  },
): Watch => {
  let config: WatchConfig = DEFAULT_WATCH
  let client: PadiSurfaceClient | null = null
  let run: Run | null = null
  const rows = new Map<string, FleetTerminal>()
  const ring = new Map<string, KoluEvent>()
  const episodes = new Map<string, string>()
  let seq = 0

  const push = (event: KoluEvent): void => {
    if (event.row !== null) {
      episodes.set(event.row.terminal, event.row.since)
      cap(episodes, WATCH_LANES)
    }
    ring.set(event.id, event)
    sink.emit(event)
    while (ring.size > WATCH_RING) {
      const oldest = ring.keys().next().value
      if (oldest === undefined) break
      ring.delete(oldest)
      sink.evict(oldest)
    }
  }

  const translate = (ev: PadiStateEvent): KoluEvent => {
    const row = rows.get(ev.id)
    seq += 1
    return {
      id: `ev-${seq}`,
      kind: ev.kind === "nag" ? "nag" : "transition",
      at: new Date(ev.at).toISOString(),
      row: {
        terminal: ev.id,
        state: ev.state,
        agentState: row === undefined ? ev.state : (narrowAgentState(row.agentState).state ?? ev.state),
        pip: row === undefined
          ? {
            variant: "idle",
            glyph: "terminal",
            active: false,
            asking: ev.state === "awaiting",
            bytesLive: false,
            hasAgent: true,
            sleeping: false,
            alert: false,
            alertLabel: "",
          }
          : { ...row.pip, active: false, bytesLive: false },
        bucket: row?.bucket ?? ev.state,
        label: row?.label ?? ev.intent ?? "",
        labelColor: row?.labelColor ?? "",
        repo: row?.repo ?? null,
        since: new Date(ev.since).toISOString(),
      },
      ...(ev.kind === "nag" && ev.nag !== undefined ? { nag: ev.nag } : {}),
    }
  }

  const onBatch = (token: Run, batch: readonly PadiStateEvent[]): void => {
    if (run !== token) return
    for (const ev of batch) {
      if (ev.kind === "snapshot" && episodes.get(ev.id) === new Date(ev.since).toISOString()) continue
      push(translate(ev))
    }
    sink.beat(new Date(options.now()).toISOString(), config.heartbeatMs)
  }

  const kick = (): void => {
    if (run !== null) run.controller.abort()
    run = null
    if (client === null) return
    const next: Run = { input: config, controller: new AbortController() }
    run = next
    watchAgentStates(
      client,
      inputOf(config),
      (batch) => onBatch(next, batch),
      next.controller.signal,
      (line) => options.say?.(line),
    ).then(
      () => {},
      (err) => options.warn?.(`kolu watch: the subscription ended (${String(err)})`),
    )
  }

  return {
    attach: (face) => {
      client = face
      kick()
    },
    observe: (id, row) => {
      rows.set(id, row)
      cap(rows, WATCH_LANES)
    },
    reconfigure: (next) => {
      const moved = !sameQuestion(next, config)
      config = next
      if (moved) {
        episodes.clear()
        kick()
      }
    },
    events: () => ring,
    stop: () => {
      run?.controller.abort()
      run = null
    },
  }
}
