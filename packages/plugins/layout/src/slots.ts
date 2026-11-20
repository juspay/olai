import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type { Tone as BarTone } from "@olai/web/client/readout.ts"
export { TONE } from "@olai/web/client/readout.ts"
import type { Tone as BarTone } from "@olai/web/client/readout.ts"

export interface BarStatus {
  readonly tone: BarTone
  readonly label: string
  readonly detail?: string
}

export interface BarSeat {
  readonly place: "lead" | "cluster"
  readonly body: () => JSX.Element
  readonly status?: () => BarStatus
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "app.header": SlotDefinition<BarSeat, "plugin">
    "app.banner": SlotDefinition<() => JSX.Element, "plugin">
    "app.viewer": SlotDefinition<() => JSX.Element, "app">
    "app.mount": SlotDefinition<(props: {readonly children: JSX.Element}) => JSX.Element, "plugin">
  }
}

export const slotContracts = {
  "app.header": slotContract<BarSeat>("app.header","plugin"),
  "app.banner": slotContract<() => JSX.Element>("app.banner","plugin"),
  "app.viewer": slotContract<() => JSX.Element>("app.viewer","app"),
  "app.mount": slotContract<(props: {readonly children: JSX.Element}) => JSX.Element>("app.mount","plugin"),
} as const
