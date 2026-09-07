/**
 * THE SHELF THE SERVER ANSWERED, reachable from wherever a door onto it is
 * drawn.
 *
 * One subscription to the `pins` cell, one context over it. The cell carries
 * the rows of `Pins.olai` with every node address resolved, re-sent whenever a
 * published revision changes what it says (`@olai/format`'s `shelfOf`,
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` §6's item 5) — so there is nothing
 * to ask for here and no generation to ask on: the server is the one that knows
 * when the directory moved.
 *
 * A CONTEXT rather than a prop, for `../reading.tsx`'s reason: the readers are
 * scattered and none of them is near the sidebar. The shelf itself draws it,
 * the ⌘K row and the ⌘⇧P chord ask whether this page is on it
 * (`../palette/Palette.tsx`), and the `•••` of every row in a thousand-row tree
 * asks the same about the node it names (`../menu/verbs.ts`) — threading one
 * accessor through all of that would make every component's signature a
 * function of what one descendant needs.
 *
 * THE VALUE IS AN ACCESSOR, for that module's other reason: the answer is a
 * fresh array each time the shelf changes, and a context holding the rows
 * themselves would hand out the ones that were current when the app mounted.
 *
 * WHAT A DEAD WIRE DRAWS is the last answer that arrived, which is what the
 * connection pill already promises for everything else on screen ("what is on
 * screen is the last thing the server said") — and the reader is looking at it
 * through the offline overlay, which freezes the app while the wire cannot
 * carry a question (`../connection/Offline.tsx`, §5b's ruling). Nothing here
 * pretends, and nothing here is queued.
 */

import { heldService } from "@olai/ui-primitives/held.ts"

import { NO_PINS, type Shelf } from "@olai/format"

/**
 * ## PRIVATE TO THIS PACKAGE, and that is what moved
 *
 * This module was a declared contract (`olai-plugin-pins/shelf`) and
 * `olai-plugin-outlines`' tree opened it to draw a pin glyph on a row: the live
 * value crossed a package wall as a module signal with nothing declared
 * anywhere (the audit's §12). The shelf travels on `pins.state` now
 * (`../contract.ts`), which the outline declares on a component of its own, and
 * this holder is this row's own — installed by the activation that offers the
 * service, so the two cannot be different answers.
 */
const shelf = heldService<() => Shelf>()

/** The shelf as the server last answered it — the empty shelf before this
 *  row's own activation has subscribed, which is what every reader here draws
 *  for a directory with no `Pins.olai` in it either. */
export const usePins = (): (() => Shelf) => () => shelf.read()?.() ?? NO_PINS

export const holdPins = shelf.hold
