/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one page open.
 *
 * The page is decided by the MANIFEST, which carries three answers — no frame
 * yet, a `null`, a value — and they are exactly the three things a reader can
 * be looking at: waiting, never-loaded, or reading. The outlines themselves are
 * a collection of per-file entries beside it (./outlines.ts), and the error
 * cell is a DETAIL of what is on screen and never the decision, because a
 * subscription arriving independently would otherwise disagree for a frame and
 * the page would flash the wrong story.
 *
 * Which is why a live store shows what is wrong in three different places, and
 * they are three because the reader is in three different situations:
 *
 *   - nothing ever loaded → the report IS the page (errors/Page.tsx);
 *   - it loaded and the files have since stopped validating → the last good
 *     tree stays, under a banner (errors/Banner.tsx);
 *   - one file will not parse and the rest are fine → that outline's own pane
 *     carries its errors, and every other outline stays live
 *     (errors/Broken.tsx).
 *
 * What is open is a ROUTE — a whole outline (`/o/<file>`), one document
 * (`/doc/<file>`), one node zoomed (`/n/<id>`), or one day of the journal
 * (`/d/<date>`, and `/today`) — so every page is a link someone can send. Which places are folded, whether done
 * nodes are drawn, how dense the notes are, and which month the calendar is
 * showing are signals: they belong to this tab's reading and not to the file.
 *
 * Layout principle: the header carries what is about the APP (wordmark,
 * connection, agent, theme); the sidebar carries what is about the DIRECTORY
 * (calendar + file tree). The header is on every screen — including the error
 * report and the waiting page — so there is one home for chrome and no
 * corner-pills special case to keep in step with the sidebar footer.
 *
 * This file is the composition and nothing else — the subscription, the route,
 * the clock, the one derivation of the set, which page that adds up to, and the
 * rows that page draws. Every screen it can show is its own component, and each
 * is handed what it draws rather than the set to draw it from.
 */

import { datedDays } from "@olai/format"
import { createMemo, createSignal, Match, Show, Switch } from "solid-js"

import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { chatOpen } from "./chat/open.ts"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Connection } from "./connection/Connection.tsx"
import { CLEARANCE } from "./connection/Indicator.tsx"
import { DayPage } from "./day/DayPage.tsx"
import { DocumentPage } from "./document/DocumentPage.tsx"
import { DerivedProvider } from "./derived.tsx"
import { createDocuments, DocumentsProvider } from "./document/documents.tsx"
import { Banner } from "./errors/Banner.tsx"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, pageOf, rowsFor } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { createRouter, RouterProvider } from "./router.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { createView } from "./view.ts"
import { connectionStatus, olai } from "./wire.ts"

