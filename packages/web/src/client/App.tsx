/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one page open.
 *
 * Layout principle: the header carries what is about the APP (wordmark,
 * connection, agent, preferences); the sidebar carries what is about the DIRECTORY
 * (the agenda, the calendar, the file tree), collapsing to an icon rail when
 * minimized; chat is a resizable dock or a minimized pill/strip. All layout
 * state is client-local.
 *
 * This file is the composition and nothing else — the subscription, the route,
 * the clock, the one derivation of the set, which page that adds up to, and the
 * rows that page draws.
 */

import { agendaOf, dailyNoteDays, datedDays } from "@olai/format"
import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js"

import { AgendaPage } from "./agenda/AgendaPage.tsx"
import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Commit } from "./commit/Commit.tsx"
import { Connection } from "./connection/Connection.tsx"
import { CLEARANCE } from "./connection/Indicator.tsx"
import { DayPage } from "./day/DayPage.tsx"
import { DocumentPage } from "./document/DocumentPage.tsx"
import { DerivedProvider } from "./derived.tsx"
import { createDocuments, DocumentsProvider } from "./document/documents.tsx"
import { createUndo, UndoContext } from "./edit/undoing.ts"
import { UndoSaid } from "./edit/UndoSaid.tsx"
import { Banner } from "./errors/Banner.tsx"
import { FilterBar } from "./filter/FilterBar.tsx"
import { NarrowedProvider } from "./filter/narrowed.tsx"
import { createNarrowing } from "./filter/narrowing.ts"
import { taggedBy } from "./filter/tag.ts"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { publishLayoutCss } from "./layout/css.ts"
import { desktop } from "./layout/media.ts"
import { chatOpen, sidebarOpen, toggleSidebar } from "./layout/prefs.ts"
import { Rail } from "./layout/Rail.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { OpensProvider } from "./opens.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, opensAt, pageOf, rowsFor } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { Palette } from "./palette/Palette.tsx"
import { createRouter, followed, RouterProvider } from "./router.tsx"
import { filterOf, narrowable, narrowedTo, samePage } from "./routes.ts"
import { runAsync } from "./run.ts"
import { ServedProvider } from "./served.tsx"
import { visible } from "./settings/done.ts"
import { Sidebar } from "./Sidebar.tsx"
import { TodayProvider } from "./today.tsx"
import { TrashPage } from "./trash/TrashPage.tsx"
import { connectionReadout, olai } from "./wire.ts"

