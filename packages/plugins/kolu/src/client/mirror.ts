import { isResizedFrame, isSnapshotFrame } from "@kolu/padi-client/attach"
import { type TerminalMetadata, tileTerminalOf } from "@kolu/padi-client/surface"
import { gridsEqual, type TerminalGrid } from "@kolu/terminal-vocab/schema"
import type { FleetOwner, FleetTerminal, KoluLink, Snapshot, TerminalFrame } from "./wire/index.ts"
import { KOLU_UNDIALED, resolveTerminal, SnapshotRefused, UNOWNED } from "./wire/index.ts"
import { Effect, Queue, Stream } from "effect"

import {
  EMPTY_FRAME,
  emptyByClass,
  frameByClass,
  frameClassOf,
  type HostAttentionFrame,
  type TerminalAttention,
} from "@kolu/padi-client/attention"

import { type Claimant, claimsIn, rowOf } from "./fleet.ts"
import { type Dial, type PadiAttachFrame, type PadiSurfaceClient, runLink, type Sink } from "./link.ts"
import { screenText } from "./screen.ts"

export interface MirrorSink {
  readonly link: (state: KoluLink) => void
  readonly upsert: (id: string, row: FleetTerminal) => void
  readonly remove: (id: string) => void
  readonly face: (padi: PadiSurfaceClient | null) => void
  readonly clearedRow: (id: string) => void
  readonly say: (line: string) => void
}

