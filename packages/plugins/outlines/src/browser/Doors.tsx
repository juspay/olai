import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"
/** Outlines draws each scoped row-door contribution under its property run,
 *  in the siting the slot declares: same surface, two callsites, and the
 *  page's own doors know which one drew them. */
export function PluginDoors(props: { readonly node: string; readonly where: "row" | "page" }) {
  const doors = createMemo(() => hung("outline.row.door"))
  return (
    <For each={doors()}>
      {(one) => {
        const Face = one.face
        return <Face node={props.node} where={props.where} />
      }}
    </For>
  )
}
