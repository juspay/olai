/**
 * The app's own chrome: a slim bar above every column.
 *
 * Principle (settled with the layout rethink): the header carries what is about
 * the APP — the wordmark, the connection, git (ONE pill: the Commit pill, which
 * absorbed the readout that used to sit beside it), the agent toggle, and the
 * PREFERENCES (which absorbed the theme pill for the same reason: a preference
 * with a door of its own, next to the door to the preferences) — and the
 * sidebar carries what is about the DIRECTORY — the calendar and the file tree.
 * One home for chrome means one place to look, including on the error report and
 * the waiting page; the corner-pills special case those screens used to need is
 * gone because the header is always there.
 *
 * On a phone the burger joins the left edge next to the wordmark, and that is
 * the WHOLE of the bar besides the magnifier. WhatsApp's rule: identity and
 * search in the header; connection and git as banners under it, and only when
 * there is news (`./News.tsx`); the agent as the thumb strip it already was;
 * preferences in the directory drawer. A healthy phone does not advertise
 * health — `live` and `✓ committed` stay off screen. A dead wire is the freeze
 * overlay, which was already the stronger form of that banner. Desktop keeps
 * the pills, because a bar of chips cannot be trusted if the healthy ones
 * disappear.
 *
 * The bar is a fixed `--height-header` and the right-hand group is `flex-nowrap`: wrapping
 * inside a fixed height centred the second row off the top of the viewport on a
 * 390pt phone in every connection state longer than `live`. That squeeze is why
 * the pills left the phone bar rather than learning a fifth give-way rule.
 *
 * On DESKTOP the SEARCH BOX is the one control here that may shrink to nothing
 * before any pill loses a character — an input narrowed to a slot is still an
 * input, which is what its `min-w-0` and its cap are for. The last commit's AGE
 * (`commit/Commit.tsx`'s `· 3m ago`) is `sm` and up only. On a phone the same
 * search door is a 44px magnifier that opens the ⌘K palette
 * (`search/HeaderSearch.tsx` argues both halves).
 *
 * The wordmark and the burger never give way at all: they are the app's
 * identity and the way back to the directory. The theme pill, which NAMED the
 * theme in force, is gone from the bar entirely (`settings/`), and what it
 * promised is kept a gesture in, on the theme row's own hint.
 *
 * The one screen without this bar is the fault card: `main.tsx`'s
 * `SurfaceFaultBoundary` sits above `App`, so a thrown render never reaches
 * here. That is pre-existing and intentional — a broken client has no chrome
 * to trust — and is the sole exception to "the header is on every screen".
 *
 * The bar is INK, the same ground as the directory spine — `.olai-frame`,
 * the one place that says what the surround is made of, which the sidebar and
 * the rail wear too — and the outline is a paper sheet sitting in it. Its
 * height is `--height-header` and nothing else: the bar WEARS the token that
 * everything under it subtracts, rather than an `h-16` somebody has to keep
 * equal to it. A coral rule along the bottom is the one loud mark the chrome
 * allows itself.
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
 * THE LAYER is `LAYER.header` (`./layer.ts`), and its place in that table is
 * the whole point: above the panels (the chat dock, the drawer, its scrim, the
 * minimized pill), which is what stops a page scrolling UNDER the bar from
 * painting over it, and below what covers the whole viewport — the command
 * palette, the keyboard-shortcut list, and the panels this bar's own pills
 * portal out of it — which must cover this too. (The offline overlay covers it
 * as well and is not in that list: it is a modal `<dialog>` in the top layer,
 * which is above every number this table has — ./layer.ts says so.) It is the
 * one layer whose number is not a round ten, because it is defined by the two
 * it sits between. A positioned bar with a z-index is a stacking context, which
 * is why NOTHING in the bar opens inside it any more: the theme popover used
 * to, and rode at 45 with it, and its replacement
 * (`settings/`) portals to the body the way the commit panel and a tip already
 * did. A 3rem box is not somewhere a panel can hang out of.
 */

