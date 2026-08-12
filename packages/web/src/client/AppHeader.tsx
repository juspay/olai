/**
 * The app's own chrome: a slim bar above every column.
 *
 * Principle (settled with the layout rethink): the header carries what is about
 * the APP — the wordmark, the connection, git, the agent toggle, the theme —
 * and the sidebar carries what is about the DIRECTORY — the calendar and the
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
 * 390pt phone in every connection state longer than `live`. The connection
 * label truncates instead; the agent and theme pills keep their intrinsic size.
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
 */

import { Show } from "solid-js"

import { Toggle as ChatToggle } from "./chat/Panel.tsx"
import { Commit } from "./commit/Commit.tsx"
import { Indicator } from "./connection/Indicator.tsx"
import { GitIndicator } from "./git/Indicator.tsx"
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
      class="flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-paper px-3 font-mono md:px-4"
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
          the connection and git labels keeps them inside the bar at 390pt.

          Git sits BESIDE the connection because they are the same kind of
          promise about two halves of the same page: that it is still reading,
          and that what is written to it is being kept. It draws nothing at all
          on a `--no-commit` serve.

          And the Commit pill sits beside GIT, because the two split one subject
          cleanly: the readout says whether writes here have a history to go
          into at all, the pill says what is WAITING to go into it and is the
          door to putting it there. They are two renderings of one survey (the
          server recomputes both together), never two probes — so they cannot
          contradict each other, which is what a reader would notice first. */}
      <div class="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
        <Indicator status={connectionStatus()} />
        <GitIndicator />
        <Commit />
        <ChatToggle />
        <ThemePicker />
      </div>
    </header>
  )
}
