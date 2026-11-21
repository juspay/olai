import { clientOf, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal, onMount, Show } from "solid-js"

import { Columns } from "./columns.tsx"
import { splitPair } from "./pairs.ts"
import type { Grade } from "./types.ts"
import { surface } from "./words.ts"

// The tab dials this plugin's server file by the surface its browser file exports.
export { surface }

const BOOK = "/book.olai"
const VOCABULARY = "/vocabulary.olai"

// Opens an address the way a link on the page does: the app follows it in the
// pane you are reading in, with no reload.
const open = (address: string) => {
  const link = document.createElement("a")
  link.href = address
  document.body.append(link)
  link.click()
  link.remove()
}

const Section = () => (
  <nav data-reader="section" class="flex flex-col px-3 py-2 text-body">
    <span class="text-label text-muted">Reading</span>
    <a href={BOOK}>The book</a>
    <a href={VOCABULARY}>Vocabulary</a>
  </nav>
)

export default definePlugin({
  name: "reader",
  needs: [Slots, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const wired = yield* Wired
    // This plugin's own server file, by the surface both files share.
    const words = () => clientOf(surface, wired)?.procedures.words

    // A `reader-pair` property, drawn under its row as two columns.
    const Pair = (context: { readonly entry: { readonly value: string } }) => {
      const pair = splitPair(context.entry.value)
      const add = (word: string) => {
        const call = words()?.add({ word })
        if (call !== undefined) void Effect.runPromise(call)
      }
      return pair === null ? null : <Columns pair={pair} onWord={add} />
    }

    // At the foot of the vocabulary row's own page: the word due longest, and three buttons.
    const Review = (props: { readonly node: string }) => {
      const [card, setCard] = createSignal<{ readonly node: string; readonly word: string } | null>(null)
      const load = () => {
        const call = words()?.next({})
        if (call !== undefined) void Effect.runPromise(call).then(setCard)
      }
      const grade = (node: string, value: Grade) => {
        const call = words()?.grade({ node, grade: value })
        if (call !== undefined) void Effect.runPromise(call).then(load)
      }
      onMount(load)
      return (
        <Show when={props.node === "vocabulary" ? card() : null}>
          {(due) => (
            <div data-reader="review" data-word={due().word} class="flex items-center gap-2 py-2 text-body">
              <span class="font-medium">{due().word}</span>
              <button type="button" data-grade="again" onClick={() => grade(due().node, "again")}>Again</button>
              <button type="button" data-grade="good" onClick={() => grade(due().node, "good")}>Good</button>
              <button type="button" data-grade="easy" onClick={() => grade(due().node, "easy")}>Easy</button>
            </div>
          )}
        </Show>
      )
    }

    yield* slots.register("sidebar.section", { said: "Reading", body: Section })
    yield* slots.register("app.keys", {
      key: "y",
      shift: true,
      whileEditing: false,
      said: "Open your vocabulary",
      press: () => open(VOCABULARY),
    })
    yield* slots.register("app.palette", {
      id: "reader-book",
      label: "Open the book you are reading",
      search: "reader book french read",
      href: BOOK,
    })
    yield* slots.register("outline.row.block", "pair", Pair)
    yield* slots.register("outline.page.foot", Review)
  }),
})
