/**
 * How full the inbox is, as the sidebar asks it.
 *
 * A CELL on the wire (`@olai/surface`'s `inbox`), answered per published
 * revision from `@olai/format`'s `inboxHeldOf`. There is no argument — the
 * count is a fact about the directory, not about the reader — which is why
 * this is not a stream the way `./dates.ts`'s `owed` is. The door that wears
 * the number already knows WHICH file the inbox is, from the paths.
 *
 * WHAT THIS HANDS OUT IS A VALUE, copied, for `./dates.ts`'s reason: a
 * subscription holds a reconciled store whose identity survives every frame
 * and whose fields move under it. A consumer comparing two readings by
 * reference would compare the store to itself.
 */

import { type Accessor, createMemo } from "solid-js"

import { type InboxHeld, NO_INBOX } from "@olai/surface"

import { olai } from "./wire.ts"

/**
 * How full the inbox is, or {@link NO_INBOX} before the first frame and for
 * a directory that has none.
 *
 * Zero is the honest drawing either way: the chip hides at zero, and the
 * door's presence is a question about the PATHS (`inboxIn`), not about this
 * number. A badge that claimed "nothing is in it" out of a directory it had
 * not been told about would be a lie if the door were drawn from it; it is
 * not.
 */
export const createInboxHeld = (): Accessor<InboxHeld> => {
  const cell = olai.cells.inbox.use()
  return createMemo(() => {
    const held = cell.value()
    return held === undefined ? NO_INBOX : { count: held.count }
  })
}
