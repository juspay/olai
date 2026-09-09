/**
 * THE FACE'S HOLD ON THE ROUTER — a per-activation holder
 * (`@olai/ui-primitives/held.ts` carries the three rules), not a module
 * variable the app hands things through: the row's `apply` names
 * `navigation.state` and installs the service it was handed, and the
 * arrest at plugin stop takes it away. Reading `undefined` means "the
 * navigation row is not mounted", and an absent link draws as text.
 */
import type { Navigation } from "olai-plugin-navigation/contract"
import { heldService } from "@olai/ui-primitives/held.ts"

export const navigationHeld = heldService<Navigation>()
