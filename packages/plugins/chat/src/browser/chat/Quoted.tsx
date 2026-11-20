import { For } from "solid-js"

import { quotedRuns } from "./quoted.ts"

export function Quoted(props: { readonly said: string }) {
  return (
    <For each={quotedRuns(props.said)}>
      {(run) =>
        run.code
          ? <code class="rounded-control bg-rule/40 px-1">{run.text}</code>
          : run.text}
    </For>
  )
}
