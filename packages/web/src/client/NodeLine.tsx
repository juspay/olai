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
 * The note itself is NOT on this line. It hangs under the title as its own
 * clamped one-line gray row (./NodeBody.tsx), Workflowy-style.
 *
 * A FRAGMENT, not a box. The row it sits in belongs to whoever draws it — a
 * tree row also holds a fold toggle, and where that sits relative to the
 * bullet is the tree's business — so this contributes siblings to a flex
 * row it does not own.
 */

import type { Progress, Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { ProgressBadge } from "./ProgressBadge.tsx"
import { TESTID } from "./testids.ts"
import { toneOf } from "./tone.ts"

export function NodeLine(props: {
  readonly title: string
  /** Absent for a plain bullet, which is toned like the text it is. */
  readonly status: Status | undefined
  /** Absent when nothing under the node is a task. Beside the title rather
   *  than in the box: it is what the children say, not what this node is. */
  readonly progress: Progress | undefined
  readonly date?: string
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
}) {
  return (
    <>
      <span
        class={`flex-1 text-[0.9375rem] leading-snug ${toneOf(props.status)}`}
        data-testid={TESTID.nodeTitle}
      >
        {props.children}
        <NodeTitle title={props.title} />
      </span>
      <Show when={props.progress}>
        {(progress) => <ProgressBadge progress={progress()} />}
      </Show>
      <Show when={props.date}>
        {(date) => <DateBadge date={date()} />}
      </Show>
    </>
  )
}
