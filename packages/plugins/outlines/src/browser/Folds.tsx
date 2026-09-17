import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"

export function PluginFolds(props: { readonly node: string; readonly record?: string }) {
  const faces = createMemo(() => hung("outline.row.fold"))
  return <div data-outline-fold><For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} record={props.record} />
  }}</For></div>
}
