/**
 * WHAT IS OWED, IN THE COLUMN — the rows under the `Agenda` door.
 *
 * The door said something slipped; this says WHAT, without leaving the page the
 * reader is on. It is the agenda read from outside the agenda, one step further
 * than the chip: a short list, overdue first and today's after it, so a reader
 * working in an outline can see the two things that are late and finish one of
 * them here rather than opening `/agenda` to find out what they were.
 *
 * ## The rows come WITH the count, and cannot disagree with it
 *
 * Both are fields of ONE server message (`@olai/format`'s `OwedReading`), read
 * through the one held stream (`../owed.ts`). That is the whole reason the wire
 * carries rows at all: a list fed by its own subscription would be a count of
 * two over one row for as long as a frame, and no drawing decision can repair a
 * disagreement that arrives already made.
 *
 * ## What one row is, and what it is not
 *
 * A row is the NODE, not a task card: a dot, its title, and — for late work only
 * — how long ago its day was. No ancestry, no blockers, no date pill, no menu.
 * The column is a list of names; everything a row can DO is on the page that
 * opens when it is pressed (`zoomNode`, exactly as the agenda's own rows reach a
 * node), and everything a row can SAY beyond this is what the page is for.
 *
 * THE FELT WORD rather than the ISO date, because "5 days ago" is the answer to
 * the question a reader has, and it is `@olai/format`'s `feltOn` — the spine's
 * own vocabulary, so "Yesterday" means on the column what it means on the page.
 * A today row says NOTHING after its title: "Today" beside a row under a door
 * that already said it is a word spent on no news.
 *
 * ## The two marks, and the line
 *
 * The dot is the rail's own two marks (`./owed.ts`'s `ROW_DOT`): filled
 * alarm for late work, a muted ring for today's — they differ by SHAPE as well
 * as colour, which is the calendar's rule for marks that share a place, and it
 * survives a monochrome screenshot. The faint vertical line down the left is the
 * same rule at the scale of the list: alarm while anything in it is late, muted
 * when every row is merely on today. It is a border on the list's own box, so
 * it stops where the list does.
 *
 * ## The cap, and the way on
 *
 * The server sends the first N rows (the asker's `cap`, `../dates.ts`) and the
 * two counts are the whole truth, so what is beyond the list is
 * `overdue + today - rows.length` — arithmetic over one reading, never a second
 * question. The line that says it is a LINK to `/agenda`: the page is the fuller
 * answer, and a list that ended at five in silence would be a list claiming
 * there were five.
 */

import { feltOn, type OwedRow } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { type Accessor, createMemo, Show } from "solid-js"

import { ENTRY_SHAPE, HEAD_ACTION, ROW_GAP } from "olai-plugin-layout/entry"
import { Link } from "olai-plugin-navigation/routing"
import { zoomNode } from "olai-plugin-navigation/routes"

import { TESTID } from "../../testids.ts"
import { agendaRoute } from "../routes.ts"
import { agendaRowsFolded, setAgendaRowsFolded } from "./fold.ts"
import { ROW_DOT } from "./owed.ts"

/** The id the chevron points at (`aria-controls`), so the two halves of the
 *  fold are one control and one region rather than a button and a guess. */
export const ROWS_ID = "journal-agenda-rows"

/**
 * One owed row: the dot, the title, and the felt distance for late work.
 *
 * THE ROW ARRIVES AS AN ACCESSOR and is drawn by `id` (see `AgendaRows`), so a
 * frame that changed one title updates that row's bindings and leaves the other
 * four alone — remounting a list of links on every published revision would
 * take the focus and the hover with it.
 *
 * THE LINK IS NAMED BY THE TITLE, and the dot is `aria-hidden`: what a reader
 * hears is the name of the thing, which is what a press opens. The felt word is
 * TEXT and not part of the name — "5 days ago" beside a title announced as part
 * of it would make the link's name change with the calendar.
 *
 * HOW FAR AWAY the day is, is ONE memo per row: the dot's shape, the felt word
 * and the row's `data-when` are three readings of it, and `feltOn` is a
 * subtraction and a ramp rather than a property read.
 */
