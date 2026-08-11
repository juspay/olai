/**
 * The app's own chrome: a slim bar above every column.
 *
 * Principle (settled with the layout rethink): the header carries what is about
 * the APP — the wordmark, the connection, the agent toggle, the theme — and the
 * sidebar carries what is about the DIRECTORY — the calendar and the file tree.
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
 * Styled like the rest of the chrome: mono, muted, a rule under it, paper.
 */

import { Show } from "solid-js"

import { Toggle as ChatToggle } from "./chat/Panel.tsx"
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
}) {
  return (
    // Height is `h-12` (3rem) and `--height-header` in styles.css — the chat
    // drawer subtracts the same token so it sits under this bar, not over it.
    <header
      class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-rule bg-paper px-3 font-mono md:px-4"
      data-testid={TESTID.appHeader}
    >
      <div class="flex min-w-0 items-center gap-2">
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

      {/* The three pills that are about the app rather than about the page.
          Always here, so a reader of the error report still has the connection
          answer — which is the one they want most of all. */}
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Indicator status={connectionStatus()} />
        <ChatToggle />
        <ThemePicker />
      </div>
    </header>
  )
}
