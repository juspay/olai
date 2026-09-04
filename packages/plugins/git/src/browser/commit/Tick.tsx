/**
 * The box that says whether a file is going into this commit.
 *
 * A real `<input type="checkbox">` rather than the drawn square the mark column
 * uses (`../marks.tsx`), and the difference is the whole reason this is a
 * second control rather than a reuse: that one is DISPLAY — a node's mark, which
 * a click cannot change — and this one is an input a person operates, so it
 * wants the platform's own keyboard, focus ring and screen-reader semantics
 * rather than a span that would have to grow all three by hand.
 *
 * Its label is the file, and the file is the row: an outline's node changes
 * travel together, because a partial `.olai` write is not a thing that exists.
 */

import { TESTID } from "../../testids.ts"

export function Tick(props: {
  /** The repo-root-relative path this box is about — the one name a file has
   *  that cannot collide with another file's. */
  readonly path: string
  readonly ticked: boolean
  readonly toggle: () => void
  /** What is being committed, for the reader who never sees the row. */
  readonly label: string
}) {
  return (
    <input
      type="checkbox"
      class="mt-0.5 size-3 shrink-0 cursor-pointer accent-ink"
      data-testid={TESTID.commitTick}
      data-path={props.path}
      checked={props.ticked}
      aria-label={props.label}
      onChange={() => props.toggle()}
    />
  )
}
