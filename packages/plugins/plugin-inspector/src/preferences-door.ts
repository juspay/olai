/** THIS CONSUMER'S OWN HOLD ON THE PREFERENCES PANEL'S DOOR.
 *
 * PRIVATE TO THIS PACKAGE, and that is the load-bearing half: this module is
 * behind no declared contract, so the value cannot become a second undeclared
 * cross-package path to the panel's state. What is shared is the ALGORITHM
 * (`@olai/ui-primitives`' `heldService`, a factory); what is not shared is this
 * holder. `olai-plugin-kolu`'s `browser/configuration.ts` is the same shape one
 * package over.
 *
 * The inspector's `tools` component draws every row, so it is the one reader:
 * the `preferences-door` component names `preferences.open` in its `needs` and
 * holds it here for as long as Preferences is up. When that service is absent
 * the read answers `undefined`, which is the honest reading — the panel is not
 * there to open — and the row draws the control itself rather than a link that
 * could not land.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PreferencesPanel } from "olai-plugin-preferences/contract"

const provider = heldService<PreferencesPanel>()

/** THE HOLD `./browser.tsx`'s `preferences-door` component takes, and the only
 *  writer this module has. */
export const holdPreferencesPanel = provider.hold

/** ...and the reading, whose `undefined` is the panel's absence. */
export const preferencesPanel = provider.read