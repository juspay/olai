/** Confirmed model choices, keyed by engine and session. The store is owned
 * by chat's activation and uses its declared local-state door. Nothing here
 * selects or opens a conversation. Initialization is deferred until an open. */
import { Effect, Semaphore } from "effect"
import type { Conversing } from "./sessions.ts"
import { ROWS } from "./scopes.ts"
import { word } from "./memory.ts"
import type { ChatLocalState, MemoryFailure } from "./local.ts"

export interface Models {
  readonly read: (to: Conversing) => Effect.Effect<string | null, MemoryFailure>
  readonly write: (to: Conversing, model: string) => Effect.Effect<void, MemoryFailure>
}
interface Choice extends Conversing { readonly model: string }
const same = (a: Conversing, b: Conversing) => a.agent === b.agent && a.session === b.session
const capped = (rows: ReadonlyArray<Choice>) => rows.slice(-ROWS)

export const forLocalState = (local: ChatLocalState): Models => {
  const gate = Semaphore.makeUnsafe(1)
  let rows: ReadonlyArray<Choice> | undefined
  const save = (next: ReadonlyArray<Choice>) => Effect.gen(function*() {
    yield* local.save("models", { rows: capped(next) })
    rows = capped(next)
  })
  const initialize = Effect.gen(function*() {
    if (rows !== undefined) return
    const stored = local.load("models")
    const read: Choice[] = []
    for (const item of Array.isArray(stored?.rows) ? stored.rows : []) {
      if (item === null || typeof item !== "object") continue
      const agent = word(item.agent), session = word(item.session), model = word(item.model)
      if (agent !== null && session !== null && model !== null) {
        const old = read.findIndex(row => same(row, { agent, session }))
        if (old !== -1) read.splice(old, 1)
        read.push({ agent, session, model })
      }
    }
    rows = capped(read)
  })
  return {
    read: to => gate.withPermit(Effect.gen(function*() {
      yield* initialize
      const found = rows!.find(row => same(row, to))
      if (found === undefined) return null
      // Opening touches an existing choice; an unpinned conversation writes
      // no row, so the cap counts choices rather than every session visited.
      yield* save([...rows!.filter(row => !same(row, to)), found])
      return found.model
    })),
    write: (to, model) => gate.withPermit(Effect.gen(function*() {
      yield* initialize
      yield* save([...rows!.filter(row => !same(row, to)), { ...to, model }])
    })),
  }
}
