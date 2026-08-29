/**
 * A node, on one line: its title, the one fact allowed beside it, and the date
 * it carries.
 *
 * The same promises wherever a node is drawn — a row in a tree, an entry on a
 * day: the title span is what carries `TESTID.nodeTitle`, it is what the mark
 * tones, and whatever rides after it does so in the dim voice and in that
 * order. Two copies of that were two chances for one of them to start toning a
 * wrapper instead, or to move the testid, while both still compiled and only one
 * browser test noticed.
 *
 * ## The line, left to right
 *
 *   title (ellipsized) · the note's pilcrow · the aside · the date · the repeat rule · ⏱ AT THE FAR HAND
 *
 * THE TITLE ELLIPSIZES rather than wrapping (the quiet outline, human): a row is
 * a line, and a title that wrapped to three of them turned the column into
 * paragraphs with bullets in front. What is cut off is on the element's own
 * `title`, so nothing is unreadable — it is one hover, or one click into the
 * editor, away.
 *
 * EVERYTHING AFTER IT SITS AGAINST IT, and nothing floats to the far right.
 * They are `shrink-0` and they follow the words immediately, which is what makes
 * them read as a byline rather than as a value column — the ruling that there is
 * nothing table-shaped in this view (human). The DATE was the last thing still
 * floating, and it stopped being tolerable when the column lost its measure and
 * took the whole pane. What absorbs the rest of the line is a filler after them
 * all, and it is not decoration: it is the click target that puts the caret in
 * the title from anywhere along the row, which the title's own `flex-1` used to
 * be before anything needed to sit next to the words.
 *
 * What a node cannot START yet is NOT on this line: it is answered in the glyph
 * column (./Glyph.tsx), because it is the same kind of fact as whether the work
 * has begun and a reader sorting rows is already looking there.
 *
 * A title is EDITABLE where a caller says so (`onEdit`), and the line itself is
 * what a click lands on: in a tree the title is replaced by an input in place
 * (./edit/RowEditor.tsx), so this component draws the read face of the same spot
 * rather than knowing anything about the editor.
 *
 * The note itself is NOT on this line. It hangs under the title in the open
 * state (./NodeBody.tsx), and the pilcrow here is the door to it.
 *
 * A FRAGMENT, not a box. The row it sits in belongs to whoever draws it — a tree
 * row also holds a fold toggle, and where that sits relative to the glyph is the
 * tree's business — so this contributes siblings to a flex row it does not own.
 */

