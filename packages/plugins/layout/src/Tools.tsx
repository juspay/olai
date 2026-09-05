import { For } from "solid-js"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "./index.ts"

export function Tools(props: {
  readonly slots: RendererSlots
  readonly where: "header" | "closet"
  readonly mobileWithoutSidebar?: boolean
}) {
  const entries = () => props.slots.read(tools)
    .filter((entry) => !props.mobileWithoutSidebar || entry.value.mobileWithoutSidebar)
    .sort((a, b) => props.where === "header"
      ? a.value.headerOrder - b.value.headerOrder : a.value.closetOrder - b.value.closetOrder)
  return <For each={entries()}>{({ value: tool }) => <tool.body where={props.where} />}</For>
}
