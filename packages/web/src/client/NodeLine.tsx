/**
 * A node, on one line: its title, and the date it carries.
 *
 * The same promises wherever a node is drawn — a row in a tree, an entry on a
 * day: the title span is what carries `TESTID.nodeTitle`, it is what the
 * derived status tones, a node that cannot start yet says so beside it
 * (./Blocked.tsx), and the date badge follows. Two copies of that were two
 * chances for one of them to start toning a wrapper instead, or to move the
 * testid, while both still compiled and only one browser test noticed.
 *
 * The note itself is NOT on this line. It hangs under the title as its own
 * clamped one-line gray row (./NodeBody.tsx), Workflowy-style.
 *
 * A FRAGMENT, not a box. The row it sits in belongs to whoever draws it — a
 * tree row also holds a fold toggle, and where that sits relative to the
 * bullet is the tree's business — so this contributes siblings to a flex
 * row it does not own.
 */

import type { InTheWay, Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { Blocked } from "./Blocked.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { TESTID } from "./testids.ts"
import { toneOf } from "./tone.ts"

export function NodeLine(props: {
  readonly title: string
  /** Absent for a plain bullet, which is toned like the text it is. */
  readonly status: Status | undefined
  /** What holds this node up, and empty when nothing does. A second fact
   *  about a node rather than a replacement for its status: a blocked task
   *  keeps the mark it carries and the date it is due on, and says as well
   *  that it cannot start yet. */
  readonly blocked: ReadonlyArray<InTheWay>
  readonly date?: string
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
}) {
  return (
    <>
      <span class={`flex-1 ${toneOf(props.status)}`} data-testid={TESTID.nodeTitle}>
        {props.children}
        <NodeTitle title={props.title} />
      </span>
      <Blocked blocked={props.blocked} />
      <Show when={props.date}>
        {(date) => <DateBadge date={date()} />}
      </Show>
    </>
  )
}