export default function App() {
  const outlines = createOutlines()
  const documents = createDocuments()
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const view = createView(router.route)
  // The one clock in the client, and it moves: `/today` is an address a tab
  // can sit on overnight, and a page whose promise is that it follows the
  // files without a reload cannot have the day be the stale thing on it.
  const today = createToday()

  // The phone sheet's open state lives here because the burger that toggles it
  // is in the header and the body it reveals is in the sidebar — two components
  // that otherwise share nothing.
  const [menuOpen, setMenuOpen] = createSignal(false)

  /** What is wrong with the set as a WHOLE right now. Empty is the normal
   *  state, including when one file is unreadable — that one lands in the
   *  file's own entry, as `broken`. */
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

  /** Which days of a month have something dated them — the calendar's dots.
   *  A QUESTION rather than a set, asked only about the month on screen, and
   *  asked through the live derivation: a dated node saved on disk lights its
   *  day on the next frame, with nothing watching for it. */
  const dated = (month: string): ReadonlySet<string> => {
    const indexes = outlines.derived()
    return indexes === undefined ? new Set() : datedDays(indexes, month)
  }

  /**
   * The rows whichever page is open draws, as this tab is reading them. ONE
   * derivation for every page that draws rows — a zoomed node's children are as
   * live as an outline's roots — filtered here, because hiding what is done is
   * a property of the reading and not of the tree.
   *
   * A MEMO, and deliberately not a store. What comes off the wire is BORROWED:
   * the row walk mints fresh wrappers every frame, but the records inside them
   * (`at`, `shows`) are the served set's own objects, handed over rather than
   * copied — and so are the nodes a day lists. Solid's `reconcile` MUTATES what
   * it is given, transitively, so reconciling either of those into a store
   * rewrote the set's records in place: it poisoned the outline every other
   * page is read from, and the writes landed back in the derivation above, one
   * effect re-triggering itself until the stack ran out (the `RangeError` on
   * opening a second day). Nothing in this client writes to what the wire hands
   * it, and the way to keep that true is to keep no store here at all.
   *
   * Identity — what the store was actually for — is a KEYING question, and it
   * is answered where the rows are drawn: `<Key>` (./Tree.tsx, and
   * ./day/DayPage.tsx for a day) holds a row's DOM across a frame whenever its
   * key is unchanged, so one character changing in one title still does not
   * tear down and rebuild the tree.
   */
  const rows = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? [] : view.visible(rowsFor(indexes, page()))
  })

  /** Is there a sidebar on screen? Only the page that draws one does; the
   *  error report and the waiting page replace the directory column. The
   *  header is on every screen either way — chrome does not depend on a
   *  directory being readable. */
  const docked = () => outlines.manifest() !== null && page() !== undefined

  return (
    <>
      {/* Outside the switch, and first: every shape below — the report, the
          waiting page, the outline — is a page whose reader deserves to know
          whether the server behind it is still there. */}
      <Connection status={connectionStatus()} />
      {/* Also outside the switch, and for a related reason: the agent is a
          property of the SERVED DIRECTORY, not of whichever page is open, so it
          stays put across a zoom, a broken file and the error report. Asking it
          about a set that will not load is a reasonable thing to want to do.
          The drawer sits UNDER the header (see chat/Panel.tsx) — the header is
          the app's chrome and the drawer is a panel of one page, so the design
          preference is that the bar stays reachable while the agent is open. */}
      <ChatPanel />
      <div class="flex min-h-dvh flex-col">
        <AppHeader
          menu={
            docked()
              ? {
                  open: menuOpen(),
                  onToggle: () => setMenuOpen(!menuOpen()),
                }
              : undefined
          }
        />
        {/* The drawer is fixed, so the page has to be told about it: without this
            it draws underneath, and the right-hand third of every line is behind
            the panel. Reserved only from `lg` up, which is the width at which
            giving 26rem away still leaves a column worth reading — below it the
            drawer covers the page, which is the honest answer when there is no
            room to share. */}
        <div
          class="min-h-0 flex-1"
          classList={{ "lg:pr-[var(--width-chat)]": chatOpen() }}
        >
          <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
          <Match when={outlines.manifest() === null}>
            <ErrorPage errors={problems()} />
          </Match>
          <Match when={page()}>
            {(open) => (
              <RouterProvider router={router}>
                <DerivedProvider derived={outlines.derived()}>
                <DocumentsProvider documents={documents}>
                  {/* Two columns where there is room for two, one where there is
                      not. `md` is 48rem, which is where the racket original put
                      the same line: below it the sidebar stops being a column
                      beside the outline and becomes a sheet behind the header's
                      burger (see ./Sidebar.tsx), and this is the whole of the
                      layout half of that — one grid, one breakpoint. The rows
                      are named on that side because a grid stretches auto rows
                      to fill it: without `1fr` on the second, a short page
                      would push the outline down the screen by half the space
                      left over.
                      `min-h-full` rather than `min-h-dvh`: the header already
                      took its strip off the top of the viewport, and sizing the
                      body against the whole viewport would overflow by that
                      strip. */}
                  <div class="grid min-h-full grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-[16rem_1fr] md:grid-rows-none">
                    <Sidebar
                      files={outlines.files()}
                      documents={documents.paths()}
                      active={fileOf(open())}
                      broken={outlines.broken()}
                      open={menuOpen()}
                      onClose={() => setMenuOpen(false)}
                    >
                      <Calendar
                        today={today()}
                        open={only(open(), "day")?.date}
                        days={dated}
                      />
                    </Sidebar>
                    {/* The room under the outline is for the phone's home
                        indicator — the inset is real because the shell asks for
                        `viewport-fit=cover`. Spelled once where that clearance
                        is measured (./connection/Indicator.tsx). */}
                    <main class={`overflow-x-auto px-4 pt-4 ${CLEARANCE} md:px-8 md:py-6`}>
                      <Show when={problems().length > 0}>
                        <Banner errors={problems()} />
                      </Show>
                      <Switch>
                        <Match when={only(open(), "broken")}>
                          {(file) => <Broken file={file().file} />}
                        </Match>
                        <Match when={only(open(), "node")}>
                          {(node) => (
                            <NodePage zoomed={node().zoomed} rows={rows()} view={view} />
                          )}
                        </Match>
                        <Match when={only(open(), "outline")}>
                          <OutlinePage rows={rows()} view={view} />
                        </Match>
                        <Match when={only(open(), "document")}>
                          {(open) => <DocumentPage file={open().file} />}
                        </Match>
                        <Match when={only(open(), "day")}>
                          {(open) => (
                            <DayPage
                              date={open().date}
                              groups={open().groups}
                              today={today()}
                            />
                          )}
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
                </DerivedProvider>
              </RouterProvider>
            )}
            </Match>
          </Switch>
        </div>
      </div>
    </>
  )
}
