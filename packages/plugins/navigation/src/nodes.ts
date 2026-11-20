import { heldService } from "@olai/ui-primitives/held.ts"
import type { References } from "olai-plugin-outlines/references"
export const nodeTargets = heldService<Pick<References, "home" | "reveal">>()
