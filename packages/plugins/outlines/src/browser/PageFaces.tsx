import type {} from "../slots.ts"
import { For } from "solid-js"
import { pageHeads, pageFeet } from "./faces.ts"

export function PluginPageHead(props: { readonly node: string }) {
  const faces = pageHeads
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} />
  }}</For>
}

export function PluginPageFoot(props: { readonly node: string }) {
  const faces = pageFeet
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} />
  }}</For>
}
