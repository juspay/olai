/**
 * A row that does not exist yet.
 *
 * It is drawn where the row WILL be — after the sibling it follows, or on the
 * start line of a page with no rows — with the same gutter arithmetic every
 * other row uses (`../touch.ts`), so the line a person is typing on sits
 * exactly where the line they are making it will sit. What it deliberately
 * does NOT have is a glyph that goes anywhere or says a mark: those are
 * affordances of a node, and there is no node here until this has a title and
 * gets committed.
 *
 * The hollow bullet says which of the two it is. A reader who looks away and
 * back should be able to tell an empty row that exists from one that is only
 * an editor, and the difference between a filled dot and an outline is exactly
 * that — nothing is claiming a record is there. Both spellings of the dot are
 * `marks.tsx`'s, so there is one place a bullet's size is decided.
 */

import { DOT } from "../marks.tsx"
import { TESTID } from "../testids.ts"
import { CONTROL, GUTTER_GAP, HOVER_CELL, HOVER_GUTTER } from "../touch.ts"
import type { Draft } from "./draft.ts"
import { Said, TitleEditor } from "./RowEditor.tsx"

export function NewRow(props: {
  readonly draft: Draft
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
}) {
  return (
    <div>
      <div class={`flex items-center ${GUTTER_GAP}`} data-testid={TESTID.newRow}>
        {/* The hover strip's PLACE, cell for cell: a row reserves the `•••`
            (pointer devices only, `hidden md:` exactly as the menu hides
            itself) and the collapse triangle, and a draft that reserved one
            cell for the two sat 1.25rem to the left of the siblings it was
            about to join — a line typed at one depth and committed at
            another. The widths are `../touch.ts`'s; what has to match is how
            many cells there are. */}
        <span class={HOVER_GUTTER}>
          <span class={`${HOVER_CELL} hidden md:inline-flex`} aria-hidden="true" />
          <span class={HOVER_CELL} aria-hidden="true" />
        </span>
        <span class={CONTROL} aria-hidden="true">
          <span class={`${DOT} border-[1.5px] border-muted`} />
        </span>
        <TitleEditor
          text={props.draft.text}
          onInput={props.onInput}
          onKey={props.onKey}
          onBlur={props.onBlur}
          placeholder="a new line — type it, and Enter makes the next one"
        />
      </div>
      {/* Under the line it belongs to. A new row is the draft most likely to
          be refused (a node needs a title), and on an empty outline it is the
          only thing on the page — so what the write said has to be here
          rather than somewhere the tree would have drawn it. */}
      <Said draft={props.draft} />
    </div>
  )
}
