import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { Columns } from "./columns.tsx"
import { splitPair } from "./pairs.ts"

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

// A `reader-pair` property, drawn under its row as two columns.
const Pair = (context: { readonly entry: { readonly value: string } }) => {
  const pair = splitPair(context.entry.value)
  return pair === null ? null : <Columns pair={pair} />
}

export default definePlugin({
  name: "reader",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
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
  }),
})
