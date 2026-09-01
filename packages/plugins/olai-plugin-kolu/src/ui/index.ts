/**
 * THE BROWSER'S KOLU HALF — the socket, and everything behind it.
 *
 * ## Why this directory exists
 *
 * The human, reviewing #405: *"kolu-client is great. But outside of
 * kolu-client, kolu stuff is still intertwined with Olai. The client UI for
 * example… all of Kolu stuff should be encapsulated out, as a package or more
 * packages, inside of Olai — so the non-kolu packages part of Olai doesn't
 * contain Kolu implementation."* These files were interleaved with the generic
 * property machinery in `@olai/web`'s `props/` — the drawer, the editor, the
 * handle and the block seam in the same directory as kolu's row, kolu's pane
 * and kolu's re-attach policy. Nothing prevented the next reader from reaching
 * across, and nothing announced which half of the directory was which.
 *
 * They left as `@olai/kolu-ui`, on that sitting's ruling that a package wall is
 * physics where a directory wall is discipline. The APPLIANCE FOLD moved them
 * again, in here, and the ruling did not change — what changed is which side of
 * it this half was ever on. The wall that ruling is about runs between olai and
 * the appliance, and it is `@olai/kolu-client`'s: the dial names no olai package
 * and the resolver proves it. Nothing on THIS side of that wall was ever kolu's
 * implementation; it is olai's drawing of kolu, on olai's own graph, next to
 * olai's judgement about it — and a second package to say so was a second
 * identity for one appliance.
 *
 * ## THE TWO PACKAGES
 *
 * `@olai/kolu-client` is the protocol, the mirror and the join — everything
 * server-side, and the only package that opens padi's socket. This tenant is
 * everything else: the row, the live pane, the re-attach policy the pane runs,
 * the fleet the tab holds once, and the words the header readout says (here),
 * beside the pill, the mount and the vault walks that are olai's judgement about
 * kolu (one directory over).
 *
 * ## THE SOCKET, which is what makes the boundary mean something
 *
 * `./props/KoluUi.tsx` is the whole contact. The app hands over its composed
 * client and a clock; which surface members exist, what they are called and how
 * a pane's subscription is bound are this side's business. `TerminalBlock` is a
 * renderer and registers nothing — the plugin's manifest declares the dressing
 * and the app registers it from there, against the wire's exported constant.
 * `padiSaid` is words; the pill that draws them is olai's chrome and stays in
 * `../browser/`.
 *
 * A consumer's entire contact is: one mount, one dressing, one CSS import, one
 * chrome readout. That was the test of whether this was a wall or a directory
 * with a manifest, and it is the same test now that the manifest is gone.
 */

export { KoluUi } from "./props/KoluUi.tsx"
export type { KoluClient } from "./props/KoluUi.tsx"
export { TerminalBlock } from "./props/TerminalDoor.tsx"
export { padiSaid } from "./padi/said.ts"
export type { Said } from "./padi/said.ts"

/** THE FEED — what recently wanted attention, as a log. The Padi pill's
 *  press opens it: the panel chrome is the app's, and this is the content. */
export { EventsFeed, EventRow } from "./props/EventsFeed.tsx"
export { eventLine } from "./padi/events.ts"
export type { EventLine } from "./padi/events.ts"

/** The fleet context, for the chrome readout that reads the link beside the
 *  pill — the one thing outside this package that needs the fleet itself. */
export { useFleet } from "./props/fleet.tsx"
export type { Fleet } from "./props/fleet.tsx"
