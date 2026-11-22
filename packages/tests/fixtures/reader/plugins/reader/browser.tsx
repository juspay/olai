import { clientOf, definePlugin, Navigate, type OpFailure, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"

import { Columns } from "./columns.tsx"
import { pairsIn, splitPair } from "./pairs.ts"
import type { Grade } from "./types.ts"
import { surface } from "./words.ts"

// The tab dials this plugin's server file by the surface its browser file exports.
export { surface }

const BOOK = "/book.olai"
const VOCABULARY = "/vocabulary.olai"
const REVIEW = "/plugins/reader/app/review"

const Section = () => (
  <nav data-reader="section" class="flex flex-col px-3 py-2 text-body">
    <span class="text-label text-muted">Reading</span>
    <a href={BOOK}>The book</a>
    <a href={VOCABULARY}>Vocabulary</a>
    <a href={REVIEW}>Review</a>
  </nav>
)

// What the gate said when it refused a write, where the write was asked for.
const Refused = (props: { readonly said: string | null }) => (
  <Show when={props.said}>{(said) => <p data-reader="refused" class="text-label text-alarm">{said()}</p>}</Show>
)

export default definePlugin({
  name: "reader",
  needs: [Navigate, Slots, Wired],
  apply: Effect.gen(function*() {
    const navigate = yield* Navigate
    const slots = yield* Slots
    const wired = yield* Wired
    // This plugin's own server file, by the surface both files share.
    const client = () => clientOf(surface, wired)?.procedures

    // Runs one call: `then` gets the answer, and a refusal's sentence goes to
    // `refused`, which a face draws beside what was pressed.
    const ask = <A,>(
      call: Effect.Effect<A, OpFailure> | undefined,
      then: (answer: A) => void,
      refused: (said: string | null) => void,
    ) => {
      if (call === undefined) return
      void Effect.runPromise(Effect.match(call, {
        onFailure: (failure) => refused(failure.message),
        onSuccess: (answer) => { refused(null); then(answer) },
      }))
    }

    // A `reader-pair` property, drawn under its row as two columns.
    const Pair = (context: { readonly entry: { readonly value: string } }) => {
      const pair = splitPair(context.entry.value)
      const [refused, setRefused] = createSignal<string | null>(null)
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return pair === null ? null : (
        <>
          <Columns pair={pair} onWord={add} />
          <Refused said={refused()} />
        </>
      )
    }

    // The word due longest, and three buttons.
    const Review = () => {
      const [card, setCard] = createSignal<{ readonly node: string; readonly word: string } | null>(null)
      const [refused, setRefused] = createSignal<string | null>(null)
      const load = () => ask(client()?.words.next({}), setCard, setRefused)
      const grade = (node: string, value: Grade) => ask(client()?.words.grade({ node, grade: value }), load, setRefused)
      onMount(load)
      return (
        <>
          <Show when={card()}>
            {(due) => (
              <div data-reader="review" data-word={due().word} class="flex items-center gap-2 py-2 text-body">
                <span class="font-medium">{due().word}</span>
                <button type="button" data-grade="again" onClick={() => grade(due().node, "again")}>Again</button>
                <button type="button" data-grade="good" onClick={() => grade(due().node, "good")}>Good</button>
                <button type="button" data-grade="easy" onClick={() => grade(due().node, "easy")}>Easy</button>
              </div>
            )}
          </Show>
          <Refused said={refused()} />
        </>
      )
    }

    // At the foot of the vocabulary row's own page, the review.
    const Foot = (props: { readonly node: string }) => (
      <Show when={props.node === "vocabulary"}><Review /></Show>
    )

    // The plugin's own page: `/plugins/reader/app`, and the review under it.
    const Own = (props: { readonly rest: string }) => (
      <section data-reader="app" data-rest={props.rest} class="flex flex-col gap-2 p-4 text-body">
        <h1 class="text-title">Reading</h1>
        <Show when={props.rest === "review"} fallback={<a href={REVIEW}>Start review</a>}>
          <Review />
        </Show>
      </section>
    )

    // A transcribed page, drawn whole: each line's French beside its English.
    // `revision` moves when the file does, and the text is read again; a read
    // still in flight for an older revision is called off, so it cannot land
    // after the newer one.
    const Transcribed = (props: { readonly file: string; readonly revision: number | undefined }) => {
      const [text, setText] = createSignal("")
      const [refused, setRefused] = createSignal<string | null>(null)
      createEffect(on(() => [props.file, props.revision], () => {
        const call = client()?.pages.read({ file: props.file })
        if (call === undefined) return
        const controller = new AbortController()
        onCleanup(() => controller.abort())
        void Effect.runPromise(Effect.match(call, {
          onFailure: (failure) => ({ refused: failure.message }),
          onSuccess: (read) => ({ text: read.text }),
        }), { signal: controller.signal }).then(
          (answer) => {
            if (controller.signal.aborted) return
            if ("text" in answer) { setRefused(null); setText(answer.text) } else setRefused(answer.refused)
          },
          // Called off: a newer revision is being read.
          () => {},
        )
      }))
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return (
        <section data-reader="file" data-file={props.file} class="flex flex-col p-4">
          <For each={pairsIn(text())}>{(pair) => <Columns pair={pair} onWord={add} />}</For>
          <Refused said={refused()} />
        </section>
      )
    }

    // A block in any Markdown note whose fence names `reader`: its lines, drawn
    // the same way. The block is handed its text exactly as written in the note.
    const Block = (props: { readonly text: string; readonly file: string }) => {
      const [refused, setRefused] = createSignal<string | null>(null)
      const add = (word: string) => ask(client()?.words.add({ word }), () => {}, setRefused)
      return (
        <section data-reader="block" data-file={props.file} class="flex flex-col py-2">
          <For each={pairsIn(props.text)}>{(pair) => <Columns pair={pair} onWord={add} />}</For>
          <Refused said={refused()} />
        </section>
      )
    }

    // Above every Markdown note's text: whose face this is.
    const NoteHead = (props: { readonly file: string }) => (
      <p data-reader="note-head" data-file={props.file} class="text-label text-muted">Reading companion</p>
    )

    // Under every Markdown note: the way back to the review.
    const Note = (props: { readonly file: string }) => (
      <p data-reader="note" data-file={props.file} class="text-body">
        <a href={REVIEW}>Review the words from your reading</a>
      </p>
    )

    yield* slots.register("sidebar.section", { said: "Reading", body: Section })
    yield* slots.register("app.keys", {
      key: "y",
      shift: true,
      whileEditing: false,
      said: "Open your vocabulary",
      press: () => navigate.open(VOCABULARY),
    })
    yield* slots.register("app.palette", {
      id: "reader-book",
      label: "Open the book you are reading",
      search: "reader book french read",
      href: BOOK,
    })
    yield* slots.register("outline.row.block", "pair", Pair)
    yield* slots.register("outline.page.foot", Foot)
    yield* slots.register("plugin.page", Own)
    yield* slots.register("app.command", {
      id: "reader-review",
      label: "Start review",
      search: "reader review start words vocabulary",
      run: () => navigate.open(REVIEW),
      chord: { key: "e", shift: true, whileEditing: false },
    })
    yield* slots.register("file.page", Transcribed)
    yield* slots.register("document.page.head", NoteHead)
    yield* slots.register("document.page.foot", Note)
    yield* slots.register("document.block", Block)
  }),
})