function Row(props: { readonly row: Accessor<OwedRow>; readonly today: string }) {
  const felt = createMemo(() => feltOn(props.row().date, props.today))
  const late = () => felt().standing === "late"
  return (
    <li
      data-testid={TESTID.agendaRow}
      data-node-id={props.row().id}
      data-file={props.row().file}
      data-when={felt().standing}
      data-date={props.row().date}
    >
      <Link
        route={zoomNode(props.row().id)}
        class={`${ENTRY_SHAPE} ${ROW_GAP}`}
        title={props.row().title}
        label={props.row().title}
      >
        <span
          class={`size-1.5 shrink-0 rounded-full ${late() ? ROW_DOT.overdue : ROW_DOT.today}`}
          // The SHAPE is the promise, as it is on the rail: a filled mark for
          // late work and a ring for today's, so the two differ with no colour
          // at all. A scenario asks this rather than the classes that paint it.
          data-mark={late() ? "filled" : "ring"}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{props.row().title}</span>
        <Show when={late() ? felt().distance : undefined}>
          {(distance) => <span class="shrink-0 text-label text-alarm">{distance()}</span>}
        </Show>
      </Link>
    </li>
  )
}

/**
 * The list itself — the rows, the faint line they hang off, and the way on.
 *
 * `more` is rendered only when there is more: the caller works it out from the
 * same reading (`../../sidebar.tsx`'s `AgendaEntry`), and a line that said
 * "0 more" would be a list apologising for itself.
 */
export function AgendaRows(props: {
  readonly rows: ReadonlyArray<OwedRow>
  /** How many owed rows are NOT drawn — the counts' arithmetic over this list. */
  readonly more: number
  readonly today: string
}) {
  /** Whether the line down the list's left is the alarm's — ONE reading of the
   *  rows, so a hover (which re-runs the class binding) does not re-count the
   *  list, and a row arriving re-counts it once. */
  const anyLate = createMemo(() => props.rows.some((row) => feltOn(row.date, props.today).standing === "late"))
  return (
    <div
      id={ROWS_ID}
      class={`ml-3 border-l pl-2 ${anyLate() ? "border-alarm/40" : "border-muted/40"}`}
      data-testid={TESTID.agendaRows}
    >
      <ul class="m-0 list-none p-0">
        {/* Keyed by the NODE, not by the object: the reading mints fresh rows
            per frame (a value, not the wire's live store), and drawing those
            positionally would rebuild every link on every revision
            (`../agenda/Day.tsx` draws a day's rows the same way). */}
        <Key each={props.rows} by={(row) => row.id}>
          {(row) => <Row row={row} today={props.today} />}
        </Key>
      </ul>
      <Show when={props.more > 0}>
        <Link
          route={agendaRoute}
          testid={TESTID.agendaMore}
          class="block px-2 py-1 text-caption text-muted no-underline hover:text-ink"
        >
          {props.more} more on the agenda
        </Link>
      </Show>
    </div>
  )
}

/**
 * THE CHEVRON ON THE `Agenda` ROW, and the fold it spends.
 *
 * The same control the month has under `Today` (`../../sidebar.tsx`'s
 * `TodayEntry`): a button beside the row's link rather than the row growing a
 * second job. A press stops bubbling because the sidebar body puts the phone's
 * drawer away on anything that reaches it, and folding a list is not leaving.
 *
 * IT IS DRAWN ONLY WHEN THERE IS SOMETHING TO FOLD — the caller asks the reading
 * (`sidebar.tsx`), because "is anything owed" is the mark's answer and not a
 * second one taken here. `aria-expanded` is the UNFOLDED state, as the month's
 * is, so a screen reader hears one word for one fact whichever way the
 * preference is stored.
 */
export function AgendaFold() {
  const folded = agendaRowsFolded
  const said = () => (folded() ? "Show what is owed" : "Hide what is owed")
  return (
    <button
      type="button"
      class={HEAD_ACTION}
      data-testid={TESTID.agendaFold}
      aria-expanded={!folded()}
      aria-controls={ROWS_ID}
      aria-label={said()}
      title={said()}
      onClick={(event) => {
        event.stopPropagation()
        setAgendaRowsFolded(!folded())
      }}
    >
      <svg
        viewBox="0 0 16 16"
        class="size-3.5 transition-transform duration-100"
        classList={{ "rotate-90": !folded() }}
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
      </svg>
    </button>
  )
}
