/** Static extension contracts owned by the layout capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/**
 * How a status readout is doing, and how each tone is painted — `@olai/web`'s
 * one table (`client/readout.ts`), opened here too so a readout's plugin reads
 * its tone's paint through the same contract door it states the tone through.
 * The bar's one health dot wears the worst tone among everything standing in
 * the `cluster` seat (and the connection, which is the bar's own); each row
 * wears its own, from the same table, so a dot that is not green always has a
 * row of its colour under it.
 */
export type { Tone as BarTone } from "@olai/web/client/readout.ts"
export { TONE } from "@olai/web/client/readout.ts"
import type { Tone as BarTone } from "@olai/web/client/readout.ts"

/** What a cluster readout states NOW, in its own words — the same short label
 *  its row draws, and the sentence behind it. The dot's name and tip quote
 *  `label` (and `detail`) when the tone is `notice` or `alarm`, so a person
 *  learns what is wrong without opening anything. */
export interface BarStatus {
  readonly tone: BarTone
  readonly label: string
  readonly detail?: string
}

export interface BarSeat {
  readonly place: "lead" | "cluster"
  /** The readout's face. A `cluster` face is a ROW of the health popover
   *  (drawn only while it is open); a `lead` face sits in the bar. */
  readonly body: () => JSX.Element
  /** A `cluster` readout's live state, read reactively by the bar to colour
   *  its health dot. Supplied by the contributor from state its own activation
   *  owns, so it is withdrawn with the registration. Absent is a readout that
   *  never affects the dot. */
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
  "app.header": slotContract<BarSeat>("app.header","plugin",
    "A `{ place, body, status? }`, one per plugin: `body` is called with nothing and draws in the bar (`place: \"lead\"`) or as a row of the health popover (`place: \"cluster\"`), and `status` answers `{ tone, label, detail? }` for the health dot."),
  "app.banner": slotContract<() => JSX.Element>("app.banner","plugin",
    "A function called with nothing, one per plugin, drawn as a banner across the top of the app above every page."),
  "app.viewer": slotContract<() => JSX.Element>("app.viewer","app",
    "A function called with nothing, drawn over the whole app as its one viewer; while one plugin holds it, a second plugin's registration is refused."),
  "app.mount": slotContract<(props: {readonly children: JSX.Element}) => JSX.Element>("app.mount","plugin",
    "A component handed `{ children }`, the whole app, which it must draw inside whatever it wraps around it, one per plugin."),
} as const
