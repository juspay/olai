/**
 * A node, on one line: its title, and the date it carries.
 *
 * The same promises wherever a node is drawn — a row in a tree, an entry on a
 * day: the title span is what carries `TESTID.nodeTitle`, it is what the mark
 * tones, and the rollup and date badges follow it in that order. Two copies of
 * that were two chances for one of them to start toning a wrapper instead, or
 * to move the testid, while both still compiled and only one browser test
 * noticed.
 *
 * What a node cannot START yet is NOT on this line: it is answered in the mark
 * column (./Checkbox.tsx), because it is the same kind of fact as whether the
 * work has begun and a reader sorting rows is already looking there.
 *
 * A title is EDITABLE where a caller says so (`onEdit`), and the line itself is
 * what a click lands on: in a tree the title is replaced by an input in place
 * (./edit/RowEditor.tsx), so this component draws the read face of the same
 * spot rather than knowing anything about the editor.
 *
 * The note itself is NOT on this line. It hangs under the title as its own
 * clamped one-line gray row (./NodeBody.tsx), Workflowy-style.
 *
 * A FRAGMENT, not a box. The row it sits in belongs to whoever draws it — a
 * tree row also holds a fold toggle, and where that sits relative to the
 * bullet is the tree's business — so this contributes siblings to a flex
 * row it does not own.
 */

import type { Occasion, Progress, Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { ProgressBadge } from "./ProgressBadge.tsx"
import { TESTID } from "./testids.ts"
import { toneOf } from "./tone.ts"
import { ROW_TITLE } from "./touch.ts"

export function NodeLine(props: {
  readonly title: string
  /** Outline the title is written in — handed to {@link NodeTitle} for the
   *  markdown pipeline's relative-picture resolution. */
  readonly from: string
  /** Absent for a plain bullet, which is toned like the text it is. */
  readonly status: Status | undefined
  /** Absent when nothing under the node is a task. Beside the title rather
   *  than in the box: it is what the children say, not what this node is. */
  readonly progress: Progress | undefined
  readonly date?: string
  /** Which of the node's dates {@link date} is, for the one surface that
   *  collects more than one of them — a day page. Absent everywhere else,
   *  where the date drawn is the `date` field and says so by being there. */
  readonly occasion?: Occasion
  /** Whether the node is late on that date (`@olai/format`'s `isOverdue`) —
   *  read at the row, where the node is, and drawn on the badge, which is the
   *  part of the line that stopped being true. */
  readonly overdue?: boolean
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
  /** Clicking the title starts editing it. Absent wherever a node is drawn
   *  READ-ONLY — a day page lists nodes from all over the set, and a keyboard
   *  loop that started in one of them would be typing into a page whose rows
   *  are a query rather than a tree. */
  readonly onEdit?: () => void
}) {
  return (
    <>
      <span
        class={`flex-1 ${ROW_TITLE} ${toneOf(props.status)}`}
        classList={{ "cursor-text": props.onEdit !== undefined }}
        data-testid={TESTID.nodeTitle}
        onClick={() => props.onEdit?.()}
      >
        {props.children}
        <NodeTitle title={props.title} from={props.from} />
      </span>
      <Show when={props.progress}>
        {(progress) => <ProgressBadge progress={progress()} />}
      </Show>
      <Show when={props.date}>
        {(date) => (
          <DateBadge
            date={date()}
            occasion={props.occasion}
            overdue={props.overdue}
          />
        )}
      </Show>
    </>
  )
}
