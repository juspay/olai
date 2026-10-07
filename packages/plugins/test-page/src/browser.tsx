/** Maintained self-drawn-page fixture, disabled in every normal bundle. It
 * registers one `app.route` page of the SELF-DRAWN kind — a plain component
 * over its route's own value, mounted by navigation — and one palette row that
 * goes to it. Nothing here names a document-format page type, a page reading
 * or outlines: what this proves is that a plugin page needs none of them.
 *
 * `/fixture/<word>` is the page for one lowercase word. It links to its
 * neighbours with real anchors, so navigation's own link listener answers a
 * plain click, Alt and Alt-Shift on them as it does any link. */
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { defineSelfDrawnPage, defineSelfDrawnRoute } from "olai-plugin-navigation/routes"
import { For } from "solid-js"
import { name } from "./index.ts"

const WORDS = ["alpha", "beta", "gamma"] as const

const fixture = defineSelfDrawnRoute<{ readonly word: string }>({
  claims: [{ kind: "prefix", path: "/fixture/" }],
  parse: (pathname) => {
    let word: string
    try { word = decodeURIComponent(pathname.slice("/fixture/".length)) } catch { return null }
    return /^[a-z]+$/.test(word) ? { word } : null
  },
  href: ({ word }) => `/fixture/${encodeURIComponent(word)}`,
  breadcrumb: ({ word }) => `Fixture ${word}`,
  narrowable: false,
})

function FixturePage(props: { readonly value: { readonly word: string }; readonly filter: string }) {
  return (
    <section aria-label="Fixture page" data-word={props.value.word} class="p-8">
      <h1 class="text-xl">Fixture page</h1>
      <p>Word: <output aria-label="Fixture word">{props.value.word}</output></p>
      <nav aria-label="Fixture links" class="flex gap-3">
        <For each={WORDS.filter(word => word !== props.value.word)}>
          {(word) => <a href={fixture.href({ word })} class="underline">{`Fixture ${word}`}</a>}
        </For>
      </nav>
    </section>
  )
}

export default definePlugin({ name, needs: [Slots], apply: Effect.gen(function*() {
  const slots = yield* Slots
  yield* slots.register("app.route", defineSelfDrawnPage(fixture, FixturePage))
  yield* slots.register("app.palette", {
    id: "test-page-alpha",
    label: "Go to fixture alpha",
    hint: "A self-drawn page",
    search: "go to fixture alpha self drawn page",
    href: fixture.href({ word: "alpha" }),
  })
}) })
