/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one or more panes, each a full page.
 *
 * Layout principle: the header carries what is about the APP (wordmark,
 * connection, agent, preferences); the sidebar carries what is about the
 * DIRECTORY (the agenda, the calendar, the file tree), collapsing to an icon
 * rail when minimized; chat is a resizable dock or a minimized pill/strip.
 * The main column is a LIST of routes (`./workspace.ts`) — one pane is the
 * page this app has always been; two or more are the same page component
 * side by side, never a stripped copy.
 *
 * This file is the composition and nothing else — the subscription, the
 * workspace, the clock, the one derivation of the set, and the chrome
 * that sits outside every pane.
 */

import { agendaOf } from "@olai/format"
import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js"

import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { createOwed } from "./dates.ts"
import { Commit } from "./commit/Commit.tsx"
import { Offline } from "./connection/Offline.tsx"
import { DerivedProvider } from "./derived.tsx"
import { AirProvider, createAir } from "./drag/air.ts"
import { createFields, FieldsProvider } from "./drag/fields.ts"
import { unreachable } from "./connection/reaching.ts"
import { createRefiling } from "./fold/refiling.ts"
import { createDocuments, DocumentsProvider } from "./document/documents.tsx"
import { createUndo, UndoContext } from "./edit/undoing.ts"
import { UndoSaid } from "./edit/UndoSaid.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { publishLayoutCss } from "./layout/css.ts"
import { desktop } from "./layout/media.ts"
import { chatOpen, sidebarOpen, toggleSidebar } from "./layout/prefs.ts"
import { Rail } from "./layout/Rail.tsx"
import { only } from "./narrow.ts"
import { byFacePath } from "./paths.ts"
import { OpensProvider } from "./opens.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, opensAt, pageOf } from "./page.ts"
import { Palette } from "./palette/Palette.tsx"
import { PinsProvider } from "./pins/answered.tsx"
import { pinSaid } from "./pins/pinning.ts"
import { Panes } from "./pane/Panes.tsx"
import { SHEET, SHELL_LONE, SHELL_SPLIT } from "./layout/sheet.ts"
import { createRouter, RouterProvider } from "./router.tsx"
import { runAsync } from "./run.ts"
import { ServedProvider } from "./served.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { TodayProvider } from "./today.tsx"
import { connectionReadout, olai } from "./wire.ts"
import { isLone } from "./workspace.ts"

