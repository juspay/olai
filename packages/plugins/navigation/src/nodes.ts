import { heldService } from "@olai/ui-primitives/held.ts"
import type { References } from "olai-plugin-outlines/references"
/** Held only by navigation's optional outlines integration. */
export const nodeTargets = heldService<Pick<References, "home" | "reveal">>()
