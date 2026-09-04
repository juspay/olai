/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, as the tab reads it.
 *
 * ## What replaced what
 *
 * It was `olai` — `@olai/web`'s live view onto CORE's client — and the members
 * were core's: `olai.cells.chat`, `olai.procedures.chat.send`. They are this
 * plugin's now, composed under `surface/chat/…`, so what a face reads is the
 * client the framework minted for this sibling. `Wired` hands it over, keyed by
 * the word the registry bound this fiber under, so there is no name a face could
 * spell to ask for another plugin's members.
 *
 * ## A HOLDER, and the reason is a redial rather than convenience
 *
 * The tab follows the roster: a plugin turned off on the server leaves the tab
 * without a reload, and one that arrives is dialled in. Each of those builds a
 * NEW connection and kills the old, so a module-scope constant would be a handle
 * onto a dead wire from the first roster frame onwards — and thirty modules in
 * this package read this name at module scope.
 *
 * So what is held is the READ, not the client: {@link chatWire} resolves against
 * whichever connection is current at the moment it is called. That is exactly
 * the arrangement `@olai/web`'s `olai` keeps for core's own client, and it does
 * not pretend to keep a stale subscription alive — a `use()` binds to the client
 * it was called on, and one opened on a superseded wire is dead however it was
 * reached. What the holder buys is that the NEXT call lands on the live wire,
 * which is all it has to do: the app's tree is rebuilt on a redial, so every
 * `use()` runs again and each of them reads through here at that moment.
 *
 * ## THE SHAPE IS STRUCTURAL, and that is the point
 *
 * {@link ChatClient} is not the framework's client type — it is the shape this
 * half reads, written out. A structural pin is what lets `../browser.tsx` hand
 * over an opaque `unknown` with one narrowing at the edge, and it is what a
 * suite substitutes: a bench stands up an object with these members and nothing
 * else, rather than a whole surface client. It also means the member NAMES live
 * in ONE file, so a rename on the wire stops here.
 */

import type { SurfaceClient } from "@kolu/surface/solid"

import type { surface } from "../wire.ts"

/**
 * WHAT THE FRAMEWORK MINTED FOR THIS SIBLING, over this plugin's own spec.
 *
 * The framework's own client type rather than a structural pin, and the
 * difference from `olai-plugin-kolu`'s `KoluClient` is which side of a wall the
 * shape sits on: kolu's APPLIANCE is a package that must not learn what a
 * surface is, so it writes its four members out and a suite satisfies them. This
 * is the PLUGIN's own browser half reading the PLUGIN's own surface — one
 * package, one spec — so the honest type is the projection of that spec, and a
 * member renamed in `../wire.ts` is a type error at every face that reads it
 * rather than a structural shape that quietly stops matching.
 */
export type ChatClient = SurfaceClient<typeof surface.spec>

/** The live read, set once by this plugin's `apply` — see the header on why it
 *  is the read and not the client. */
let held: (() => ChatClient) | null = null

/** TOLD BY `../browser.tsx`, and by nothing else. It is a statement rather than
 *  a config field for the reason the app's own holder is one: the client arrives
 *  as a service this half NAMED, so the moment it is in hand is inside the
 *  `apply`, and passing it down through thirty modules would make every
 *  component's signature a function of what one descendant needs. */
export const holdChatWire = (read: () => ChatClient): void => {
  held = read
}

/**
 * CHAT'S OWN MEMBERS, on whichever wire is current.
 *
 * A THROW rather than a null arm, and it is the same bargain `@olai/web`'s
 * `publishing()` makes on the server: a face of this plugin is drawn only after
 * this plugin's fiber applied, and its fiber applies only after the tab dialled
 * the sibling the roster named. A face reading this before that has not raced —
 * it has been mounted somewhere the roster does not reach, which is a mistake in
 * the app's boot order and not a state to draw a fallback for.
 */
export const chatWire = (): ChatClient => {
  if (held === null) {
    throw new Error(
      "olai-plugin-chat: a face read the chat's wire before the plugin was mounted — "
        + "the tab dials a sibling and then mounts its half, in that order",
    )
  }
  return held()
}
