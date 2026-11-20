import { Show } from "solid-js"

import { noteLine } from "../index.ts"
import { readLocation } from "./locations.ts"

export function NoteLine(props: { readonly file: string }) {
  return <Show when={readLocation(noteLine)[0]} keyed>
    {entry => entry.value({ get path() { return props.file } })}
  </Show>
}
