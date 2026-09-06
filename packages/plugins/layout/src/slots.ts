/** Static extension contracts owned by the layout capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export interface BarSeat {
  readonly place: "lead" | "cluster"
  readonly body: () => JSX.Element
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "app.panel": SlotDefinition<() => JSX.Element, "app">
    "app.header": SlotDefinition<BarSeat, "plugin">
    "app.banner": SlotDefinition<() => JSX.Element, "plugin">
    "app.viewer": SlotDefinition<() => JSX.Element, "app">
    "app.mount": SlotDefinition<(props: {readonly children: JSX.Element}) => JSX.Element, "plugin">
  }
}

export const slotContracts = {
  "app.panel": slotContract<() => JSX.Element>("app.panel","app"),
  "app.header": slotContract<BarSeat>("app.header","plugin"),
  "app.banner": slotContract<() => JSX.Element>("app.banner","plugin"),
  "app.viewer": slotContract<() => JSX.Element>("app.viewer","app"),
  "app.mount": slotContract<(props: {readonly children: JSX.Element}) => JSX.Element>("app.mount","plugin"),
} as const
