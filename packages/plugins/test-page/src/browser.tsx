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
  narrowable: true,
})

function FixturePage(props: {
  readonly value: { readonly word: string }
  readonly filter: string
  readonly narrow: (filter: string) => void
}) {
  return (
    <section aria-label="Fixture page" data-word={props.value.word} class="p-8">
      <h1 class="text-xl">Fixture page</h1>
      <p>Word: <output aria-label="Fixture word">{props.value.word}</output></p>
      <input aria-label="Fixture filter" class="border px-2" value={props.filter}
        onInput={(event) => props.narrow(event.currentTarget.value)} />
      <p>Narrowed by: <output aria-label="Fixture narrowing">{props.filter}</output></p>
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
