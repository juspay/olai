/**
 * THE PLUGINS PANEL'S DOOR, as chat reaches it — held for the component that
 * declared `plugin-inspector.configuration` (`../browser.tsx`'s `plugins`).
 *
 * An engine picker with nothing to pick says so in one quiet line and offers
 * the one place that explains why: the plugins panel files every engine this
 * machine lacks under **Needs you**. The panel is the inspector's; chat holds
 * only the declared `open` for as long as both are up, and draws no door while
 * the inspector is off (`undefined` here).
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { ConfigurationPanel } from "olai-plugin-plugin-inspector/contract"

const provider = heldService<ConfigurationPanel>()

/** Told by `../browser.tsx`'s `plugins` component, for that activation. */
export const holdPluginsDoor = provider.hold

/** The inspector's opener, or `undefined` while it is not running. */
export const pluginsDoor = provider.read
