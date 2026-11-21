import { definePlugin, Kinds, Ops, Surfaces } from "@olai/plugin-api"
import { Effect } from "effect"

import { scheduled } from "./lib/sm2.ts"
import { splitPair } from "./pairs.ts"
import type { Card, Grade } from "./types.ts"
import { faces, surface } from "./words.ts"

const VOCABULARY = "vocabulary.olai"

// Today, the way the vocabulary writes dates, by the server's clock.
const today = (): string => new Date().toISOString().slice(0, 10)

// A word's card, read off the properties of its row.
const cardOf = (word: string, custom: Readonly<Record<string, unknown>>): Card => ({
  word,
  due: typeof custom["reader-due"] === "string" ? custom["reader-due"] : today(),
  interval: Number(custom["reader-interval"] ?? 0),
  ease: Number(custom["reader-ease"] ?? 2.5),
})

export default definePlugin({
  name: "reader",
  needs: [Kinds, Ops, Surfaces],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({
      kind: "pair",
      takes: "`reader-pair`: a French sentence, ` | `, and its English",
      admits: (value: string) => splitPair(value) !== null,
    })

    // The write gate: every write below goes through it, exactly as a
    // keystroke's does, and lands in the ledger beside it.
    const gate = (yield* Ops).gate
    yield* (yield* Surfaces).register({
      surface,
      faces,
      deps: {
        procedures: {
          words: {
            // A clicked word becomes a row of the vocabulary, due today.
            add: ({ input }: { readonly input: { readonly word: string } }) =>
              gate.run({
                op: "add",
                parent: "vocabulary",
                title: input.word,
                props: { "reader-due": today(), "reader-interval": "0", "reader-ease": "2.5" },
              }, "web").pipe(Effect.as({}), Effect.orDie),
            // The word that has been due longest, or nothing.
            next: () =>
              Effect.gen(function*() {
                const reading = yield* Effect.orDie(gate.read)
                const due = reading.derived.nodes.flatMap((at) => {
                  const custom: Readonly<Record<string, unknown>> = "custom" in at.node ? at.node.custom ?? {} : {}
                  const when = custom["reader-due"]
                  return at.file === VOCABULARY && typeof when === "string" && when <= today()
                    ? [{ node: at.node.id, word: "title" in at.node ? at.node.title : "", when }]
                    : []
                })
                const first = due.sort((a, b) => a.when.localeCompare(b.when))[0]
                return first === undefined ? null : { node: first.node, word: first.word }
              }),
            // Again, Good or Easy: the next due date, written on the word's row.
            grade: ({ input }: { readonly input: { readonly node: string; readonly grade: Grade } }) =>
              Effect.gen(function*() {
                const reading = yield* Effect.orDie(gate.read)
                const at = reading.derived.byId.get(input.node)
                const custom: Readonly<Record<string, unknown>> = at !== undefined && "custom" in at.node ? at.node.custom ?? {} : {}
                const title = at !== undefined && "title" in at.node ? at.node.title : ""
                const next = scheduled(cardOf(title, custom), input.grade, today())
                yield* Effect.orDie(gate.run({
                  op: "apply",
                  ops: [
                    { op: "prop", id: input.node, key: "reader-due", value: next.due },
                    { op: "prop", id: input.node, key: "reader-interval", value: String(next.interval) },
                    { op: "prop", id: input.node, key: "reader-ease", value: String(next.ease) },
                  ],
                }, "web"))
                return { due: next.due }
              }),
          },
        },
      },
    })
  }),
})
