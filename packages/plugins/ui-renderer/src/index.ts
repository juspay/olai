import { location, serviceTag, type LocationOwner, type Locations } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"

export const name = "ui-renderer"
export type Face = () => JSX.Element
export const root = location<Face>("root", "one")
export interface RendererSlots extends LocationOwner {
  readonly read: Locations["read"]
  readonly inspect: Locations["inspect"]
}
export const rendererSlots = serviceTag<RendererSlots>("ui-renderer.slots")
