import type {} from "../slots.ts"
import type { NodeFace } from "../slots.ts"
import type { Hung } from "@olai/plugin-api"
import { For } from "solid-js"
import { rowAsides } from "./faces.ts"

export function PluginFaces(props: {
  readonly faces: ReadonlyArray<Hung<NodeFace>>
  readonly node: string
  readonly record?: string
  readonly testid?: string
}) {
  return <For each={props.faces}>{(one) => {
    const Face = one.face
    return (
      <span class="contents" data-plugin={one.plugin} data-testid={props.testid}>
        <Face node={props.node} record={props.record} />
      </span>
    )
  }}</For>
}

export function PluginAsides(props: { readonly node: string; readonly record?: string }) {
  return <PluginFaces faces={rowAsides()} node={props.node} record={props.record} />
}
