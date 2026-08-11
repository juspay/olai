/**
 * What a node cannot start until: its `after` edges, drawn as the one thing
 * the file does not say and the reader wants to know.
 *
 * Blockedness is DERIVED (`@olai/format`'s `blocked` index): `a after b` holds
 * `a` up while `b` is a task that is not done, an unmarked target never blocks
 * because it is not work, and nothing about any of it is stored. So this
 * component looks nothing up — it draws the answer a row or a page was already
 * handed, the same way the checkbox draws a derived status.
 *
 * TWO SHAPES of one fact, which is the same split `NodeBody` makes:
 *
 *   - on a ROW, one word. A tree row is a title in a column of titles, and the
 *     blockers' names would push it off the screen it is being read on; the
 *     pill says the node is held up, names what it is waiting on in its
 *     tooltip, and LINKS to the first blocker — the format promises that order,
 *     and the next thing a reader wants is that node. It is dim and unhurried
 *     on purpose: a thing you cannot start is the last row that should be
 *     asking for attention;
 *   - on the node's own PAGE, every blocker named, because the page is where
 *     the node is read and "waiting on what?" is a question it should answer
 *     rather than hint at. That shape is not this file's: a labelled row of
 *     links to nodes is what `see` draws too, and it is ./NodeRefs.tsx.
 *
 * Both say `blocked by` — the pill in its tooltip, the row in its label — and
 * the file says `after`. The reader's word for the relation is one word.
 *
 * Drawn nowhere at all when nothing is in the way, which is nearly every node.
 */

import type { InTheWay } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { NodeRefLink, NodeRefs } from "./NodeRefs.tsx"
import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

export function Blocked(props: {
  /** What the node is waiting on, in the format's promised order. Empty is the
   *  usual answer, and draws nothing. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** This is the node's own page: name every blocker rather than the pill. */
  readonly zoomed?: boolean
}) {
  const refs = createMemo(() =>
    props.blocked.map((one) => ({ id: one.at.node.id, title: one.at.node.title }))
  )
  const first = () => refs()[0]

  return (
    <Show
      when={props.zoomed}
      fallback={
        <Show when={first()}>
          {(head) => (
            <NodeRefLink
              to={head()}
              class={PILL}
              testid={TESTID.blocked}
              title={`blocked by ${refs().map((ref) => ref.title).join(", ")}`}
            >
              blocked
            </NodeRefLink>
          )}
        </Show>
      }
    >
      <NodeRefs label="blocked by" refs={refs()} testid={TESTID.blocked} />
    </Show>
  )
}

const PILL =
  `inline-flex ${TARGET} shrink-0 items-center rounded-sm border border-rule px-1.5 text-[0.6875rem] tracking-wide text-muted uppercase no-underline hover:text-ink md:min-h-0`
