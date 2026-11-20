import { SAYING_MS, sayingEnd, sayingKey } from "olai-plugin-chat/wire"
import type { ChatEntry } from "olai-plugin-chat/wire"
import type { Saying } from "@kolu/acp/wire"
import { type Change, movesRows } from "@kolu/acp-harness"

export interface Pieces {
  readonly upserts: ReadonlyArray<readonly [string, Saying]>
  readonly removes: ReadonlyArray<string>
}

export interface Rows {
  readonly upserts: ReadonlyArray<readonly [string, ChatEntry]>
  readonly removes: ReadonlyArray<string>
}

export interface Frame {
  readonly rows: Rows
  readonly pieces: Pieces
}

const NOTHING = { upserts: [], removes: [] } as const

export type After = (millis: number, run: () => void) => () => void

const afterReally: After = (millis, run) => {
  const timer = setTimeout(run, millis)
  ;(timer as { unref?: () => void }).unref?.()
  return () => clearTimeout(timer)
}

interface OpenWindow {
  readonly piece: Saying
  readonly close: () => void
}

export interface Cadence {
  readonly publish: (change: Change<ChatEntry>) => void
  readonly onWire: () => ReadonlyMap<string, Saying>
  readonly stop: () => void
}

export const cadence = (options: {
  readonly onFrame: (frame: Frame) => void
  readonly window?: number
  readonly after?: After
}): Cadence => {
  const window = options.window ?? SAYING_MS
  const after = options.after ?? afterReally
  const live = new Map<string, Saying>()
  let waiting: OpenWindow | null = null

  const drop = (): void => {
    waiting?.close()
    waiting = null
  }

  const sent = (piece: Saying): readonly [string, Saying] => {
    const key = sayingKey(piece)
    live.set(key, piece)
    return [key, piece]
  }

  const hold = (piece: Saying): void => {
    waiting = {
      piece,
      close: waiting?.close ?? after(window, () => {
        const held = waiting
        waiting = null
        if (held === null) return
        options.onFrame({ rows: NOTHING, pieces: { upserts: [sent(held.piece)], removes: [] } })
      }),
    }
  }

  const publish = (change: Change<ChatEntry>): void => {
    const moved = movesRows(change)
    const upserts: Array<readonly [string, Saying]> = []
    for (const piece of change.appends) {
      const held = waiting?.piece
      if (held !== undefined && held.of === piece.of && sayingEnd(held) === piece.at) {
        hold({ ...held, text: `${held.text}${piece.text}` })
        continue
      }
      if (held !== undefined) upserts.push(sent(held))
      hold(piece)
    }

    const removes: Array<string> = []
    if (moved) {
      const rows = new Set<string>([
        ...change.upserts.map((row) => row.id),
        ...change.removes,
      ])
      if (waiting !== null && rows.has(waiting.piece.of)) drop()
      for (const [key, piece] of live) {
        if (!rows.has(piece.of)) continue
        live.delete(key)
        removes.push(key)
      }
    }

    const pieces = upserts.length > 0 || removes.length > 0
    if (!moved && !pieces) return
    options.onFrame({
      rows: moved
        ? { upserts: change.upserts.map((row) => [row.id, row] as const), removes: change.removes }
        : NOTHING,
      pieces: pieces ? { upserts, removes } : NOTHING,
    })
  }

  return { publish, onWire: () => live, stop: drop }
}
