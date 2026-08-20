/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one or more panes, each a full page.
 *
 * Layout principle: the header carries what is about the APP (wordmark, and
 * on desktop the connection, git, agent, preferences). On a phone those four
 * leave the bar: connection and git are banners when they are news, the agent
 * is the thumb strip, preferences live in the directory drawer. The sidebar
 * carries what is about the DIRECTORY (the agenda, the calendar, the file
 * tree), collapsing to an icon rail when minimized; chat is a resizable dock
 * or a minimized pill/strip.
 * The main column is a LIST of routes (`./workspace.ts`) — one pane is the
 * page this app has always been; two or more are the same page component
 * side by side, never a stripped copy.
 *
 * This file is the composition and nothing else — the subscriptions, the
 * workspace, the clock, the directory, and the chrome that sits outside every
 * pane. What each PANE shows is a subscription of its own
 * (`./reading.tsx`), asked of the address that pane is drawing.
 */

import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js"

import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { createOwed } from "./dates.ts"
import { Offline } from "./connection/Offline.tsx"
import { createDirectory } from "./directory.ts"
import { AirProvider, createAir } from "./drag/air.ts"
import { createFields, FieldsProvider } from "./drag/fields.ts"
import { reachable } from "./connection/reaching.ts"
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
import { OpensProvider } from "./opens.tsx"
import { fileOf, opensAt, requestFor } from "./page.ts"
import { fileNamed } from "./routes.ts"
import { createNames } from "./names.ts"
import { createReadings, ReadingsProvider } from "./reading.tsx"
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
  /** THE DIRECTORY — every served file's path, title and breakage, and nothing
   *  else about the vault (`./directory.ts`). What this replaced was a
   *  subscription to every record of every outline, folded into a second copy
   *  of the whole set. */
  const directory = createDirectory(
    olai.collections.heads.use(),
    olai.cells.manifest.use().value,
  )
  /** Every open pane's own reading, for the chrome that has to agree with the
   *  FOCUSED one — the sidebar entry that lights up, the palette's write verbs,
   *  undo's idea of the open file (`./reading.tsx`). Each pane joins as it
   *  mounts, exactly as it joins the drag register below. */
  const readings = createReadings()
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
   * that only draws over a directory (the header's `docked`) are the same bit,
   * and the two predicates this replaces differed on the frame before the
   * first — the exact shape of divergence a second spelling exists to produce.
   * A THIRD nearly appeared with the page readings and was collapsed into this
   * one rather than written: the chrome used to be gated on the focused PAGE
   * existing, which could only ever be true once a directory had loaded, and is
   * now a page each pane waits for where its own `Reading…` line is. The one
   * reader that genuinely needs all THREE states is the `Switch` below, which
   * has to tell "still reading" from "never loaded"; it asks the manifest
   * itself, because folding is what this is and that reader is not folding.
   */
  const loaded = () => {
    const manifest = directory.manifest()
    return manifest !== undefined && manifest !== null
  }

  /**
   * THE FOCUSED PANE's reading — the ONE thing the chrome outside the panes
   * takes from a page rather than from the address: what a `/#id` turned out to
   * name, and what the ids that page points at are called.
   *
   * READ OFF THE PANE rather than asked for again here, which is the whole
   * reason the register exists: each pane subscribes to the address it is
   * drawing, and a second subscription to the focused one would be the same
   * page fetched twice, on every revision, for the length of every split
   * workspace. `undefined` is a pane that has not mounted or has never been
   * answered — the frame where the chrome knows no file, which is what it drew
   * before the first snapshot in any case. It is NOT the beat a navigation
   * spends in flight: a reading holds its last answer across the next question
   * (`./reading.tsx`), so what this reads is what is on screen.
   *
   * AND IT IS ASKED LAST, which is this composition's rule since
   * `reactivity-after-the-flip`: where am I is the ROUTE's answer and it is
   * synchronous, so the entry that lights, the day the month opens on and the
   * page undo belongs to are read off the address that names them — and the
   * reading is consulted only for what an address cannot say. Derived from the
   * page instead, every one of them went `A → undefined → B` on every click:
   * the open file's folder chain folded and was rebuilt, the current wash went
   * out for a round trip, and undo's stack was cleared twice
   * (docs/brainstorming/reactivity-after-the-flip.md §3.1).
   */
  const focused = createMemo(() => readings.at(router.workspace().focus))

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
    reachable: () => reachable(connectionReadout()),
  })

  const zoomed = createMemo(() => {
    const shows = focused()?.shows
    if (shows === undefined) return undefined
    const node = only(shows, "node")
    return node === undefined ? undefined : only(node.zoomed, "node")
  })

  const undo = createUndo((edit) => runAsync(olai.procedures.edit.apply(edit)))

  /**
   * THE OPEN FILE — the sidebar entry that lights up, and the outline undo's
   * stack belongs to.
   *
   * THE ADDRESS ANSWERS IT wherever an address can: every file route names its
   * file (`./routes.ts`'s `fileNamed`), so the entry lights in the same frame the
   * link is clicked and the open folder above it never folds. What is left is
   * the two addresses that name no file — a `/#id`, whose canonical file is the
   * set's answer and not the URL's, and the front page, which is "whichever
   * outline was found first" — and those are read off the page, which is where
   * they were resolved (`./page.ts`'s `fileOf`).
   *
   * SO A ZOOM KEEPS THE STACK. `/house.olai` → `/#install` is one file
   * throughout: the address stops naming it and the page on screen still says
   * it, so this memo does not move and the effect below does not fire. It used
   * to fire twice per navigation — once on the blank and once on the answer —
   * which cleared the outline's undo stack for a zoom in or out of a node of the
   * outline being read, against `./edit/undoing.ts`'s own promise ("the edits
   * you made on this outline").
   */
  const openFile = createMemo(() => {
    const named = fileNamed(router.route())
    if (named !== undefined) return named
    const shows = focused()?.shows
    return shows === undefined ? undefined : fileOf(shows)
  })
  createEffect(on(openFile, () => undo.clear(), { defer: true }))

  /**
   * What the ids the FOCUSED page points at are called — the one field of a
   * reading the chrome outside the panes needs, for the shelf's ⌘K row: a
   * `/#id` page is called whatever that node is called right now
   * (`./pins/palette.ts`).
   *
   * A LOOKUP rather than the array, for `./names.ts`'s reason: one row asks one
   * id, and the table is built where it is answered — and held there while the
   * names hold, which is the same rule the panes read by.
   */
  const names = createNames(focused)

  /**
   * The day the calendar opens on, when the focused pane is a day page — the
   * cell that is filled, and the month the grid anchors to.
   *
   * THE ADDRESS ANSWERS THIS ONE WHOLE, and it is asked with the SAME function
   * the pane asks its own question with (`./page.ts`'s `requestFor`): a day page
   * is `/d/<date>`, which spells its day, or `/today`, which spells the day it
   * IS — and who says which day that is is the reader's own clock, which is why
   * that function takes it as an argument.
   *
   * READ THROUGH THE REQUEST rather than re-mapped here, so the month the grid
   * opens on and the page the pane asked for cannot come to two answers about
   * one address — and so the arms that say which routes name a day are
   * exhaustive over the route in exactly one place.
   *
   * Read off the PAGE, as it was, this went `day → undefined → day` on every
   * click of a second day: the month is stamped on the day being read
   * (`./calendar/Calendar.tsx`), so the grid flipped to today's month and back
   * on the way past, rebuilding all thirty-odd cells twice and tearing the
   * month's own subscription down with them.
   */
  const openDay = createMemo(() => only(requestFor(router.route(), today()), "day")?.date)

  const split = () => !isLone(router.workspace())

  return (
    <UndoContext.Provider value={undo}>
      <RouterProvider router={router}>
      {/* EVERY OPEN PANE'S READING, for the chrome that is about more than one
          page: the sidebar's active entry, the palette's verbs, undo's file
          (./reading.tsx). */}
      <ReadingsProvider value={readings}>
      {/* THE SHELF, as the server answers it — a subscription and a context,
          around everything that reads it: the sidebar draws it, the palette's
          row and the ⌘⇧P chord ask whether this page is on it, and every row's
          ••• asks the same about its node (./pins/answered.tsx). */}
      <PinsProvider>
      <FieldsProvider value={fields}>
      <AirProvider value={air}>
      <OpensProvider opens={(path, at) => opensAt(directory.faces(), path, at)}>
      <ServedProvider faces={directory.faces()} head={directory.head}>
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
        names={names()}
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
          docked={loaded()}
          go={(route) => router.go(route)}
          menu={
            loaded()
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
          <Match when={directory.manifest() === null}>
            <ErrorPage errors={problems()} />
          </Match>
          {/* THE GATE IS THE DIRECTORY, not the page. It used to be the focused
              page's own existence, which was the same bit said in a longer way:
              a page could only be resolved once the tab held a derivation, and a
              derivation only existed once the manifest had loaded. Each pane
              waits for its OWN answer now, where its own `Reading…` line is
              (./pane/PageView.tsx) — so a second pane opening does not blank the
              sidebar the first one is drawn beside. */}
          <Match when={loaded()}>
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
                        active={openFile()}
                        broken={directory.broken()}
                        owed={owed()}
                        open={desktop() ? true : menuOpen()}
                        onClose={() => setMenuOpen(false)}
                      >
                        <Calendar today={today()} open={openDay()} />
                      </Sidebar>
                    </Show>
                    <Panes problems={problems()} />
                  </div>
                </DocumentsProvider>
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
      </ReadingsProvider>
      </RouterProvider>
    </UndoContext.Provider>
  )
}
