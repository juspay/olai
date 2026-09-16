/** Browser-owned opaque picks, persisted before publication and capped at 32.
 * Each replacement revokes the old recipient, including a same-value repick. */

import { Effect, Schema, Semaphore } from "effect"

import type { ChatLocalState } from "./local.ts"
import { MemoryFailure, word } from "./memory.ts"

const WAKE = "wake"

export const ROWS = 32

export interface Scoped {
  readonly agent: string
  readonly session: string

  readonly plugin: string

  readonly pick: (typeof Schema.Json)["Type"]

}

export interface Scopes {

  readonly rows: () => ReadonlyArray<Scoped>

  readonly recipient: (row: Scoped) => Pick<Scoped, "agent" | "session" | "pick"> & {
    readonly current: () => boolean
  }

  readonly set: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    pick: (typeof Schema.Json)["Type"],
  ) => Effect.Effect<ReadonlyArray<Scoped>, MemoryFailure>

}

interface Written {
  readonly scopes?: unknown
}

const picks = (held: Record<string, unknown>): ReadonlyArray<Scoped> => {
  const written = (held as Written).scopes
  if (!Array.isArray(written)) return []
  const rows: Array<Scoped> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const agent = word(one["agent"])
    const session = word(one["session"])
    const plugin = word(one["plugin"])
    const pick = one["pick"] ?? one["file"]
    if (agent === null || session === null || plugin === null || !Schema.is(Schema.Json)(pick) || pick === null) continue

    rows.push({ agent, session, plugin, pick })
  }
  return rows
}

const capped = (rows: ReadonlyArray<Scoped>): ReadonlyArray<Scoped> =>
  rows.length <= ROWS ? rows : rows.slice(rows.length - ROWS)

export const forLocalState = (local: ChatLocalState): Effect.Effect<Scopes> =>
  Effect.gen(function*() {
    const writing = yield* Semaphore.make(1)

    const read = local.load(WAKE)
    let rows: ReadonlyArray<Scoped> = []
    if (read !== null) rows = picks(read)

    return {
      rows: () => rows,
      recipient: (row) => {
        const picked = row
        return {
          agent: row.agent, session: row.session, pick: row.pick,
          current: () => rows.some((now) => now === picked),
        }
      },
      set: (to, plugin, pick) =>
        writing.withPermit(Effect.gen(function*() {

          const before = rows
          const without = before.filter((row) =>
            !(row.agent === to.agent && row.session === to.session && row.plugin === plugin)
          )

          const next = pick === null
            ? without
            : capped([...without, { agent: to.agent, session: to.session, plugin, pick }])

          yield* local.save(WAKE, { scopes: next })
          rows = next

          return before.filter((row) => !next.includes(row))
        })),

    }
  })