import { Show } from "solid-js"

import { Toggle as ChatToggle } from "./chat/Panel.tsx"
import { Leaf } from "./Leaf.tsx"
import { WORDMARK } from "./look.ts"
import { Commit } from "./commit/Commit.tsx"
import { Indicator } from "./connection/Indicator.tsx"
import { LAYER } from "./layer.ts"
import { desktop } from "./layout/media.ts"
import { News } from "./News.tsx"
import type { Route } from "./routes.ts"
import { HeaderSearch } from "./search/HeaderSearch.tsx"
import { connectionReadout } from "./wire.ts"
import { Preferences } from "./settings/Preferences.tsx"
import { TESTID } from "./testids.ts"
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
  /**
   * How to go where a search result points. Absent on the screens with no
   * router under them — the error report and the waiting page — where the bar
   * still draws its pills and simply has no search box: a door that could not
   * open anywhere is worse than no door.
   */
  readonly go?: (route: Route) => void
}) {
  return (
    <>
    <header
      class={`sticky top-0 ${LAYER.header} olai-frame flex h-[var(--height-header)] shrink-0 items-center gap-2 border-b-2 border-accent px-3 font-sans md:px-6`}
      data-testid={TESTID.appHeader}
      data-layout={props.docked ? "docked" : "chrome-only"}
    >
      <div class="flex shrink-0 items-center gap-2">
        <Show when={props.menu}>
          {(menu) => (
            <button
              type="button"
              class={`${TARGET_BOX} -ml-2 inline-flex items-center justify-center rounded text-paper/70 hover:text-paper md:hidden`}
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
        <h1 class={WORDMARK}>
          <Leaf class="size-4 text-accent md:size-5" />
          olai
        </h1>
      </div>

      {/* The pills that are about the app rather than about the page. On
          desktop they are always here, so a reader of the error report still
          has the connection answer — which is the one they want most of all.
          On a phone they are not: search is the only control that stays, and
          the rest become news under the bar or a row in the drawer
          (`./News.tsx`, `settings/` in the closet).

          The Commit pill sits BESIDE the connection because they are the same
          kind of promise about two halves of the same page: that it is still
          reading, and that what is written to it is being kept. There is ONE
          of it, which is the whole of `one-git-indicator`: #108's `● git`
          readout used to sit between them answering the second question a
          second time, and two chips for one subject is what the human filed.
          Every state that readout drew is a face of this pill now — including
          the fault, with git's own words on its tip.

          The preferences trigger is LAST, and it is one control rather than
          two: the theme pill that used to be here is a row inside the panel it
          opens (`settings/`). A door beside a door into the same room is the
          same redundancy `one-git-indicator` closed. */}
      <div
        // `gap-1` below 40rem rather than `gap-1.5`: the pills at 390pt spend a
        // gap between each pair, and 6px of white space is a word on the label
        // that gives way first. The bar's own spacing is the last thing to
        // spend before the order below starts costing a reader words.
        class="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1 sm:gap-2"
        data-testid={TESTID.appChrome}
      >
        {/* FIRST in the cluster, and the one control here that may shrink to
            nothing: it takes what is left after the pills have their floors,
            so nothing a reader came for gives way to it. On a phone it is the
            magnifier instead, which opens the palette — see
            `search/HeaderSearch.tsx` for both arguments. */}
        <Show when={props.go}>
          {(go) => <HeaderSearch go={go()} />}
        </Show>
        <Show when={desktop()}>
          <Indicator readout={connectionReadout()} />
          <Commit />
          <ChatToggle />
          <Preferences />
        </Show>
        {/* Phone screens with no directory drawer (the error report, the
            waiting page) still need a door into preferences. When the
            drawer exists the trigger lives at the foot of it. */}
        <Show when={!desktop() && props.menu === undefined}>
          <Preferences />
        </Show>
      </div>
    </header>
    <News />
    </>
  )
}