export interface Mirror {
  readonly run: Effect.Effect<never>
  readonly reclaim: (nodes: Iterable<Claimant>) => void
  readonly rows: () => Map<string, FleetTerminal>
  readonly screen: (
    terminal: string,
    lines: number | undefined,
    now: () => string,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
  readonly dials: () => number
}

export interface MirrorOptions {
  readonly env: Record<string, string | undefined>
  readonly now: () => string
  readonly dial?: Dial
}

export const makeMirror = (sink: MirrorSink, options: MirrorOptions): Mirror => {
  const records = new Map<string, TerminalMetadata>()
  const rows = new Map<string, FleetTerminal>()
  let claims: ReadonlyMap<string, FleetOwner> = new Map()
  let claimants: ReadonlyArray<Claimant> = []
  let padiFace: PadiSurfaceClient | null = null
  const watchers = new Map<string, Set<(now: TerminalGrid | undefined) => void>>()

  const watchGrid = (
    id: string,
    asked: TerminalGrid | undefined,
    onMoved: () => void,
  ): (() => void) => {
    const fire = (now: TerminalGrid | undefined): void => {
      if (now === undefined) return
      if (asked !== undefined && gridsEqual(asked, now)) return
      onMoved()
    }
    const set = watchers.get(id) ?? new Set()
    set.add(fire)
    watchers.set(id, set)
    return () => {
      set.delete(fire)
      if (set.size === 0) watchers.delete(id)
    }
  }
  const gridOf = (record: TerminalMetadata): TerminalGrid | undefined =>
    "grid" in record ? record.grid : undefined

  const gridMoved = (
    before: TerminalGrid | undefined,
    after: TerminalGrid | undefined,
  ): boolean =>
    before !== undefined && after !== undefined && !gridsEqual(before, after)

  let dials = 0
  let frame: HostAttentionFrame = EMPTY_FRAME

  const attentionOf = (id: string): TerminalAttention => ({
    klass: frameClassOf(frame, id as never),
    live: frame.liveIds.includes(id as never),
  })

  const refeed = (next: HostAttentionFrame): void => {
    const before = frame
    frame = next
    for (const id of rows.keys()) {
      const was = { klass: frameClassOf(before, id as never), live: before.liveIds.includes(id as never) }
      const now = attentionOf(id)
      if (was.klass !== now.klass || was.live !== now.live) republish(id)
    }
  }


  const republish = (id: string): void => {
    const record = records.get(id)
    if (record === undefined) return
    const row = rowOf(id, record, claims.get(id) ?? UNOWNED, attentionOf(id))
    rows.set(id, row)
    sink.upsert(id, row)
  }


  const rejoin = (): void => {
    const next = claimsIn(claimants, records.keys())
    const moved: string[] = []
    for (const id of rows.keys()) {
      const before = claims.get(id)
      const after = next.get(id)
      if (before?.kind !== after?.kind) {
        moved.push(id)
        continue
      }
      if (before?.kind === "node" && after?.kind === "node" && before.id !== after.id) {
        moved.push(id)
      }
    }
    claims = next
    for (const id of moved) republish(id)
  }

  const linkSink: Sink = {
    link: sink.link,
    say: sink.say,
    face: (next) => {
      padiFace = next
      sink.face(next)
    },
    dialed: () => {
      dials += 1
    },
    upsert: (id, record) => {
      const tile = tileTerminalOf(record)
      if (tile === undefined) {
        if (!records.delete(id)) return
        rows.delete(id)
        sink.remove(id)
        rejoin()
        return
      }
      const born = !records.has(id)
      const before = records.get(id)
      const gridBefore = before === undefined ? undefined : gridOf(before)
      records.set(id, tile)
      if (born) rejoin()
      republish(id)
      if (gridMoved(gridBefore, gridOf(tile))) {
        for (const moved of watchers.get(id) ?? []) moved(gridOf(tile))
      }
    },
    remove: (id) => {
      records.delete(id)
      rows.delete(id)
      sink.remove(id)
      rejoin()
    },
    urgency: (value) => {
      refeed({ byClass: frameByClass(value), liveIds: frame.liveIds })
    },
    live: (ids) => {
      refeed({ byClass: frame.byClass, liveIds: [...ids] as never })
    },
    cleared: () => {
      for (const id of [...rows.keys()]) {
        rows.delete(id)
        sink.clearedRow(id)
      }
      records.clear()
      padiFace = null
      frame = { byClass: emptyByClass(), liveIds: [] }
    },
  }

  return {
    run: runLink(linkSink, options.env, options.now, options.dial),
    reclaim: (nodes) => {
      claimants = [...nodes]
      rejoin()
    },
    rows: () => rows,
    screen: (terminal, lines, now) => {
      if (padiFace === null) return screenText(null, terminal, lines, now)
      const found = resolveTerminal(terminal, records.keys())
      if (found.kind === "many") {
        return Effect.fail(
          new SnapshotRefused({
            reason: "ambiguous",
            says:
              `this names ${found.count} terminals — write more of the id to say which one to read.`,
          }),
        )
      }
      if (found.kind === "none") {
        return Effect.fail(
          new SnapshotRefused({
            reason: "no-terminal",
            says:
              "padi has no terminal by that name — it has been closed, or the property names something else.",
          }),
        )
      }
      return screenText(padiFace.surface.screen.text, found.id, lines, now)
    },
    attach: (terminal, grid) => {
      if (padiFace === null) {
        return refused("olai is not connected to a padi, so there is no terminal to watch.")
      }
      const found = resolveTerminal(terminal, records.keys())
      if (found.kind === "many") {
        return refused(
          `this names ${found.count} terminals — write more of the id to say which one to watch.`,
        )
      }
      if (found.kind === "none") {
        return refused(
          "padi has no terminal by that name — it has been closed, or the property names something else.",
        )
      }
      const face = padiFace.surface.terminalAttach.get
      const id = found.id
      const epochs = Stream.concat(
        Stream.make(0),
        Stream.callback<number>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              let epoch = 0
              const moved = (): void => {
                epoch += 1
                Queue.offerUnsafe(queue, epoch)
              }
              return watchGrid(id, grid, moved)
            }),
            (unwatch) => Effect.sync(unwatch),
          )
        ),
      )
      return Stream.switchMap(epochs, (epoch) =>
        Stream.map(
          face(epoch === 0 && grid !== undefined ? { id, resizeTo: grid } : { id }).pipe(
            Stream.filter((frame): frame is PaintedFrame => !isResizedFrame(frame)),
          ),
          (frame) => frameOf(frame),
        )
      ).pipe(
        Stream.catchCause(() =>
          refused(
            "olai lost the window on this terminal — it may have closed, or the link dropped.",
          )
        ),
      )
    },
    dials: () => dials,
  }
}

export const UNDIALED: KoluLink = KOLU_UNDIALED

export type PaintedFrame = Exclude<PadiAttachFrame, { readonly kind: "resized" }>

export const frameOf = (frame: PaintedFrame): TerminalFrame =>
  isSnapshotFrame(frame)
    ? {
        kind: "snapshot",
        data: frame.data,
        topLine: frame.topLine,
        grid: frame.grid,
      }
    : { kind: "delta", data: frame.data }

const refused = (says: string): Stream.Stream<TerminalFrame> =>
  Stream.make({ kind: "refused", says } as TerminalFrame)
