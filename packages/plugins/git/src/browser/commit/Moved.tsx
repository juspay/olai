import { Show } from "solid-js"

export function Moved(props: { readonly from: string | null }) {
  return (
    <Show when={props.from}>
      {(from) => (
        <span class="shrink-0 font-mono text-label text-muted opacity-70">
          {from()} →
        </span>
      )}
    </Show>
  )
}
