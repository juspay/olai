import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "@olai/web/client/plugins/runtime.ts"
/** Outlines draws each scoped row-door contribution under its property run. */
export function PluginDoors(props: { readonly node: string }) {
  const doors = createMemo(() => hung("outline.row.door"))
  return (
    <For each={doors()}>
      {(one) => {
        const Face = one.face
        return <Face node={props.node} />
      }}
    </For>
  )
}
