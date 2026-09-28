import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { tools, type ToolWhere } from "./index.ts"

export function Tools(props: {
  readonly slots: RendererSlots
  readonly where: ToolWhere
  readonly mobileWithoutSidebar?: boolean
}) {
  const entries = () => props.slots.read(tools)
    .filter((entry) => !props.mobileWithoutSidebar || entry.value.mobileWithoutSidebar)
    // The two desktop seats split the entries between them; the phone drawer
    // (and the phone bar without one) keeps every door it always had.
    .filter((entry) => props.where === "closet" || props.mobileWithoutSidebar === true ||
      (entry.value.desktop ?? "header") === props.where)
    .sort((a, b) => props.where === "closet"
      ? a.value.closetOrder - b.value.closetOrder : a.value.headerOrder - b.value.headerOrder)
  return <For each={entries()}>{({ value: tool }) => <tool.body where={props.where} />}</For>
}
