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

/**
 * NO `readLocation` HERE, and the absence is the phase.
 *
 * This door used to carry a Solid signal holding the renderer's live `read`,
 * installed by this row's activation and spent by five other packages — a
 * value crossing five package walls as a module variable, with no dependency
 * declared anywhere and nothing to withdraw when the renderer stopped (the
 * Cordis audit's §12).
 *
 * {@link rendererSlots} already carries that reading, and each of those
 * packages declares it on the component that draws: the walk is a service read
 * now, and a serve with no renderer leaves those components `waiting` with
 * their rows running, which is the state the runtime is for.
 */
