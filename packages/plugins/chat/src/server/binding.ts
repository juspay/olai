import { itemKey, itemOf, matterWith, type OpFailure, opensValue, sessionValue, UsageFailure } from "@olai/format"
import { Effect } from "effect"

import type { Conversing } from "../sessions.ts"
import type { Chat } from "../scoped.ts"

export interface Binding {
  readonly boundAt: (
    item: string,
  ) => { readonly engine: string; readonly session: string | null; readonly title: string } | null
  readonly key: () => string
  readonly opensKey: () => string
  readonly exclusive: <A>(work: Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  readonly changed?: Effect.Effect<void, OpFailure>
  readonly write: (node: string, value: string) => Effect.Effect<void, OpFailure>
  readonly remove: (node: string) => Effect.Effect<void, OpFailure>
  readonly mark: (node: string, value: string) => Effect.Effect<void, OpFailure>
  readonly text: (path: string) => Effect.Effect<string | null, OpFailure>
  readonly doc: (path: string, text: string, was: string) => Effect.Effect<void, OpFailure>
}

export const NO_SLEEP_ON_A_NOTE =
  "a note's chat keeps its memory in the note itself, so olai never tidies it or puts it to sleep"

const tied = (
  binding: Binding,
  item: string,
  value: string | null,
): Effect.Effect<void, OpFailure> => {
  const at = itemOf(item)
  if (at.kind === "node") return value === null ? binding.remove(at.id) : binding.write(at.id, value)
  return matterWritten(
    binding,
    at.path,
    value === null
      ? [[binding.key(), null], [binding.opensKey(), null]]
      : [[binding.key(), value]],
  )
}

export const matterWritten = (
  binding: Pick<Binding, "text" | "doc">,
  path: string,
  changes: ReadonlyArray<readonly [key: string, value: string | null]>,
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const was = yield* binding.text(path)
    if (was === null) {
      return yield* new UsageFailure({ reason: `olai no longer holds \`${path}\`` })
    }
    const next = matterWith(was, changes)
    if (next === was) return
    const wrote = yield* Effect.result(binding.doc(path, next, was))
    if (wrote._tag === "Success") return
    const now = yield* binding.text(path)
    if (now === null || now === was) return yield* wrote.failure
    const again = matterWith(now, changes)
    if (again === now) return
    yield* binding.doc(path, again, now)
  })

const namedItem = (item: string): string => {
  const at = itemOf(item)
  return at.kind === "note" ? at.path : at.id
}

export const closeAgent = (
  binding: Binding,
  input: { readonly node: string },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const at = binding.boundAt(input.node)
    if (at === null) {
      return yield* new UsageFailure({ reason: `no chat is tied to \`${namedItem(input.node)}\` to close` })
    }
    yield* tied(binding, input.node, null)
  })

export const retie = (
  binding: Binding,
  roster: {
    readonly seatable: (item: string) => boolean
    readonly claimedBy: (to: Conversing) => string | null
  },
  input: { readonly node: string; readonly agent: string; readonly session: string },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const named = namedItem(input.node)
    if (!roster.seatable(input.node)) {
      return yield* new UsageFailure({ reason: `olai no longer holds \`${named}\`, so there is nothing to tie this chat to` })
    }
    if (binding.boundAt(input.node) !== null) {
      return yield* new UsageFailure({ reason: `\`${named}\` already names a chat` })
    }
    const owner = roster.claimedBy({ agent: input.agent, session: input.session })
    if (owner !== null && owner !== input.node) {
      return yield* new UsageFailure({ reason: `that conversation already belongs to \`${owner}\`` })
    }
    yield* tied(binding, input.node, sessionValue(input.agent, input.session))
  })

export const setSleeping = (
  binding: Binding,
  input: { readonly node: string; readonly on: boolean },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    if (itemOf(input.node).kind === "note") {
      return yield* new UsageFailure({ reason: NO_SLEEP_ON_A_NOTE })
    }
    if (binding.boundAt(input.node) === null) {
      return yield* new UsageFailure({ reason: `no node agent is bound to this node to mark` })
    }
    yield* binding.mark(input.node, input.on ? "on" : "")
  })

export const setOpens = (
  binding: Binding,
  input: { readonly path: string; readonly beside: boolean },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const item = itemKey({ kind: "note", path: input.path })
    if (binding.boundAt(item) === null) {
      return yield* new UsageFailure({ reason: `no chat is tied to \`${input.path}\` to place` })
    }
    yield* matterWritten(binding, input.path, [[binding.opensKey(), opensValue(input.beside)]])
  })

export const startAgentSession = (
  chat: Chat,
  binding: Binding,
  input: { readonly node: string; readonly agent: string },
): Effect.Effect<Conversing | null, OpFailure> =>
  Effect.gen(function*() {
    const was = yield* binding.exclusive(Effect.sync(() => binding.boundAt(input.node)))
    let expected = was
    const unchanged = () => {
      const at = binding.boundAt(input.node)
      return at?.engine === expected?.engine && at?.session === expected?.session
    }
    const now = yield* chat.startAgentSession(input.node, input.agent, now => Effect.gen(function*() {
      yield* binding.exclusive(Effect.gen(function*() {
        if (!unchanged()) return yield* new UsageFailure({ reason: "the node's binding changed while this chat was opening" })
        yield* tied(binding, input.node, sessionValue(now.agent, now.session))
        if (was?.session != null && (was.engine !== now.agent || was.session !== now.session)) {
          yield* chat.replaced({ agent: was.engine, session: was.session }, now)
        }
      }))
      if (binding.changed !== undefined) yield* binding.changed
    }))
    if (now === null && was === null) yield* binding.exclusive(Effect.gen(function*() {
      if (!unchanged()) return yield* new UsageFailure({ reason: "the node's binding changed while this chat was opening" })
      yield* tied(binding, input.node, sessionValue(input.agent, null))
      expected = { engine: input.agent, session: null, title: "" }
    }))
    return now
  })
