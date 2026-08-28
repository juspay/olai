/**
 * THE BROWSER'S KOLU HALF — the socket, and everything behind it.
 *
 * ## Why this package exists
 *
 * The human, reviewing #405: *"kolu-client is great. But outside of
 * kolu-client, kolu stuff is still intertwined with Olai. The client UI for
 * example… all of Kolu stuff should be encapsulated out, as a package or more
 * packages, inside of Olai — so the non-kolu packages part of Olai doesn't
 * contain Kolu implementation."* And the ruling that decided the shape:
 * *"Directory wall can be broken easily by importing. Package walls cannot;
 * they are also conceptually self-explanatory."*
 *
 * These files were interleaved with the generic property machinery in
 * `@olai/web`'s `props/` — the drawer, the editor, the handle and the block
 * seam in the same directory as kolu's row, kolu's pane and kolu's re-attach
 * policy. Nothing prevented the next reader from reaching across, and nothing
 * announced which half of the directory was which.
 *
 * ## THE TWO PACKAGES
 *
 * `@olai/kolu-client` is the protocol, the mirror and the join — everything
 * server-side, and the only package that opens padi's socket. This one is
 * everything browser: the row, the live pane, the re-attach policy the pane
 * runs, the fleet the tab holds once, and the words the header readout says.
 *
 * ## THE SOCKET, which is what makes the wall mean something
 *
 * `./props/KoluUi.tsx` is the whole contact. The app hands over its composed
 * client and a clock; which surface members exist, what they are called and how
 * a pane's subscription is bound are this side's business. `TerminalBlock` is a
 * renderer and registers nothing — the app owns its own block table and calls
 * `registerBlock(TERMINAL_KEY, TerminalBlock)` itself, against the wire's
 * exported constant. `padiSaid` is words; the pill that draws them is olai's
 * chrome and stays there.
 *
 * A consumer's entire contact is: one mount, one register call, one CSS import,
 * one chrome readout. That is the test of whether this is a wall or a directory
 * with a manifest.
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
