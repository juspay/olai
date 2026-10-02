import type {} from "../slots.ts"
import { For } from "solid-js"
import { rowFolds } from "./faces.ts"

export function PluginFolds(props: { readonly node: string; readonly record?: string }) {
  const faces = rowFolds
  return <div data-outline-fold><For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} record={props.record} />
  }}</For></div>
}
