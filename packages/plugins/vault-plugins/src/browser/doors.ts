/**
 * THIS ROW'S OWN HOLDS ON THE SERVICES ITS COMPONENTS DECLARED — four of them,
 * each installed by exactly one component and read by the faces that can live
 * without it.
 *
 * ## Why a holder rather than a prop
 *
 * Most of what this row's faces need arrives where the dependency is declared
 * and is handed down as a prop: the roster, the management verbs, the client.
 * These four are different in one way — the component that DECLARES them is not
 * the component that DRAWS with them. The sidebar's `+` wants the palette, and
 * the sidebar must keep its rows with navigation switched off; the page wants
 * the agent panel, and the page must keep working with chat switched off; the
 * palette's first level wants the engines, and the level must still open where
 * no engine is installed. Each of those is one component declaring the service
 * and a different component asking, every frame, whether anybody is holding it.
 * `@olai/ui-primitives`' `heldService` is that shape, and its three rules are
 * why this is not the module variable the Cordis audit's §12 is about: the
 * CONSUMER holds, the hold clears by identity, and the read is a tracked signal
 * whose `undefined` is a state a face draws rather than a moment it waits out.
 *
 * ## One holder per holding component, and that is a rule rather than a habit
 *
 * Two components holding into one holder is the defect `website/docs/architecture/
 * cordis.md` names under navigation's holders: the second hold wins, the first
 * release is a no-op by identity, and the component still mounted reads nothing
 * though every finalizer ran correctly. So each of these has exactly ONE
 * installer, named in the comment on it, and `../browser.tsx` is where that is
 * enforced by there being exactly one `hold` call per holder.
 *
 * PRIVATE to this package. Nothing here is on an `exports` map, which is what
 * makes this module inert to the static fence's `live-state` claim: a module
 * another package can open may hold no live value, and this is not one.
 */

import { heldService } from "@olai/ui-primitives/held.ts"
import type { EnginesService } from "olai-plugin-chat/browser-engines"
import type { DockDoor } from "olai-plugin-chat/dock"
import type { BesideDoor } from "olai-plugin-chat/beside"
import type { Navigation, PaletteControl } from "olai-plugin-navigation/contract"

/** Held by the `palette` component, which declares both of the app shell's
 *  addressing services together: the box that opens at *New plugin*, and the
 *  router a submitted level navigates with. The sidebar's `+` reads the first
 *  and draws no `+` without it. */
const box = heldService<PaletteControl>()
export const holdPalette = box.hold
export const palette = box.read

/** ...and the router, which the sidebar reads to wash the row whose page is in
 *  front. The alert takes its own navigation from its component's `needs`
 *  rather than from here: this holder is installed by the palette component,
 *  and a ping that waited on the palette would be a notification nobody gets
 *  on a serve with the palette off. */
const lane = heldService<Navigation>()
export const holdRouter = lane.hold
export const router = lane.read

/** Held by the `dock` component. `undefined` is a serve with no chat, a chat
 *  with no shell seat, or a phone — and in all three the plugin page simply
 *  does not dock and offers no verb that would. */
const panel = heldService<DockDoor>()
export const holdDock = panel.hold
export const dock = panel.read

/** Held by the `beside` component. `undefined` is a serve with chat off, or
 *  one with no router for a pane to open in — and the page's *Ask for a
 *  change…* row is then not drawn at all. */
const aside = heldService<BesideDoor>()
export const holdBeside = aside.hold
export const beside = aside.read

/** Held by the `engines` component. `undefined` is a serve that offers no
 *  agent at all, where *New plugin* still mints a folder and says so. */
const agents = heldService<EnginesService>()
export const holdEngines = agents.hold
export const engines = agents.read
