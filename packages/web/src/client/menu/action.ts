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

import type { Said } from "../saying.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  /** What this action asks before it runs, for the one verb whose reach is
   *  bigger than the row it was chosen on. The panel puts the question where
   *  the list was; choosing the verb again is the answer. */
  readonly confirm?: string
  /** A rule above this entry: the first verb that writes, so the half of the
   *  menu that changes the DIRECTORY is visibly a different half from the one
   *  that changes what this tab is looking at. */
  readonly divider?: boolean
  /** Do it. Answering with a {@link Said} is how a verb says what happened —
   *  a refusal in the ops layer's own words, a nudge from a write that landed,
   *  or a copy confirming it reached a clipboard the page cannot show.
   *  Answering with nothing is the ordinary success of a verb whose effect is
   *  on screen already. */
  readonly run: () => void | Promise<Said | void>
}

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
