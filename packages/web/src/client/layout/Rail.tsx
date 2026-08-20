/**
 * The minimized desktop sidebar: a ~3rem icon rail.
 *
 * App chrome never disappears — expand, calendar, agenda, outlines, docs stay
 * as affordances even when the full directory column is put away. The connection
 * dot and the agent toggle stay in the HEADER (reconciled with #101); this
 * rail is only the directory's collapsed face.
 *
 * Which is why the agenda's mark is here too: the column's entry says what is
 * late (`../Sidebar.tsx`), and news that went out when somebody collapsed the
 * column would be news they could not act on. Same two faces, same reading, a
 * mark instead of a count — three rem has no room for a numeral. The alarm is a
 * FILLED dot and the nudge a RING, because they share one corner and marks that
 * share a place have to differ by more than a colour (`../calendar/Day.tsx`).
 *
 * Which is why it is PINNED on the same terms the open column is
 * (`../Sidebar.tsx`): `sticky` under the header, as tall as what is left of the
 * viewport. "Never disappears" is a claim about the screen, not about the
 * document — five icons at the top of a page-tall column are gone as soon as
 * anybody reads past the fold, and the first of them is the way to get the
 * directory back. It scrolls within itself in a window too short for five
 * buttons rather than clipping the last of them.
 */

import type { Owed } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { type Face, markOf, unchanged } from "../agenda/owed.ts"
import { Glyph } from "../file/icons.tsx"
import { HOME_ROUTE, type Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { setSidebarOpen } from "./prefs.ts"

/** How big an icon on this rail is. Spelled once because five buttons draw one
 *  — three inline here and two that are the directory's own glyphs
 *  (`../file/icons.tsx`, which takes its size from whoever draws it) — and a
 *  rail whose icons are not all one size is the only thing a reader would
 *  notice about the number. */
const ICON = "size-4"

export function Rail(props: {
  /** Navigate without a full Link tree — the rail is outside the router
   *  provider on some screens, so it takes a callback the shell already has. */
  readonly go: (route: Route) => void
  /** The app's one subscription to what is owed (../dates.ts), so the collapsed
   *  face of the column carries the same news the open one does — an alarm that
   *  went out when the sidebar was put away would be an alarm nobody could
   *  trust. */
  readonly owed: Owed | undefined
}) {
  // Held by the counts rather than by identity, for the reason the column's own
  // entry holds it that way (../agenda/owed.ts's `unchanged`).
  const mark = createMemo(() => markOf(props.owed), undefined, { equals: unchanged })

  return (
    <div
      class="olai-frame sticky top-[var(--height-header)] hidden h-[calc(100dvh-var(--height-header))] w-[var(--width-rail)] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-paper/20 py-2 md:flex"
      data-testid={TESTID.sidebarRail}
      aria-label="directory rail"
    >
      <RailButton
        testid={TESTID.sidebarExpand}
        label="expand the sidebar"
        title="expand sidebar"
        onClick={() => setSidebarOpen(true)}
      >
        {/* chevron-right */}
        <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </RailButton>

      <RailButton
        testid={TESTID.railCalendar}
        label="open today"
        title="today"
        onClick={() => props.go({ kind: "today" })}
      >
        <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
          <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-1V1a.75.75 0 0 0-1.5 0v1h-4V1A.75.75 0 0 0 4.5 1v1h-1zM3.5 6h9v6.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V6z" />
        </svg>
      </RailButton>

      {/* The one button here with news on it. A DOT rather than a count: three
          rem leaves no room for a numeral beside a glyph, and what the rail
          owes a reader is "there is something" — the number is one click away,
          in the column this collapses. Its two faces are the entry's own
          (../agenda/owed.ts), and both say so in the label, which is where a
          reader who cannot see either colour is told. */}
      <RailButton
        testid={TESTID.railAgenda}
        label={mark().said ?? "open the agenda"}
        title={mark().said ?? "agenda"}
        owed={mark().face}
        onClick={() => props.go({ kind: "agenda" })}
      >
        {/* A checklist: two ticked lines, which is what is owed rather than
            what day it is — the calendar above answers that. */}
        <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
          <path d="M6.25 3.5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zM4.78 2.22a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 0 1-1.06 0l-.75-.75a.75.75 0 0 1 1.06-1.06l.22.22 .97-.97a.75.75 0 0 1 1.06 0zm0 5a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 0 1-1.06 0l-.75-.75a.75.75 0 1 1 1.06-1.06l.22.22.97-.97a.75.75 0 0 1 1.06 0z" />
        </svg>
        {/* Drawn exactly where the table handed back a paint for it — the
            filled alarm dot, or the nudge's ring, which is a different SHAPE
            and not a second shade of the same one. */}
        <Show when={mark().dot !== ""}>
          <span
            class={`absolute right-1 top-1 size-2 rounded-full ${mark().dot}`}
            aria-hidden="true"
          />
        </Show>
      </RailButton>

      <RailButton
        testid={TESTID.railOutlines}
        label="open outlines"
        title="outlines"
        onClick={() => {
          setSidebarOpen(true)
          props.go(HOME_ROUTE)
        }}
      >
        {/* The tree's own outline glyph (../file/icons.tsx), at the rail's
            size. Both faces of this column already agree about what is OWED;
            they agree about what an OUTLINE is for the same reason — a reader
            who collapses the column has not gone somewhere else. */}
        <Glyph of="outline" size={ICON} />
      </RailButton>

      <RailButton
        testid={TESTID.railDocs}
        label="open the directory"
        title="documents"
        onClick={() => setSidebarOpen(true)}
      >
        {/* And the tree's document glyph, for the same reason. */}
        <Glyph of="document" size={ICON} />
      </RailButton>
    </div>
  )
}

function RailButton(props: {
  readonly testid: string
  readonly label: string
  readonly title: string
  /** What this button has to report, where it reports anything — a `data-`
   *  fact for the browser tests rather than the colour it painted, exactly as
   *  the column's own entry carries it. The FACE type and not a string: a
   *  misspelling here is an attribute no scenario would ever match. */
  readonly owed?: Face
  readonly onClick: () => void
  readonly children: import("solid-js").JSX.Element
}) {
  return (
    <button
      type="button"
      // `relative`: the agenda's dot is absolute against this box, and the
      // containing block is declared once, here, rather than by whichever child
      // happens to need one.
      class={`${TARGET_BOX} relative inline-flex items-center justify-center rounded-xl text-paper/65 hover:bg-paper/10 hover:text-paper md:min-h-9 md:min-w-9`}
      data-testid={props.testid}
      data-owed={props.owed}
      aria-label={props.label}
      title={props.title}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}
