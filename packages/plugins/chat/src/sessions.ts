import { Effect, Semaphore } from "effect"

import { type ChatLocalState, word } from "./local.ts"
import { MemoryFailure } from "@kolu/acp-client"
import { ROWS } from "./scopes.ts"

const HEARD = "heard"

export interface Conversing {
  readonly agent: string
  readonly session: string
}

export interface Said {
  readonly text: string
  readonly at: string
}

export interface Overheard extends Conversing {
  readonly taught?: boolean
  readonly taken?: number
  readonly superseded?: Conversing
  readonly said?: Said
  readonly seen?: string
}

export interface Sessions {
  readonly rows: () => ReadonlyArray<Overheard>
  readonly at: (to: Conversing) => Overheard | undefined
  readonly took: (to: Conversing, taught: boolean) => Effect.Effect<void, MemoryFailure>
  readonly supersede: (to: Conversing, by: Conversing) => Effect.Effect<void, MemoryFailure>
  readonly said: (
    to: Conversing,
    said: Said,
  ) => Effect.Effect<void, MemoryFailure>
  readonly seen: (to: Conversing, at: string) => Effect.Effect<void, MemoryFailure>
}

interface Written {
  readonly heard?: unknown
}

const read = (held: Record<string, unknown>): ReadonlyArray<Overheard> => {
  const written = (held as Written).heard
  if (!Array.isArray(written)) return []
  const rows: Array<Overheard> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const agent = word(one["agent"])
    const session = word(one["session"])
    if (agent === null || session === null) continue
    const seen = word(one["seen"])
    const taken = one["taken"]
    rows.push({
      agent,
      session,
      ...(one["taught"] === true ? { taught: true } : {}),
      ...(typeof taken === "number" && Number.isSafeInteger(taken) && taken > 0 ? { taken } : {}),
      ...supersededIn(one["superseded"], agent),
      ...saidIn(one["said"]),
      ...(seen === null ? {} : { seen }),
    })
  }
  return rows
}

const saidIn = (value: unknown): { readonly said?: Said } => {
  if (typeof value !== "object" || value === null) return {}
  const one = value as Record<string, unknown>
  const text = word(one["text"])
  const at = word(one["at"])
  return text === null || at === null ? {} : { said: { text, at } }
}

const supersededIn = (value: unknown, agent: string): { readonly superseded?: Conversing } => {
  if (typeof value === "string") {
    const by = word(value)
    return by === null ? {} : { superseded: { agent, session: by } }
  }
  if (typeof value !== "object" || value === null) return {}
  const one = value as Record<string, unknown>
  const byAgent = word(one["agent"])
  const bySession = word(one["session"])
  return byAgent === null || bySession === null ? {} : { superseded: { agent: byAgent, session: bySession } }
}

const sameChat = (row: Conversing, to: Conversing): boolean =>
  row.agent === to.agent && row.session === to.session

const capped = (rows: ReadonlyArray<Overheard>): ReadonlyArray<Overheard> =>
  rows.length <= ROWS ? rows : rows.slice(rows.length - ROWS)

export const forLocalState = (local: ChatLocalState): Effect.Effect<Sessions> =>
  Effect.gen(function*() {
    const writing = yield* Semaphore.make(1)

    const held = local.load(HEARD)
    let rows: ReadonlyArray<Overheard> = []
    if (held !== null) rows = read(held)

    /** THE RECORD FIRST: the mirror moves only once the write has landed. */
    const write = (
      to: Conversing,
      change: (row: Overheard | undefined) => Overheard | undefined,
    ): Effect.Effect<void, MemoryFailure> =>
      writing.withPermit(Effect.gen(function*() {
        const before = rows
        const next = change(before.find((row) => sameChat(row, to)))
        if (next === undefined) return
        const table = capped([
          ...before.filter((row) => !sameChat(row, to)),
          next,
        ])
        yield* local.save(HEARD, { heard: table })
        rows = table
      }))

    return {
      rows: () => rows,
      at: (to) => rows.find((row) => sameChat(row, to)),
      took: (to, taught) =>
        write(to, (row) => ({
          ...row,
          ...to,
          ...(taught ? { taught: true } : {}),
          taken: (row?.taken ?? 0) + 1,
        })),
      supersede: (to, by) =>
        write(
          to,
          (row) =>
            row?.superseded?.agent === by.agent && row?.superseded?.session === by.session
              ? undefined
              : { ...row, ...to, superseded: by },
        ),
      said: (to, said) =>
        write(to, (row) => (row?.said?.text === said.text ? undefined : { ...row, ...to, said })),
      seen: (to, at) =>
        write(to, (row) =>
          // THE LATER MARK WINS: an acknowledgement must never move backwards.
          row?.seen !== undefined && row.seen >= at ? undefined : { ...row, ...to, seen: at }),
    }
  })
