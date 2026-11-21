import { createSignal } from "solid-js"

import type { Pair } from "./types.ts"

/**
 * A sentence and its translation side by side. Pointing at either half lights
 * both, so you can see which English goes with which French.
 */
export const Columns = (props: { readonly pair: Pair }) => {
  const [lit, light] = createSignal(false)
  return (
    <div
      data-reader="columns"
      class="grid grid-cols-2 gap-4 py-1 text-body"
      onPointerEnter={() => light(true)}
      onPointerLeave={() => light(false)}
    >
      <p lang="fr" class={lit() ? "bg-doing/10" : ""}>{props.pair.french}</p>
      <p lang="en" class={lit() ? "bg-doing/10" : ""}>{props.pair.english}</p>
    </div>
  )
}
