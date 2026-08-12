/**
 * The app's own chrome: a slim bar above every column.
 *
 * Principle (settled with the layout rethink): the header carries what is about
 * the APP — the wordmark, the connection, git (ONE pill: the Commit pill, which
 * absorbed the readout that used to sit beside it), the agent toggle, the theme
 * — and the sidebar carries what is about the DIRECTORY — the calendar and the
 * file tree.
 * One home for chrome means one place to look, including on the error report and
 * the waiting page; the corner-pills special case those screens used to need is
 * gone because the header is always there.
 *
 * On a phone the burger joins the left edge next to the wordmark. The sheet it
 * opens is still only the directory: calendar + tree, nothing of the app's own.
 * The agent toggle sits in this bar too, so it is one tap away rather than two
 * (burger, then footer) — which is why the phone e2e no longer opens the sheet
 * to reach it.
 *
 * The bar is a fixed `h-12` and the right-hand group is `flex-nowrap`: wrapping
 * inside a fixed height centred the second row off the top of the viewport on a
 * 390pt phone in every connection state longer than `live`. The connection and
 * commit labels truncate instead; the agent and theme pills keep their
 * intrinsic size.
 *
 * The one screen without this bar is the fault card: `main.tsx`'s
 * `<ErrorBoundary>` sits above `App`, so a thrown render never reaches here.
 * That is pre-existing and intentional — a broken client has no chrome to
 * trust — and is the sole exception to "the header is on every screen".
 *
 * Styled like the rest of the chrome: mono, muted, a rule under it, paper.
 * Height is `h-12` (3rem) and the static `--height-header` token in
 * `styles.css` — the chat drawer subtracts the same token so it sits under
 * this bar, not over it.
 *
 * ## It STICKS, and that is what makes the rest of the chrome true
 *
 * The page scrolls the DOCUMENT (`./scroll.ts` remembers `scrollY` per history
 * entry), so a bar in normal flow leaves the screen the moment anybody reads
 * past the fold — taking the connection dot, the commit pill and the agent
 * toggle with it. Every one of those is a permanent answer about the app rather
 * than about the page, which is the argument for the bar existing at all; a
 * permanent answer you have to scroll back up for is not one.
 *
 * It is also what keeps the SEAM honest. The mobile drawer, its scrim and both
 * faces of the chat panel are `fixed` and start at `top: var(--height-header)`
 * — a viewport coordinate. That is only the bottom edge of this bar while this
 * bar is AT the top of the viewport; scrolled away, those panels were hanging
 * 3rem below nothing, showing a strip of the page above them. Sticky is what
 * makes the one token mean the same thing to the header and to everything
 * measured from it.
 *
 * `sticky` rather than `fixed`: sticky stays in flow, so it still occupies its
 * own 3rem and the column below it needs no compensating pad — and the
 * `min-h-[calc(100dvh-var(--height-header))]` the page reserves goes on meaning
 * what it says. No ancestor may take an `overflow` other than `visible` or this
 * silently stops sticking; the shell above it (`./App.tsx`) is two plain flex
 * boxes for that reason.
 *
 * THE LAYER is `z-[45]`, and the number is the whole point: above the panels
 * (the chat dock, the drawer, its scrim, the minimized pill — 30 and 40), which
 * is what stops a page scrolling UNDER the bar from painting over it, and below
 * the modals (the command palette and the restarted card, 50), which cover the
 * whole viewport and must cover this too. A positioned bar with a z-index is a
 * stacking context, so the one popover drawn INSIDE it — the theme picker's —
 * rides at 45 as well; the two overlays that must escape (the commit panel, a
 * tip) already portal to the body and are unaffected.
 */

import { Show } from "solid-js"

import { Toggle as ChatToggle } from "./chat/Panel.tsx"
import { Commit } from "./commit/Commit.tsx"
import { Indicator } from "./connection/Indicator.tsx"
import { connectionStatus } from "./wire.ts"
import { TESTID } from "./testids.ts"
import { ThemePicker } from "./theme/Picker.tsx"
import { TARGET_BOX } from "./touch.ts"

export function AppHeader(props: {
  /** When a sidebar exists: whether its sheet is open, and the way to toggle
   *  it. Absent on the screens with no sidebar (error report, waiting), where
   *  there is nothing to put away and no burger to draw. */
  readonly menu?: {
    readonly open: boolean
    readonly onToggle: () => void
  }
  /** Whether a directory column is present. The e2e settle probe keys on this
   *  (`data-layout="docked"`) so a phone can settle without opening the sheet. */
  readonly docked?: boolean
}) {
  return (
    <header
      class="sticky top-0 z-[45] flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-paper px-3 font-mono md:px-4"
      data-testid={TESTID.appHeader}
      data-layout={props.docked ? "docked" : "chrome-only"}
    >
      <div class="flex shrink-0 items-center gap-2">
        <Show when={props.menu}>
          {(menu) => (
            <button
              type="button"
              class={`${TARGET_BOX} -ml-2 inline-flex items-center justify-center rounded text-muted hover:text-ink md:hidden`}
              data-testid={TESTID.sidebarToggle}
              data-open={menu().open}
              aria-expanded={menu().open}
              aria-label={menu().open ? "hide the sidebar" : "show the sidebar"}
              onClick={() => menu().onToggle()}
            >
              <span aria-hidden="true" class="text-lg leading-none">☰</span>
            </button>
          )}
        </Show>
        <h1 class="m-0 text-base uppercase tracking-widest text-muted">olai</h1>
      </div>

      {/* The pills that are about the app rather than about the page. Always
          here, so a reader of the error report still has the connection
          answer — which is the one they want most of all. Nowrap + truncate on
          both labels keeps them inside the bar at 390pt.

          The Commit pill sits BESIDE the connection because they are the same
          kind of promise about two halves of the same page: that it is still
          reading, and that what is written to it is being kept. There is ONE
          of it, which is the whole of `one-git-indicator`: #108's `● git`
          readout used to sit between them answering the second question a
          second time, and two chips for one subject is what the human filed.
          Every state that readout drew is a face of this pill now — including
          the fault, with git's own words on its tip. */}
      <div class="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
        <Indicator status={connectionStatus()} />
        <Commit />
        <ChatToggle />
        <ThemePicker />
      </div>
    </header>
  )
}
