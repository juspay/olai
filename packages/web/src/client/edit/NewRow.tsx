/**
 * A row that does not exist yet.
 *
 * It is drawn where the row WILL be — after the sibling it follows, or at the
 * top of an outline that holds nothing — with the same gutter arithmetic every
 * other row uses (`../touch.ts`), so the line a person is typing on sits
 * exactly where the line they are making it will sit. What it deliberately
 * does NOT have is a bullet that goes anywhere or a checkbox: those are
 * affordances of a node, and there is no node here until this has a title and
 * gets committed.
 *
 * The hollow bullet says which of the two it is. A reader who looks away and
 * back should be able to tell an empty row that exists from one that is only
 * an editor, and the difference between a filled dot and an outline is exactly
 * that — nothing is claiming a record is there.
 */

import { TESTID } from "../testids.ts"
import { CONTROL, CONTROL_SPACER, GUTTER_GAP, HOVER_CELL, HOVER_GUTTER } from "../touch.ts"
import { TitleEditor } from "./RowEditor.tsx"

export function NewRow(props: {
  readonly text: string
  readonly caret: number
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: () => void
}) {
  return (
    <div class={`flex items-center ${GUTTER_GAP}`} data-testid={TESTID.newRow}>
      <span class={HOVER_GUTTER}>
        <span class={HOVER_CELL} aria-hidden="true" />
      </span>
      <span class={CONTROL} aria-hidden="true">
        <span class="block h-[0.375rem] w-[0.375rem] rounded-full border-[1.5px] border-muted" />
      </span>
      <span class={CONTROL_SPACER} aria-hidden="true" />
      <TitleEditor
        text={props.text}
        caret={props.caret}
        onInput={props.onInput}
        onKey={props.onKey}
        onBlur={props.onBlur}
        placeholder="a new line — type it, and Enter makes the next one"
      />
    </div>
  )
}
