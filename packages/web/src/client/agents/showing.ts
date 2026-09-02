/**
 * WHETHER THE PANEL IS SHOWING THE UNASSIGNED CHATS — one signal, this tab's.
 *
 * The migration list is opened from the SIDEBAR and drawn in the PANEL, which
 * is why it is a module-scoped signal rather than state inside either: the two
 * are cousins in the tree, and threading a setter from the roster's last row
 * down through the app to the panel's body would make every component between
 * them a function of what one of their descendants needs.
 *
 * ## THIS TAB'S, and deliberately not the server's
 *
 * It is `../chat/Panel.tsx`'s own `asking` argument word for word: a person
 * part-way through a gesture belongs to the tab they made it in. Which
 * conversation the panel is IN is a fact about the panel, and every tab
 * watching sees it; *I am looking at the list of chats nobody claims* is a
 * person browsing, it is cancellable, and a second tab has no business being
 * taken over by it.
 *
 * ## Not a preference either
 *
 * `../layout/prefs.ts` keeps what a reader chose — which panels are open, how
 * wide — across reloads. This is not that: a list you were reading when you
 * closed the tab is not a layout you set, and coming back to olai over a
 * conversation you cannot see would be a panel that looks broken. It dies with
 * the page.
 *
 * ## What SHUTS it
 *
 * Opening any conversation, wherever that press was made ({@link ./focus.ts},
 * the list's own rows, the picker), and the list's own way out. That rule is
 * the reason this is one exported setter rather than a toggle: every door that
 * puts a conversation in the panel has to be able to say *and stop showing the
 * list*, and none of them should have to know what the list currently is.
 */

import { createSignal } from "solid-js"

const [showing, setShowing] = createSignal(false)

/** Whether the panel's body is the unassigned list rather than a
 *  conversation. */
export const showingUnassigned = showing

/** Show it — the roster's last row, and nothing else. */
export const showUnassigned = (): void => {
  setShowing(true)
}

/** ... and stop showing it, which every door that opens a conversation says.
 *  A no-op where it was never up, so a caller never has to ask first. */
export const hideUnassigned = (): void => {
  setShowing(false)
}
