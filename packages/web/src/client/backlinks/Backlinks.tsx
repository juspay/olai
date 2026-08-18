/**
 * WHAT REFERS TO THIS NODE, under a zoomed node's heading — the one place in
 * this app a reference is read backwards.
 *
 * Every reference points one way on disk: a node writes `see: ["herbs"]`, or
 * writes `@herbs` in its title or its note, and the herb bed's own record says
 * nothing about either. The forward halves are drawn (the `see` row under a
 * note, the `@` tag in a title); this is the reverse, and until it existed the
 * only way to find what talked about a node was to search for its id by hand.
 *
 * DERIVED, and therefore READ-ONLY: there is no `×` here, for `../NodeRefs.tsx`'s
 * own reason — half of these entries are words in somebody else's sentence, and
 * an affordance that could not take those back would be an affordance that did
 * nothing for half the list. What removes a reference is editing the record
 * that makes it, which is one click away on every row.
 *
 * COLLAPSED, and the collapse is the browser's — a `<details>`, the shape
 * `../document/Toc.tsx` already uses, so it works before this app's JavaScript
 * has an opinion about it and is announced without an `aria-expanded` to keep
 * in step. The default is shut because a reference is context rather than
 * content: what the node IS is its title, its note and what hangs under it, and
 * a vault where everything points at one hub node would otherwise open that
 * node with a wall of links above its own children.
 *
 * KEYED ON THE NODE, for the reason the contents is: `open` is an attribute the
 * browser then owns, so a page reused from `/n/a` to `/n/b` would carry the
 * reader's answer about the first node onto the second. A different node is a
 * different element by construction. It is NOT keyed on the count — the section
 * staying open while a reference is added elsewhere is exactly the live update
 * this feature is for.
 *
 * TWO ROWS RATHER THAN ONE LIST, because there are two ways to refer and they
 * are not the same claim: a `see` is an edge somebody wrote with a verb, and a
 * mention is a word in a sentence. Each row is `../NodeRefs.tsx` — the same
 * shape the `see` and `blocked by` rows have — and a record that does both
 * appears in both, which is what it is doing.
 */

import { createMemo, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { NodeRefs } from "../NodeRefs.tsx"
import { TESTID } from "../testids.ts"
import { referrersOf } from "./refs.ts"

export function Backlinks(props: {
  /** The node the page is about — canonical, since a zoom resolves a mirror's
   *  chain before it draws anything (`@olai/format`'s `zoom`). */
  readonly id: string
}) {
  const derived = useDerived()
  const referrers = createMemo(() => referrersOf(derived(), props.id))

  return (
    <Show when={referrers().total > 0}>
      {/* A node nobody refers to draws NOTHING — not an empty section saying
          so. The absence is the answer, which is the rule every relation row
          on this page already follows. */}
      <Show when={props.id} keyed>
        <details
          class="mt-3 border-t border-rule pt-2"
          data-testid={TESTID.backlinks}
          data-count={referrers().total}
        >
          <summary
            class="cursor-pointer text-sm text-muted select-none"
            data-testid={TESTID.backlinksSummary}
          >
            {said(referrers().total)}
          </summary>
          <NodeRefs
            label="sees this"
            refs={referrers().sees}
            testid={TESTID.backlinkSeeRefs}
          />
          <NodeRefs
            label="mentions this"
            refs={referrers().mentions}
            testid={TESTID.backlinkMentionRefs}
          />
        </details>
      </Show>
    </Show>
  )
}

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says and "Referenced by 3" beside a
 *  heading reads as a score. */
const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "node" : "nodes"}`