import type { Occasion, Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { RepeatBadge } from "./RepeatBadge.tsx"
import { TESTID } from "./testids.ts"
import { toneOf } from "./tone.ts"
import { ROW_TITLE, SECTION_TITLE } from "./touch.ts"

/** The first of the open state's three layers: the TITLE LINE says the row is
 *  open. What it does is brighten the `#tags` inside it (`./styles.css` — a tag
 *  is HTML from `./markdown/tags.ts` and wears no utility of ours), and it is
 *  keyed on the title SPAN rather than on the row's `<li>` because rows nest: a
 *  rule off the item would light up every tag in an opened parent's subtree. */
export const TITLE_OPEN = "olai-title-open"

export function NodeLine(props: {
  readonly title: string
  /** Outline the title is written in — handed to {@link NodeTitle} for the
   *  markdown pipeline's relative-picture resolution. */
  readonly from: string
  /** Absent for a plain bullet, which is toned like the text it is. */
  readonly status: Status | undefined
  /** The words a filter found this node by — lit inside the title, so a row on
   *  a narrowed page says WHICH part of it the query landed on
   *  (`./filter/lit.ts`). Absent wherever there is no query, and on the rows a
   *  query kept as the ancestry leading to one. */
  readonly needles?: ReadonlyArray<string>
  /** This row is a section heading — a top-level node of the view. Heavier
   *  name; everything else about a section is the tree's. */
  readonly section?: boolean
  /** This row is OPEN, which is a fact the title line draws: its tags brighten
   *  ({@link TITLE_OPEN}). The pilcrow beside them says the same thing in its
   *  own ink, and the two are one layer. */
  readonly open?: boolean
  /** The one fact allowed beside the title, already built (./Aside.tsx). */
  readonly aside?: JSX.Element
  /** The ⏱ chip, already built (./TookChip.tsx): how long the work took, or
   *  how long it has been going. It is the line's CLOSING figure, drawn after
   *  the filler at the far hand — not one of the facts hugging the words —
   *  so it is handed over whole, exactly as the two left of the words are. */
  readonly took?: JSX.Element
  /** The door to the note, when the node has one (./note/Mark.tsx). */
  readonly mark?: JSX.Element
  /** What the date pill beside the title SAYS, and whether there is one at
   *  all: absent draws none. The stored date wherever a row draws its own; on
   *  the agenda, the one fact the day it is under has not already given
   *  ({@link ./DateBadge.tsx}, whose word this is). */
  readonly says?: string
  /** Which of the node's dates the pill is about, for the one surface that
   *  collects more than one of them — a day page. Absent everywhere else,
   *  where the date drawn is the `date` field and says so by being there. */
  readonly occasion?: Occasion
  /** Whether the node is late on that date (`@olai/format`'s `isOverdue`) —
   *  read at the row, where the node is, and drawn on the badge, which is the
   *  part of the line that stopped being true. Required for the reason the
   *  badge's is: not saying is not the same answer as "no". */
  readonly overdue: boolean
  /** Drawn inside the title and before it — the tree's mirror mark. */
  readonly children?: JSX.Element
  /** Clicking the title starts editing it. Absent wherever a node is drawn
   *  READ-ONLY — a day page lists nodes from all over the set, and a keyboard
   *  loop that started in one of them would be typing into a page whose rows
   *  are a query rather than a tree.
   *
   *  The EVENT is handed over because what a click means depends on what is
   *  held: a plain one is about this row's text, a modified one is about the
   *  row as a thing to pick (`./Tree.tsx`, where that split is made). This file
   *  draws a line and decides none of it. */
  readonly onEdit?: (event: MouseEvent) => void
  /** How the node COMES BACK, in the format's own words — drawn beside the
   *  date, because a rule with no date is a record the format refuses. Absent
   *  on nearly every node. */
  readonly repeat?: string
  /** Clicking the DATE opens the picker on it — the same split as `onEdit`,
   *  one field along, and absent in the same places for the same reason. */
  readonly onPickDate?: () => void
  /** Clicking the REPEAT pill opens that picker — `onPickDate` one field
   *  along, absent in the same places for the same reason. */
  readonly onPickRepeat?: () => void
}) {
  return (
    <>
      {/* `items-baseline` rather than the row's own `items-center`: the aside
          and the pilcrow are TEXT beside text, and centring two different type
          sizes against each other is what makes a fraction look pasted on. */}
      <span
        class="flex min-w-0 flex-1 items-baseline gap-1.5"
        classList={{ "cursor-text": props.onEdit !== undefined }}
        onClick={(event) => props.onEdit?.(event)}
      >
        <span
          class={`min-w-0 truncate ${props.section === true ? SECTION_TITLE : ROW_TITLE} ${toneOf(props.status)}`}
          classList={{
            [TITLE_OPEN]: props.open === true,
          }}
          data-testid={TESTID.nodeTitle}
          // What the ellipsis took, for a pointer. The stored title, verbatim
          // — the same string the editor would open on, never the rendering.
          title={props.title}
        >
          {props.children}
          <NodeTitle title={props.title} from={props.from} needles={props.needles} />
        </span>
        {/* The pilcrow hugs the TITLE, because it is about the title — "there
            is more of this" — and the facts follow it. */}
        {props.mark}
        {props.aside}
        {/* THE DATE RIDES HERE TOO, and it did not always: it was a sibling
            outside this cell, which with a `flex-1` title meant the right edge
            of the pane. That was tolerable while the column stopped at a
            measure and is not now the tree takes the full width (`./touch.ts`)
            — a badge a hand's width from the row it is about reads as a value
            in a column, which is the shape this view has none of. Same rule as
            the aside beside it: shrink-0, dim, straight after the words. */}
        <Show when={props.says}>
          {(says) => (
            <DateBadge
              says={says()}
              occasion={props.occasion}
              overdue={props.overdue}
              onPick={props.onPickDate}
            />
          )}
        </Show>
        {/* And the RULE after it, in that order because that is the sentence:
            the day it is on, then how often it comes back. Same rules as the
            badge before it — shrink-0, dim, straight after the words. */}
        <Show when={props.repeat}>
          {(repeat) => <RepeatBadge repeat={repeat()} onPick={props.onPickRepeat} />}
        </Show>
        {/* The rest of the line, and it belongs to the title: a click anywhere
            along a row opens its editor, exactly as it did when the title span
            itself was the thing that stretched. */}
        <span class="min-w-0 flex-1" aria-hidden="true" />
        {/* …and what sits at its far hand, past the filler: the ⏱ chip. It is
            a readout, never a control — so it stops no click: like the
            READ-ONLY date pill beside the words, one on it bubbles to the
            line's editor (./DateBadge.tsx and ./Pill.tsx make the same rule). */}
        {props.took}
      </span>
    </>
  )
}
