/**
 * A node, on one line: its title, and the date it carries.
 *
 * The same three promises wherever a node is drawn — a row in a tree, an entry
 * on a day: the title span is what carries `TESTID.nodeTitle`, it is what the
 * derived status tones, and the date badge follows it. Two copies of that were
 * two chances for one of them to start toning a wrapper instead, or to move
 * the testid, while both still compiled and only one browser test noticed.
 *
 * The note itself is NOT on this line. It hangs under the title as its own
 * clamped one-line gray row (./NodeBody.tsx), Workflowy-style.
 *
 * A FRAGMENT, not a box. The row it sits in belongs to whoever draws it — a
 * tree row also holds a fold toggle, and where that sits relative to the
 * bullet is the tree's business — so this contributes siblings to a flex
 * row it does not own.
 */

import type { Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { TESTID } from "./testids.ts"
import { TONE } from "./tone.ts"

export function NodeLine(props: {
  readonly title: string
  /** Outline the title is written in — handed to {@link NodeTitle} for the
   *  markdown pipeline's relative-picture resolution. */
  readonly from: string
  readonly status: Status
  readonly date?: string
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
}) {
  return (
    <>
      <span class={`flex-1 ${TONE[props.status]}`} data-testid={TESTID.nodeTitle}>
        {props.children}
        <NodeTitle title={props.title} from={props.from} />
      </span>
      <Show when={props.date}>
        {(date) => <DateBadge date={date()} />}
      </Show>
    </>
  )
}