export default function App() {
  const outlines = createOutlines(
    olai.collections.outlines.use(),
    olai.cells.manifest.use().value,
  )
  /** Every editable page on screen, for the one gesture that is about more
   *  than the page it began in: a row dragged out of one pane and dropped in
   *  the next (`./drag/fields.ts`). The WORKSPACE owns it because the drag is
   *  the workspace's; each page joins as it mounts and leaves with itself. */
  const fields = createFields()
  /** What a live drag is carrying, for the WORKSPACE rather than for the pane
   *  the press landed in: the same rows may be drawn in two panes at once, and
   *  both have to show them lifted (`./drag/air.ts`). */
  const air = createAir()
  const documents = createDocuments()
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const today = createToday()

  const [menuOpen, setMenuOpen] = createSignal(false)

  publishLayoutCss()

  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const problems = () => errors.value() ?? []

  /**
   * Whether there is a set at all — the manifest's three states (no frame yet,
   * never loaded, a directory) folded to the one bit every reader below needs.
   *
   * ONE SPELLING, and it is worth a name because there were about to be two:
   * a question worth asking the server about (`owed`, below) and the chrome
   * that only draws over a directory (`docked`) are the same bit, and the two
   * predicates this replaces differed on the frame before the first — the
   * exact shape of divergence a second spelling exists to produce. The one
   * reader that genuinely needs all THREE states is the `Switch` below, which
   * has to tell "still reading" from "never loaded"; it asks the manifest
   * itself, because folding is what this is and that reader is not folding.
   */
  const loaded = () => {
    const manifest = outlines.manifest()
    return manifest !== undefined && manifest !== null
  }

  /**
   * THE DIRECTORY, as one collection of faces — what every page model question
   * is asked of (`./page.ts`).
   *
   * The two collections stay two on the wire, because an outline's records
   * travel with it and a document's body does not; they are ONE list from here
   * up, in the directory's own order, so nothing above has to pick which half
   * of a directory it was thinking about.
   */
  const found = createMemo(() => ({
    documents: byFacePath([...outlines.faces(), ...documents.faces()]),
    broken: outlines.broken(),
  }))

  // The FOCUSED pane's page — what the sidebar lights up, what the palette
  // may write about, what undo treats as the open file. Each pane resolves
  // its own page inside `./pane/PageView.tsx`; this is the one the chrome
  // beside the workspace has to agree with, and it is asked of the focused
  // route so a click in the directory never targets "leftmost".
  const focusedPage = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined
      ? undefined
      : pageOf(indexes, found(), router.route(), today())
  })

  /**
   * THE AGENDA PAGE's own reading, and nothing else's.
   *
   * It used to feed the sidebar's mark as well, through `owedOf`. That half is
   * the server's now (`./dates.ts`, and `docs/brainstorming/vault-in-browser.md`
   * §3's Sidebar row): the column and the rail wear two integers off the wire,
   * so nothing outside the page walks the set to count late work.
   *
   * WHAT IS LEFT IS THE PAGE, and it is left DELIBERATELY rather than missed.
   * `/agenda` is one of the seven ROUTES, and the design's law forbids flipping
   * routes one at a time — the old wire kept beside the new — so every page
   * reading moves in PR 10 or none of them does. Until then the badge and the
   * page it leads to are two callers of one function (`owedOf` over
   * `agendaOf`) over one directory, which is why they can differ by at most a
   * frame and never by an opinion.
   */
  const agenda = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? undefined : agendaOf(indexes, today())
  })

  /**
   * The day the counts are asked FOR, or `undefined` while there is nothing to
   * ask about.
   *
   * A MEMO rather than the expression written into the call below, and that is
   * not tidiness: a subscription re-opens whenever its input NOTIFIES, not when
   * the input's value changes, so an inline reading of the manifest would tear
   * the stream down and blank the badge on any frame that cell moved. A memo
   * over a string makes that impossible.
   */
  const askedOn = createMemo(() => (loaded() ? today() : undefined))

  /**
   * What the column and the rail wear — the app's ONE subscription to it, so
   * the two faces of the directory cannot say different numbers (`./dates.ts`).
   *
   * ASKED ONLY OF A DIRECTORY THAT LOADED, which is the gate the walk it
   * replaced carried inline: a set that never loaded gets the error report
   * instead of a column, so there is no mark on screen to answer and a question
   * asked anyway would be a refused subscription ambering the connection pill
   * over a page where nothing is missing.
   *
   * The MONTH's dots are not here: their question is the month the calendar
   * itself is showing, so that subscription lives with the state that decides
   * it (`./calendar/Calendar.tsx`) — and the calendar is only ever mounted
   * under the same gate, one branch down.
   */
  const owed = createOwed(askedOn)

  /**
   * This browser's fold memory, kept filed against the set — a node that moved
   * keeps its fold under the file it moved to, and a node that is gone stops
   * being remembered (`./fold/refiling.ts`).
   *
   * HERE rather than beside `followFolds()` in `main.tsx`, which is where the
   * rest of the fold's wiring is started: this one is a computation over two
   * signals and Solid only owns a computation inside a render. Nothing on
   * screen reads it and it returns nothing — the memory it tidies is read
   * wherever a row asks `collapsedNodes`, exactly as before.
   *
   * THE WIRE IS HANDED IN, exactly as `createUndo` below is handed its write:
   * that module is a rule about when to ask and what to believe, and one that
   * could only be exercised by pressing a triangle in a browser is one nothing
   * checks. This is the caller that has a wire.
   */
  createRefiling({
    ask: (request) => runAsync(olai.procedures.nodes.homes(request)),
    offline: () => unreachable(connectionReadout()),
  })

  const zoomed = createMemo(() => {
    const open = focusedPage()
    if (open === undefined) return undefined
    const node = only(open, "node")
    return node === undefined ? undefined : only(node.zoomed, "node")
  })

  const undo = createUndo((edit) => runAsync(olai.procedures.edit.apply(edit)))
  const openFile = createMemo(() => {
    const open = focusedPage()
    return open === undefined ? undefined : fileOf(open)
  })
  createEffect(on(openFile, () => undo.clear(), { defer: true }))

  const docked = () => loaded() && focusedPage() !== undefined
  const split = () => !isLone(router.workspace())

  return (
    <UndoContext.Provider value={undo}>
      <RouterProvider router={router}>
      <DerivedProvider derived={outlines.derived()}>
      {/* THE SHELF, as the server answers it — a subscription and a context,
          around everything that reads it: the sidebar draws it, the palette's
          row and the ⌘⇧P chord ask whether this page is on it, and every row's
          ••• asks the same about its node (./pins/answered.tsx). */}
      <PinsProvider>
      <FieldsProvider value={fields}>
      <AirProvider value={air}>
      <OpensProvider opens={(path, at) => opensAt(found(), path, at)}>
      <ServedProvider faces={found().documents}>
      {/* ABOVE THE CHAT PANEL, not only around the page: today is a fact about
          the TAB (`./clock.ts`), and the panel reads it too — the `@` list's
          node half is matched by the format's own grammar, whose relative words
          (`@date:today`) count from the day the reader is standing on. Under
          the page's own arm, as it was, the composer's only way to that day
          would be a second `createToday()` — a second midnight timer and a
          second answer to what day it is, in a tab that is supposed to have
          one. */}
      <TodayProvider today={today()}>
      {/* THE FREEZE, over everything — the app takes no gesture at all while
          the wire cannot carry a question (`./connection/Offline.tsx`, the
          human's §5b ruling). It is drawn beside the chrome rather than inside
          the page's arm because it covers the chrome too; WHERE it sits in this
          composition decides nothing about what it paints over, because it is a
          `<dialog>` in the top layer rather than a box with a number on it. */}
      <Offline readout={connectionReadout()} />
      <ChatPanel />
      <Palette
        zoomed={zoomed()}
        go={(route) => router.go(route)}
        toggleDirectory={() => {
          if (desktop()) toggleSidebar()
          else setMenuOpen(!menuOpen())
        }}
      />
      {/* ONE LINE for the two gestures in this app that have no row to hang
          one under: ⌘Z, which is pressed with no draft open, and the shelf's
          (⌘⇧P and the sidebar's own controls), which is pressed at whatever
          page the reader is looking at and may be refused before there is a
          shelf drawn to say so. The pin's is the one that fades — it takes
          itself away after the usual dwell, where an undo's stands until the
          next ⌘Z — so "the newer of the two" is what this reads as in
          practice, and the older one is still there when it goes. */}
      <UndoSaid said={pinSaid() ?? undo.said()} />
      {/* No ground of its own: `html` is already ink (./styles.css), and what
          shows through here — the strip under a sticky spine on a page taller
          than the viewport — is that same forest either way. */}
      <div class="flex min-h-dvh flex-col">
        <AppHeader
          docked={docked()}
          go={(route) => router.go(route)}
          menu={
            docked()
              ? {
                  open: menuOpen(),
                  onToggle: () => setMenuOpen(!menuOpen()),
                }
              : undefined
          }
        />
        <div
          class="flex-1"
          classList={{
            "lg:pr-[var(--width-chat)]": chatOpen(),
            "min-h-0": split(),
          }}
        >
          <Switch fallback={<p class={`${SHEET} p-8 text-muted`}>Reading…</p>}>
          <Match when={outlines.manifest() === null}>
            <ErrorPage errors={problems()} />
          </Match>
          <Match when={focusedPage()}>
            {(open) => (
                <DocumentsProvider documents={documents}>
                  <div
                    class="relative md:grid md:grid-cols-[var(--width-sidebar)_1fr]"
                    classList={{
                      [SHELL_SPLIT]: split(),
                      [SHELL_LONE]: !split(),
                    }}
                  >
                    <Show when={desktop() && !sidebarOpen()}>
                      <Rail go={(route) => router.go(route)} owed={owed()} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
                      <Sidebar
                        active={fileOf(open())}
                        broken={outlines.broken()}
                        owed={owed()}
                        open={desktop() ? true : menuOpen()}
                        onClose={() => setMenuOpen(false)}
                      >
                        <Calendar today={today()} open={only(open(), "day")?.date} />
                      </Sidebar>
                    </Show>
                    <Panes
                      derived={outlines.derived()}
                      found={found()}
                      today={today()}
                      agenda={agenda()}
                      problems={problems()}
                    />
                  </div>
                </DocumentsProvider>
            )}
            </Match>
          </Switch>
        </div>
      </div>
      </TodayProvider>
      </ServedProvider>
      </OpensProvider>
      </AirProvider>
      </FieldsProvider>
      </PinsProvider>
      </DerivedProvider>
      </RouterProvider>
    </UndoContext.Provider>
  )
}