export default function App() {
  const outlines = createOutlines()
  const documents = createDocuments()
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const today = createToday()

  // Mobile drawer open state. Ephemeral: a reload starts shut so the outline
  // has the screen. Desktop open/rail is `sidebarOpen` in layout prefs.
  const [menuOpen, setMenuOpen] = createSignal(false)

  // Publish --width-sidebar / --width-chat from the preference signals.
  publishLayoutCss()

  // When the viewport crosses the phone/desktop line, shut the mobile drawer
  // so a resize does not leave a scrim stuck on a laptop.
  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const problems = () => errors.value() ?? []

  // WHICH PAGE IS OPEN, and deliberately not what it is narrowed by: the
  // filter rides the address, so a query typed one character at a time mints a
  // fresh `Route` per keystroke — and without this every one of them would
  // re-resolve the id, re-walk the tree and mint a row per node, for a page
  // that has not changed. `samePage` asks that through the address bijection
  // (`./routes.ts`).
  const opened = createMemo(router.route, undefined, { equals: samePage })

  // WHAT THE DIRECTORY HOLDS, as one value: the outlines, the bodied files and
  // the ones that would not parse. A memo rather than an object built inside
  // `page` below, because two readers want it now — the page model, and the
  // lookup a `.html` preview asks when a reader clicks a link inside it
  // (`./opens.tsx`) — and a second copy assembled beside the frame would be a
  // second answer to "does this directory hold that file".
  const found = createMemo(() => ({
    files: outlines.files(),
    documents: documents.paths(),
    broken: outlines.broken(),
  }))

  const page = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined
      ? undefined
      : pageOf(indexes, found(), opened(), today())
  })

  // ONE READING OF WHAT IS OWED, and it is not the agenda page's.
  //
  // Two things show it now — the page that lists it, and the directory entry
  // that marks it (`Sidebar.tsx`, and `layout/Rail.tsx` when the column is
  // collapsed) — so a count derived beside the entry would be a second walk
  // over the same directory, free to say "2 overdue" over a page listing three.
  // It sits here for the reason the route and the indexes do: this file is the
  // composition, and a fact both a pane and the chrome beside it read belongs
  // to neither of them.
  //
  // It is read on EVERY page rather than on `/agenda`, which is the honest cost
  // of the mark and not an accident: the column is on every screen, so the
  // answer is wanted on every screen. `agendaOf` is one bucketed walk over the
  // dated nodes of a set the derivation has already built.
  //
  // And it MOVES on both of its inputs: a revision the store publishes (a task
  // marked done clears the alarm with no reload) and `today()` rolling over at
  // the local midnight — the same clock the calendar's ring follows, because
  // there is only the one (`clock.ts`).
  const agenda = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? undefined : agendaOf(indexes, today())
  })

  const dated = (month: string): ReadonlySet<string> => {
    const indexes = outlines.derived()
    return indexes === undefined ? new Set() : datedDays(indexes, month)
  }

  // The calendar's second mark, off the documents' key set rather than off the
  // derivation: which days have a note is a question about FILENAMES, and the
  // paths are what every tab holds (`document/documents.tsx`).
  const noted = (month: string): ReadonlySet<string> =>
    dailyNoteDays(documents.paths(), month)

  // The page's rows at three stages, and each one is read by somebody:
  // everything the page holds, what this READER looks at (the done
  // preference), and what the query left of that. The order is argued in
  // `./filter/narrowing.ts` — a preference about the reader goes before a
  // question about the page.
  const allRows = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? [] : rowsFor(indexes, page())
  })
  const shownRows = createMemo(() => visible(allRows()))

  const narrowing = createNarrowing({
    derived: outlines.derived,
    text: () => filterOf(router.route()),
    all: allRows,
    visible: shownRows,
    // The one clock this tab has (./clock.ts), which is what `date:today` in
    // the box counts from — and it moves, so a page left open past midnight
    // narrows to the new day rather than to the one it was opened on.
    today,
  })
  const rows = narrowing.rows

  /** Typing in the filter box, and pressing a `#tag`, are the same act: the
   *  address of this page changes, and the entry is REPLACED rather than
   *  pushed (`./router.tsx`'s `replace` says why). */
  const narrow = (text: string): void => {
    router.replace(narrowedTo(router.route(), text))
  }

  const docked = () => outlines.manifest() !== null && page() !== undefined

  // WHICH NODE THE PALETTE MAY WRITE ABOUT, and it is the open page's answer
  // rather than a second one: the zoom is already resolved here, so the op
  // rows are about the node whose heading the reader is looking at, and there
  // are none of them on any other page (`palette/ops.ts`). `undefined` also
  // covers an id that names no page — a mirror chain that died, a node
  // nothing declares — because there is no subject to write about then either.
  const zoomed = createMemo(() => {
    const open = page()
    if (open === undefined) return undefined
    const node = only(open, "node")
    return node === undefined ? undefined : only(node.zoomed, "node")
  })

  // Undo is the OUTLINE's, and it is held HERE rather than beside the editor
  // (`edit/Editable.tsx`, where a draft lives for the reason its own header
  // gives) because its two keys are global chords, and the one window listener
  // that answers those is a sibling of the page rather than inside it — a
  // context cannot reach sideways, so a page-scoped stack would be a stack
  // ⌘Z could not spend. What the page owns instead is when it ENDS: cleared
  // when the reader opens another outline, because a stack of ops on rows that
  // are not on screen is a stack nobody could predict the effect of.
  // The wire is handed in HERE — `undoing.ts` keeps no import of it, so its
  // stack rules stay checkable by a unit test that never dials anything.
  const undo = createUndo((edit) => runAsync(olai.procedures.edit.apply(edit)))
  // A MEMO, and it is load-bearing: `page()` is minted afresh on every
  // revision the store publishes, so an effect tracking it directly would
  // clear the stack on every write — including, in the frame it arrives, the
  // write that has just been recorded into it. What the stack cares about is
  // the FILE, which a memo only reports when it actually changes.
  //
  // `undefined` for the pages that are not one outline (a day, a document that
  // is not an outline, nothing found) is the right answer rather than a hole:
  // arriving at one clears the stack, and no page but an outline's can put
  // anything back into it — there is no editor to record from.
  const openFile = createMemo(() => {
    const open = page()
    return open === undefined ? undefined : fileOf(open)
  })
  createEffect(on(openFile, () => undo.clear(), { defer: true }))

  return (
    <UndoContext.Provider value={undo}>
      {/* The route and the set's indexes wrap the WHOLE app rather than the
          open page, because they are facts about neither: an address is what
          this tab is looking at, and the indexes are one derivation of the
          directory. Both used to sit inside the page's own `<Match>`, which
          was fine while the page was the only thing that read them — the chat
          panel is a sibling of it (it draws in every shape of the app, error
          view included), and it reads both now: a node named in the transcript
          reads its title out of the indexes and, when the node is not on this
          page, goes to its own address. Threading either down to it as a prop
          is what `./derived.tsx`'s own header rules out. */}
      <RouterProvider router={router}>
      <DerivedProvider derived={outlines.derived()}>
      {/* Where a vault PATH opens, for the one surface handed one rather than an
          address: a link clicked inside a `.html` preview (./opens.tsx). */}
      <OpensProvider opens={(path, at) => opensAt(found(), path, at)}>
      {/* What the directory HOLDS, by path — the sidebar's two key sets as one
          list. It wraps the whole app for the chat panel's sake: the composer
          completes a path into a message when somebody types `@`, and it is
          five levels under here inside whichever chat shell this viewport
          draws (`./served.tsx`). */}
      <ServedProvider outlines={found().files} documents={found().documents}>
      <Connection readout={connectionReadout()} />
      <ChatPanel />
      <Palette
        zoomed={zoomed()}
        go={(route) => router.go(route)}
        toggleDirectory={() => {
          // Desktop: open/rail preference. Phone: ephemeral drawer — do not
          // flip the desktop preference a phone cannot show.
          if (desktop()) toggleSidebar()
          else setMenuOpen(!menuOpen())
        }}
      />
      <UndoSaid said={undo.said()} />
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
        {/* The drawer is fixed, so the page reserves its width from `lg` up —
            below that the dock covers the page (same bar as before this rework). */}
        <div
          class="flex-1"
          classList={{ "lg:pr-[var(--width-chat)]": chatOpen() }}
        >
          <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
          <Match when={outlines.manifest() === null}>
            <ErrorPage errors={problems()} />
          </Match>
          <Match when={page()}>
            {(open) => (
                <TodayProvider today={today()}>
                <DocumentsProvider documents={documents}>
                  {/*
                    Desktop: two columns (rail or full sidebar + main), widths
                    from --width-sidebar. Mobile: main alone; the directory is
                    a fixed drawer and must not claim a grid track.

                    The directory column is `sticky` (Sidebar.tsx, layout/
                    Rail.tsx), so this row is its containing block and NO box
                    from here up to the document may take an `overflow` other
                    than `visible` — the same condition the header's own
                    stickiness rests on, and the reason the two boxes above
                    this one are plain flex containers. `main` is a SIBLING and
                    was not on that path, which is why it was free to be a
                    scroll container until the outline grew a sticky thing of
                    its own (see `main`'s own note below).
                  */}
                  <div class="relative min-h-[calc(100dvh-var(--height-header))] md:grid md:grid-cols-[var(--width-sidebar)_1fr]">
                    <Show when={desktop() && !sidebarOpen()}>
                      <Rail go={(route) => router.go(route)} agenda={agenda()} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
                      <Sidebar
                        files={outlines.files()}
                        documents={documents.paths()}
                        active={fileOf(open())}
                        broken={outlines.broken()}
                        agenda={agenda()}
                        open={desktop() ? true : menuOpen()}
                        onClose={() => setMenuOpen(false)}
                      >
                        <Calendar
                          today={today()}
                          open={only(open(), "day")?.date}
                          days={dated}
                          noted={noted}
                        />
                      </Sidebar>
                    </Show>
                    {/* Extra bottom pad on phone when the chat strip is up so
                        the last lines of a long page are not trapped under it. */}
                    {/*
                      `overflow-x-clip`, and the ONE letter of difference from
                      the `auto` it was is load-bearing. `auto` makes this box a
                      scroll container in BOTH axes, and a `position: sticky`
                      descendant sticks to its nearest scrollport — which here
                      is this box, whose height is its content's and which
                      therefore never scrolls. So every sticky thing inside the
                      page was inert, silently: the outline's section headings
                      (`Tree.tsx`) simply did not stick, with nothing on screen
                      to say why. `clip` clips without scrolling, so the
                      scrollport is the DOCUMENT again — which is what this app
                      scrolls, and what the header above already sticks to.

                      What is given up is the sideways scrollbar this box used
                      to grow for content wider than the pane, and nothing wants
                      it: a fence, a table and a `.html` preview each scroll
                      WITHIN themselves (`styles.css`), prose breaks anywhere,
                      and a tree row's title ELLIPSIZES rather than pushing the
                      line wider (`NodeLine.tsx`). The clip is the backstop for
                      whatever is left.

                      `min-w-0` IS THE OTHER HALF OF THAT ONE LETTER, and
                      leaving it out looked like a horizontal scrollbar across
                      the whole window (human, on the branch). This box is a GRID
                      ITEM in the `1fr` column, and `1fr` means
                      `minmax(auto, 1fr)` — so the column refuses to go narrower
                      than its content's MIN-CONTENT width unless the item says
                      it may. A scroll container's min-content width is zero,
                      which is what `overflow-x-auto` was quietly supplying;
                      `clip` supplies nothing, so the column grew to fit the
                      longest title, the document grew with it, and no title
                      ever reached the width at which it would ellipsize. The
                      two have to be written together.
                    */}
                    {/*
                      A COLUMN: the page's own chrome (a banner, the filter
                      box), then the page, which fills what is left. It was a
                      block, and the page filled the pane with `min-height:
                      100%` — a circular percentage against an auto-height
                      parent, which resolved to a height computed WITHOUT the
                      box and overflowed the pane by exactly the filter bar
                      (`edit/Editable.tsx` has the rest of it). A flex fill says
                      the same thing with nothing circular in it.
                    */}
                    <main
                      class={`flex min-w-0 flex-col overflow-x-clip px-4 pt-4 ${CLEARANCE} md:px-12 md:py-8 lg:pl-16 lg:pr-12 ${
                        !desktop() && !chatOpen() ? "pb-16" : ""
                      }`}
                      // Whether a `#tag` in here is pressable — one fact, read
                      // by the pill's cursor (`styles.css`) and by the listener
                      // below, so the two cannot promise different things.
                      data-narrowable={narrowable(router.route()) ? "true" : undefined}
                      // A link in RENDERED MARKDOWN is an anchor no component
                      // owns — it arrives through `innerHTML` — so the one
                      // that names a document of this directory is answered
                      // here, in place, rather than by throwing the document
                      // away (`router.tsx`'s `followed`). One listener for the
                      // pane rather than one per rendered block, and everything
                      // it does not claim behaves exactly as the browser's.
                      //
                      // The SAME listener answers a press on a `#tag`, and for
                      // the same reason: a tag pill arrives through
                      // `innerHTML` too, so it belongs to no component
                      // (./filter/tag.ts). A tag filters this page rather than
                      // navigating, so it is answered before a link is looked
                      // for — a pill is never inside an `<a>` (the tag walk
                      // skips anchors), so the two can never both claim one
                      // press.
                      onClick={(event) => {
                        // ...and only where the press has somewhere to go. A
                        // day page draws tags too and its address has nowhere
                        // to keep a filter, so the press is left alone rather
                        // than claimed and dropped — the same condition the
                        // pill's own cursor is drawn on (`styles.css`).
                        const tag = narrowable(router.route())
                          ? taggedBy(event)
                          : null
                        if (tag !== null) {
                          event.preventDefault()
                          narrow(tag)
                          return
                        }
                        const route = followed(event)
                        if (route === null) return
                        event.preventDefault()
                        router.go(route)
                      }}
                    >
                      <Show when={problems().length > 0}>
                        <Banner errors={problems()} />
                      </Show>
                      {/* The filter, on the two routes that may carry one
                          (./routes.ts). Above the page rather than inside each
                          of them, because an outline and a zoomed node are the
                          same kind of page narrowed the same way — and the
                          provider wraps everything below so a row can ask
                          whether it matched without being told. */}
                      <NarrowedProvider narrowed={narrowing}>
                      <Show
                        when={open().kind === "outline" || open().kind === "node"}
                      >
                        <FilterBar narrowing={narrowing} onType={narrow} />
                      </Show>
                      <Switch>
                        <Match when={only(open(), "broken")}>
                          {(file) => <Broken file={file().file} />}
                        </Match>
                        <Match when={only(open(), "node")}>
                          {(node) => (
                            <NodePage zoomed={node().zoomed} rows={rows()} />
                          )}
                        </Match>
                        <Match when={only(open(), "outline")}>
                          {(outline) => (
                            <OutlinePage
                              file={outline().file}
                              rows={rows()}
                            />
                          )}
                        </Match>
                        <Match when={only(open(), "document")}>
                          {(open) => <DocumentPage file={open().file} />}
                        </Match>
                        <Match when={only(open(), "day")}>
                          {(open) => (
                            <DayPage
                              date={open().date}
                              groups={open().groups}
                              notes={open().notes}
                              today={today()}
                            />
                          )}
                        </Match>
                        <Match when={only(open(), "agenda")}>
                          {(open) => (
                            // The reading is the app's (above), not the arm's —
                            // the same value the entry in the column is marked
                            // from. `Show` because it is typed for the frame
                            // before the first snapshot; this page is not drawn
                            // in that frame (nothing is), so the fallback is a
                            // promise about the code rather than a sight.
                            <Show when={agenda()}>
                              {(reading) => (
                                <AgendaPage agenda={reading()} today={open().date} />
                              )}
                            </Show>
                          )}
                        </Match>
                        <Match when={only(open(), "trash")}>
                          {(open) => <TrashPage files={open().files} />}
                        </Match>
                        <Match when={only(open(), "nothing")}>
                          {(nothing) => (
                            <Nothing
                              sought={nothing().sought}
                              requested={nothing().requested}
                            />
                          )}
                        </Match>
                      </Switch>
                      </NarrowedProvider>
                    </main>
                  </div>
                </DocumentsProvider>
                </TodayProvider>
            )}
            </Match>
          </Switch>
        </div>
      </div>
      </ServedProvider>
      </OpensProvider>
      </DerivedProvider>
      </RouterProvider>
    </UndoContext.Provider>
  )
}
