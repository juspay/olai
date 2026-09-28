/** The mounted navigation router, held by this package's `router` component.
 *
 * The shell does not `needs` navigation: turning that row off must leave the
 * bar, including the plugins panel, on screen. The page under the bar reads
 * this and draws nothing while the router is away. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Navigation } from "olai-plugin-navigation/contract"

const navigation = heldService<Navigation>()

export const holdNavigation = navigation.hold
export const useNavigation = navigation.read
