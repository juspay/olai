import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { sameList } from "@olai/web/client/same.ts"
import { createMemo, For, useContext } from "solid-js"
import { HealthSeat } from "./contracts/BarDoor.tsx"
import { tools, type ToolWhere } from "./index.ts"

export function Tools(props: {
  readonly slots: RendererSlots
  readonly where: ToolWhere
  readonly mobileWithoutSidebar?: boolean
}) {
  const entries = createMemo(() => props.slots.read(tools)
    .filter((entry) => !props.mobileWithoutSidebar || entry.value.mobileWithoutSidebar)
    // The two desktop seats split the entries between them; the phone drawer
    // (and the phone bar without one) keeps every door it always had.
    .filter((entry) => props.where === "closet" || props.mobileWithoutSidebar === true ||
      (entry.value.desktop ?? "header") === props.where)
    .sort((a, b) => props.where === "closet"
      ? a.value.closetOrder - b.value.closetOrder : a.value.headerOrder - b.value.headerOrder), undefined, { equals: sameList })
  // In the health seat each door portals its own row into the popover's foot,
  // so each is told its place there (`./contracts/BarDoor.tsx`'s `HealthSeat`).
  const seat = props.where === "health" ? useContext(HealthSeat) : undefined
  return <For each={entries()}>{({ value: tool }) => seat === undefined
    ? <tool.body where={props.where} />
    : <HealthSeat.Provider value={{ ...seat, order: tool.headerOrder }}><tool.body where={props.where} /></HealthSeat.Provider>}</For>
}
