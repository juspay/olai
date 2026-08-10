/**
 * A node, on one line: its title, an optional gray note snippet, and — when
 * the row is open — the date it carries.
 *
 * The same three promises wherever a node is drawn — a row in a tree, an entry
 * on a day: the title span is what carries `TESTID.nodeTitle`, it is what the
 * derived status tones, and the date badge follows it when the row is expanded.
 * Two copies of that were two chances for one of them to start toning a
 * wrapper instead, or to move the testid, while both still compiled and only
 * one browser test noticed.
 *
 * The snippet sits AFTER the title text on the same flex row — gray, ellipsized,
 * initial characters only (Things-style). It is outside `nodeTitle` so a
 * title assertion never swallows the note. Tapping it is the touch expand
 * control; on a fine pointer the whole row's hover expands instead.
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
  readonly status: Status
  readonly date?: string
  /** Plain first-line of the note; absent when the node has no desc. */
  readonly snippet?: string
  /** Row is open (hover or tap) — show date, hide snippet. */
  readonly expanded?: boolean
  /** Tap/click the snippet to toggle expansion (touch path). */
  readonly onSnippetToggle?: () => void
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
}) {
  const open = () => props.expanded === true

  return (
    <>
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          // Title keeps its words; the snippet eats the leftover column so a
          // long title on a phone never collapses the snippet to zero width
          // (and a zero-width control is not tappable).
          class={`min-w-0 shrink truncate ${TONE[props.status]}`}
          data-testid={TESTID.nodeTitle}
        >
          {props.children}
          <NodeTitle title={props.title} />
        </span>
        <Show when={!open() && props.snippet}>
          {(snippet) => (
            <button
              type="button"
              class="min-w-[4ch] max-w-[55%] flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.9375rem] font-normal text-muted"
              data-testid={TESTID.desc}
              data-preview="true"
              data-open="false"
              title="show the full note"
              onClick={(event) => {
                // The row's hover already expands on a mouse; this is the
                // touch control. stopPropagation keeps a parent from treating
                // it as a row click if one appears later.
                event.stopPropagation()
                props.onSnippetToggle?.()
              }}
            >
              {snippet()}
            </button>
          )}
        </Show>
      </span>
      <Show when={open() && props.date}>
        {(date) => <DateBadge date={date()} />}
      </Show>
    </>
  )
}
