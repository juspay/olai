/**
 * WHICH row of a shortlist is the one Enter would take.
 *
 * Three surfaces in this client draw a list of {@link ./Result.tsx} rows and
 * let somebody walk it — the ⌘K palette, the header's search box through it,
 * and the row editor's three input widgets (`../complete/`) — and each of them
 * had, or was about to have, the same four lines: an index signal, `(i + 1) %
 * n`, `(i - 1 + n) % n`, and a guard for a list that got shorter underneath.
 *
 * Four lines is not much; being able to CHANGE them is the point. What a list
 * of results is walked WITH is a different question from what is in it, and it
 * has already moved once (the palette had no arrows before #104) — the day
 * somebody wants `Home` and `End`, or a page step, or a wrap that stops at the
 * ends instead of coming round, it should move for every list at once rather
 * than for whichever one the person happened to be looking at. Two copies of a
 * wrap-around modulo are two chances to disagree about what the bottom of a
 * list does.
 *
 * WHAT IT DOES NOT OWN is what the keys MEAN, and that is the reason this is a
 * cursor rather than a key handler: `Enter` in the palette runs a route and
 * `Escape` shuts the whole dialog, while `Enter` in a completion rewrites a
 * line and `Escape` puts the popup away and keeps typing. Those are the
 * surfaces' own, and a shared handler would have had to be told which it was.
 *
 * It lives beside `./Result.tsx` because that is where the shared drawing
 * already lives: the row every one of them draws, and now the cursor over a
 * list of them.
 */

import { type Accessor, createSignal } from "solid-js"

export interface Cursor {
  /** The row Enter would take. `0` over an empty list, which no surface draws
   *  and none of them has to special-case. */
  readonly at: Accessor<number>
  /** Point at this one — what a hover does. */
  readonly to: (index: number) => void
  /** One row on or back, wrapping at both ends. Nothing over an empty list. */
  readonly step: (by: 1 | -1) => void
  /** Back to the top: a NEW question is being asked, so the answer to the last
   *  one is not where somebody's eye is. */
  readonly top: () => void
}

/**
 * A cursor over a list of `count()` rows.
 *
 * The count is an ACCESSOR because a list can get shorter while somebody is
 * standing near the bottom of it — the palette's hits arrive from the server,
 * and so do the `((` widget's — and pointing at a row that is no longer there
 * is the one failure a cursor has.
 *
 * It is CLAMPED WHERE IT IS READ rather than corrected after the fact, and
 * that is the whole of the design. The obvious shape is a plain index plus an
 * effect that pulls it back in range when the list shrinks; what that buys is a
 * frame in which the cursor is out of range, and a piece of reconciliation
 * machinery to remember. Reading `min(wanted, count - 1)` cannot be out of
 * range at all, so there is no window and nothing to keep in step — and what is
 * REMEMBERED underneath is where the person actually put it, so a list that
 * grows back finds them where they were.
 */
export const createCursor = (count: Accessor<number>): Cursor => {
  /** Where the person put it — not necessarily a row that exists. */
  const [wanted, setWanted] = createSignal(0)

  const at: Accessor<number> = () => {
    const many = count()
    return many === 0 ? 0 : Math.min(wanted(), many - 1)
  }

  return {
    at,
    to: setWanted,
    step: (by) => {
      const many = count()
      if (many === 0) return
      setWanted((at() + by + many) % many)
    },
    top: () => setWanted(0),
  }
}
