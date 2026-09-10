/** Static contracts: the session pick and the optional face under listing boxes. */
import type { Accessor, JSX } from "solid-js"
import { serviceTag } from "@olai/plugin-api/contracts"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"
import type { Search, SearchKind } from "./reading.ts"

export type Kind = Extract<SearchKind, "node" | "file"> | undefined
export interface KindPick { readonly pick: Accessor<Kind>; readonly set: (value: Kind) => void }
export const searchKind = serviceTag<KindPick>("search.kind")
export interface BoxBelow {
  readonly pick: Accessor<Kind>
  readonly cycle: () => void
  readonly body: (props: { readonly search: Search }) => JSX.Element
}
declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions { "search.box.below": SlotDefinition<BoxBelow, "app"> }
}
export const boxBelow = slotContract<BoxBelow>("search.box.below", "app")
