/**
 * What an ENTRY is, to the panel that draws it.
 *
 * The seam between the two halves of this directory, and it is a type rather
 * than a component for exactly that reason: `./actions.ts` builds a list of
 * these out of routes, folds and the write gate, and `./Panel.tsx` draws a
 * list of these knowing none of that. Neither imports the other. A further
 * verb is an entry in the catalog, never a branch in the panel.
 *
 * It lived in `./NodeMenu.tsx` until the panel was split up, which made the
 * shape of the mistake visible: the catalog — a pure table with a unit test —
 * was importing from a `.tsx` component to learn what a row of itself looks
 * like, so the file that knows nothing about drawing depended on the file that
 * is nothing but drawing. Here, both depend on the description instead.
 */

import type { Said } from "@olai/web/client/saying.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  /** What this action asks before it runs, for the one verb whose reach is
   *  bigger than the row it was chosen on. The panel puts the question where
   *  the list was; choosing the verb again is the answer. */
  readonly confirm?: string
  /** A rule above this entry: the first of a group (`./actions.ts` names the
   *  groups), so a reader sees where one kind of verb ends and the next — and,
   *  above all, `Move to Trash` — begins. */
  readonly divider?: boolean
  /** Do it. Answering with a {@link Said} is how a verb says what happened —
   *  a refusal in the ops layer's own words, a nudge from a write that landed,
   *  or a copy confirming it reached a clipboard the page cannot show.
   *  Answering with nothing is the ordinary success of a verb whose effect is
   *  on screen already. */
  readonly run: () => void | Promise<Said | void>
}

/**
 * An entry that OPENS rather than runs: a submenu of further entries —
 * `Mark ›`, `More ›`, a plugin's `Start an agent ›`. It is how the menu stays
 * short: what varies by a choice, and what is reached for rarely, costs the top
 * level one line.
 */
export interface MenuSub {
  readonly id: string
  readonly label: string
  /** A rule above this entry, as {@link MenuAction.divider}. */
  readonly divider?: boolean
  readonly entries: ReadonlyArray<MenuEntry>
}

/** One line of the menu: a verb, or a submenu of them. */
export type MenuEntry = MenuAction | MenuSub

/** Does this line open a submenu? */
export const isSub = (entry: MenuEntry): entry is MenuSub => "entries" in entry

/**
 * Whether this verb asks before it runs.
 *
 * ONE reading of the confirm, because the panel acts on it twice: the question
 * replaces the list instead of the verb happening, AND the menu stays open to
 * ask it (`closeOnSelect`). Spelled at both props, the two could drift into a
 * menu that shuts on the way to a question nobody then sees.
 *
 * What ANSWERING the question does is the confirm's own entry, which calls
 * `onPick` directly — so "ask, then do" stays two call sites rather than one
 * function telling them apart by object identity.
 */
export const asks = (action: MenuAction): boolean => action.confirm !== undefined
