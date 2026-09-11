import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"

/** Each contributed face leaves with the row or page that owns its drawing. */
export function PluginAsides(props: { readonly node: string }) {
  const faces = createMemo(() => hung("outline.row.aside"))
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} />
  }}</For>
}
