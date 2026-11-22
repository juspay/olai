import { createSignal, For } from "solid-js"

import type { Pair } from "./types.ts"

/** A word as it is learnt: without the punctuation around it. */
const bare = (word: string): string => word.replace(/^[«"(]+|[.,;:!?»")]+$/g, "")

/**
 * A sentence and its translation side by side. Pointing at either half lights
 * both, so you can see which English goes with which French, and each French
 * word is a button that adds it to your vocabulary.
 */
export const Columns = (props: { readonly pair: Pair; readonly onWord: (word: string) => void }) => {
  const [lit, light] = createSignal(false)
  return (
    <div
      data-reader="columns"
      class="grid grid-cols-2 gap-4 py-1 text-body"
      onPointerEnter={() => light(true)}
      onPointerLeave={() => light(false)}
    >
      <p lang="fr" class={lit() ? "bg-doing/10" : ""}>
        <For each={props.pair.french.split(" ")}>
          {(word) => (
            <>
              <button type="button" data-reader="word" data-word={bare(word)} class="hover:underline" onClick={() => props.onWord(bare(word))}>
                {word}
              </button>{" "}
            </>
          )}
        </For>
      </p>
      <p lang="en" class={lit() ? "bg-doing/10" : ""}>{props.pair.english}</p>
    </div>
  )
}
