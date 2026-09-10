/**
 * WHAT IS CONTRIBUTED AT A LOCATION, as the outline reads it — held for the
 * activation that declared the renderer.
 *
 * The reading is `olai-plugin-ui-renderer`'s `RendererSlots.read`, and it
 * arrives on a service this package already names on its `content` component. It used to arrive as
 * `readLocation` — a Solid signal in the renderer's own contract door, set by
 * that row's activation and read by five other packages, with no dependency
 * declared anywhere (the audit's §12).
 *
 * The empty answer is unchanged and is the honest one: with no renderer
 * mounted nothing is contributed anywhere, so a face that walks a location
 * draws nothing rather than waiting.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Locations } from "@olai/plugin-api/contracts"

const reader = heldService<Locations["read"]>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdLocations = reader.hold

/** ...and the walk itself. */
export const readLocation: Locations["read"] = (slot) => reader.read()?.(slot) ?? []
