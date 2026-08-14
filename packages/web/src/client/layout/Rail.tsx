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
 * column would be news they could not act on. Same two faces, same reading,
 * one dot instead of a count — three rem has no room for a numeral.
 *
 * Which is why it is PINNED on the same terms the open column is
 * (`../Sidebar.tsx`): `sticky` under the header, as tall as what is left of the
 * viewport. "Never disappears" is a claim about the screen, not about the
 * document — five icons at the top of a page-tall column are gone as soon as
 * anybody reads past the fold, and the first of them is the way to get the
 * directory back. It scrolls within itself in a window too short for five
 * buttons rather than clipping the last of them.
 */

import type { Agenda } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { lookOf } from "../agenda/owed.ts"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { setSidebarOpen } from "./prefs.ts"

export function Rail(props: {
  /** Navigate without a full Link tree — the rail is outside the router
   *  provider on some screens, so it takes a callback the shell already has. */
  readonly go: (route: Route) => void
  /** The app's one reading of what is owed (../App.tsx), so the collapsed face
   *  of the column carries the same news the open one does — an alarm that went
   *  out when the sidebar was put away would be an alarm nobody could trust. */
  readonly agenda: Agenda | undefined
}) {
  const look = createMemo(() => lookOf(props.agenda))

  return (
    <div
      class="sticky top-[var(--height-header,3rem)] hidden h-[calc(100dvh-var(--height-header,3rem))] w-[var(--width-rail,3rem)] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-rule/70 bg-desk py-2 md:flex"
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
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </RailButton>

      <RailButton
        testid={TESTID.railCalendar}
        label="open today"
        title="today"
        onClick={() => props.go({ kind: "today" })}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
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
        label={look().said ?? "open the agenda"}
        title={look().said ?? "agenda"}
        owed={look().face}
        onClick={() => props.go({ kind: "agenda" })}
      >
        {/* A checklist: two ticked lines, which is what is owed rather than
            what day it is — the calendar above answers that. */}
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M6.25 3.5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zM4.78 2.22a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 0 1-1.06 0l-.75-.75a.75.75 0 0 1 1.06-1.06l.22.22 .97-.97a.75.75 0 0 1 1.06 0zm0 5a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 0 1-1.06 0l-.75-.75a.75.75 0 1 1 1.06-1.06l.22.22.97-.97a.75.75 0 0 1 1.06 0z" />
        </svg>
        <Show when={look().face !== "quiet"}>
          <span
            class={`absolute right-1 top-1 size-2 rounded-full ${look().dot}`}
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
          props.go({ kind: "outline", file: null })
        }}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M2.5 3.5a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75zm0 4a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 7.5zm0 4a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75z" />
        </svg>
      </RailButton>

      <RailButton
        testid={TESTID.railDocs}
        label="open the directory"
        title="documents"
        onClick={() => setSidebarOpen(true)}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M4 1.75A.75.75 0 0 1 4.75 1h4.69c.2 0 .39.08.53.22l3.81 3.81c.14.14.22.33.22.53v8.69A.75.75 0 0 1 13.25 15h-8.5A.75.75 0 0 1 4 14.25V1.75zm5.25.75v2.69c0 .41.34.75.75.75h2.69L9.25 2.5z" />
        </svg>
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
   *  the column's own entry carries it. */
  readonly owed?: string
  readonly onClick: () => void
  readonly children: import("solid-js").JSX.Element
}) {
  return (
    <button
      type="button"
      // `relative`: the agenda's dot is absolute against this box, and the
      // containing block is declared once, here, rather than by whichever child
      // happens to need one.
      class={`${TARGET_BOX} relative inline-flex items-center justify-center rounded text-muted hover:bg-rule/60 hover:text-ink md:min-h-9 md:min-w-9`}
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
