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

import { dailyNoteDays, datedDays } from "@olai/format"
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
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { publishLayoutCss } from "./layout/css.ts"
import { desktop } from "./layout/media.ts"
import { chatOpen, sidebarOpen, toggleSidebar } from "./layout/prefs.ts"
import { Rail } from "./layout/Rail.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, pageOf, rowsFor } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { Palette } from "./palette/Palette.tsx"
import { createRouter, followed, RouterProvider } from "./router.tsx"
import { runAsync } from "./run.ts"
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

  const page = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? undefined : pageOf(
      indexes,
      {
        files: outlines.files(),
        documents: documents.paths(),
        broken: outlines.broken(),
      },
      router.route(),
      today(),
    )
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

  const rows = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? [] : visible(rowsFor(indexes, page()))
  })

  const docked = () => outlines.manifest() !== null && page() !== undefined

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
      <Connection readout={connectionReadout()} />
      <ChatPanel />
      <Palette
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
                    this one are plain flex containers. `main`'s
                    `overflow-x-auto` is a SIBLING and is not on that path.
                  */}
                  <div class="relative min-h-[calc(100dvh-var(--height-header))] md:grid md:grid-cols-[var(--width-sidebar)_1fr]">
                    <Show when={desktop() && !sidebarOpen()}>
                      <Rail go={(route) => router.go(route)} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
                      <Sidebar
                        files={outlines.files()}
                        documents={documents.paths()}
                        active={fileOf(open())}
                        broken={outlines.broken()}
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
                    <main
                      class={`overflow-x-auto px-4 pt-4 ${CLEARANCE} md:px-12 md:py-8 lg:pl-16 lg:pr-12 ${
                        !desktop() && !chatOpen() ? "pb-16" : ""
                      }`}
                      // A link in RENDERED MARKDOWN is an anchor no component
                      // owns — it arrives through `innerHTML` — so the one
                      // that names a document of this directory is answered
                      // here, in place, rather than by throwing the document
                      // away (`router.tsx`'s `followed`). One listener for the
                      // pane rather than one per rendered block, and everything
                      // it does not claim behaves exactly as the browser's.
                      onClick={(event) => {
                        const route = followed(event)
                        if (route === null) return
                        event.preventDefault()
                        router.go(route)
                      }}
                    >
                      <Show when={problems().length > 0}>
                        <Banner errors={problems()} />
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
                            <AgendaPage agenda={open().agenda} today={open().date} />
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
                    </main>
                  </div>
                </DocumentsProvider>
                </TodayProvider>
            )}
            </Match>
          </Switch>
        </div>
      </div>
      </DerivedProvider>
      </RouterProvider>
    </UndoContext.Provider>
  )
}
