import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"

export function PluginPageHead(props: { readonly node: string }) {
  const faces = createMemo(() => hung("outline.page.head"))
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} />
  }}</For>
}

export function PluginPageFoot(props: { readonly node: string }) {
  const faces = createMemo(() => hung("outline.page.foot"))
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return <Face node={props.node} />
  }}</For>
}
