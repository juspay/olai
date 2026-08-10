/**
 * The whole app: a sidebar of the outlines found, and one page open.
 *
 * The page is decided by ONE subscription. The outline stream carries three
 * answers — no frame yet, a `null` frame, a snapshot — and they are exactly
 * the three things a reader can be looking at: waiting, never-loaded, or
 * reading. The error cell is a DETAIL of what is on screen and never the
 * decision, because two subscriptions arriving independently would otherwise
 * disagree for a frame and the page would flash the wrong story.
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
 * This file is the composition and nothing else — the subscription, the route,
 * the clock, the one derivation of the set, which page that adds up to, and the
 * rows that page draws. Every screen it can show is its own component, and each
 * is handed what it draws rather than the set to draw it from.
 */

import { type BrokenFile, datedDays, derive, type Document } from "@olai/format"
import { createMemo, Match, Show, Switch } from "solid-js"

import { Calendar } from "./calendar/Calendar.tsx"
import { chatOpen } from "./chat/open.ts"
import { Panel as ChatPanel, Toggle as ChatToggle } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Connection } from "./connection/Connection.tsx"
import { CLEARANCE, CORNER, Indicator } from "./connection/Indicator.tsx"
import { DayPage } from "./day/DayPage.tsx"
import { DocumentPage } from "./document/DocumentPage.tsx"
import { DocumentsProvider } from "./document/documents.tsx"
import { Banner } from "./errors/Banner.tsx"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { fileOf, pageOf, rowsFor } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { createRouter, RouterProvider } from "./router.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { createView } from "./view.ts"
import { connectionStatus, olai } from "./wire.ts"

export default function App() {
  const frame = olai.streams.outlines.use(() => ({}))
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const view = createView(router.route)
  // The one clock in the client, and it moves: `/today` is an address a tab
  // can sit on overnight, and a page whose promise is that it follows the
  // files without a reload cannot have the day be the stale thing on it.
  const today = createToday()

  const set = () => frame()?.set
  const files = () => set()?.files ?? []
  /** Every `.md` the directory holds, text and all — the sidebar's second
   *  list, the document pages, and every `doc` preview come off this one
   *  field of the set. */
  const documents = () => set()?.documents ?? []
  /** The same documents BY PATH — one index, built once. Everything that
   *  answers "which document is this" reads it: the page a `/doc/<file>` route
   *  names, and every `doc`-carrying node's reference, however deep in a tree
   *  it is drawn. The list above stays the list, because order is what a
   *  sidebar draws. */
  const documentsByFile = createMemo(
    () =>
      new Map<string, Document>(
        documents().map((document) => [document.file, document] as const),
      ),
  )
  /** What is wrong with the set as a WHOLE right now. Empty is the normal
   *  state, including when one file is unreadable — that one lands in the set
   *  itself, as `broken` below. */
  const problems = () => errors.value() ?? []

  /** The files that did not parse, by path — the sidebar marks them and the
   *  main pane draws one of them instead of a tree. */
  const broken = createMemo(
    () =>
      new Map<string, BrokenFile>(
        (set()?.broken ?? []).map((file) => [file.file, file] as const),
      ),
  )

  // One derivation for the whole set — the same call the validator makes. The
  // rows are per-file; the indexes are not, because a mirror may point into
  // any file and resolving it needs every node.
  const derived = createMemo(() => {
    const loaded = set()
    return loaded === undefined ? undefined : derive(loaded.nodes)
  })

  const page = createMemo(() => {
    const indexes = derived()
    return indexes === undefined ? undefined : pageOf(
      indexes,
      { files: files(), documents: documentsByFile(), broken: broken() },
      router.route(),
      today(),
    )
  })

  /** Which days of a month have something dated them — the calendar's dots.
   *  A QUESTION rather than a set, asked only about the month on screen, and
   *  asked through the live derivation: a dated node saved on disk lights its
   *  day on the next frame, with nothing watching for it. */
  const dated = (month: string): ReadonlySet<string> => {
    const indexes = derived()
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
    const indexes = derived()
    return indexes === undefined ? [] : view.visible(rowsFor(indexes, page()))
  })

  /** Is there a sidebar on screen to hold the app's own chrome? Only the page
   *  that draws one does; the error report and the waiting page replace the
   *  whole layout. */
  const docked = () => frame() !== null && page() !== undefined

  /** The two pills that are about the APP rather than about the page: whether
   *  the server is still there, and the way into the agent. One expression,
   *  rendered in whichever of the two places the layout has for it. */
  const chrome = () => (
    <>
      <Indicator status={connectionStatus()} />
      <ChatToggle />
    </>
  )

  return (
    <>
      {/* Outside the switch, and first: every shape below — the report, the
          waiting page, the outline — is a page whose reader deserves to know
          whether the server behind it is still there. */}
      <Connection status={connectionStatus()} />
      {/* Also outside the switch, and for a related reason: the agent is a
          property of the SERVED DIRECTORY, not of whichever page is open, so it
          stays put across a zoom, a broken file and the error report. Asking it
          about a set that will not load is a reasonable thing to want to do. */}
      <ChatPanel />
      {/* The same two pills, in the only other place there is to put them:
          every screen below either draws a sidebar and gets `chrome` in its
          footer, or draws none — the error report, the waiting page — and gets
          this. */}
      <Show when={!docked()}>
        <div class={`${CORNER} flex items-center gap-2`}>{chrome()}</div>
      </Show>
      {/* The drawer is fixed, so the page has to be told about it: without this
          it draws underneath, and the right-hand third of every line is behind
          the panel. Reserved only from `lg` up, which is the width at which
          giving 26rem away still leaves a column worth reading — below it the
          drawer covers the page, which is the honest answer when there is no
          room to share. */}
      <div classList={{ "lg:pr-[var(--width-chat)]": chatOpen() }}>
        <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
        <Match when={frame() === null}>
          <ErrorPage errors={problems()} />
        </Match>
        <Match when={page()}>
          {(open) => (
            <RouterProvider router={router}>
              <DocumentsProvider documents={documentsByFile()}>
                {/* Two columns where there is room for two, one where there is
                    not. `md` is 48rem, which is where the racket original put
                    the same line: below it the sidebar stops being a column
                    beside the outline and becomes a header above it (see
                    ./Sidebar.tsx), and this is the whole of the layout half of
                    that — one grid, one breakpoint. The rows are named on that
                    side because a grid stretches auto rows to fill it: without
                    `1fr` on the second, a short page would push the outline
                    down the screen by half the space left over.
                    `min-h-dvh`, not `min-h-screen`: on a phone `vh` is measured
                    against the browser chrome at its SMALLEST, so a page sized
                    by it is taller than the screen for as long as the address
                    bar is showing. */}
                <div class="grid min-h-dvh grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-[16rem_1fr] md:grid-rows-none">
                  <Sidebar
                    files={files()}
                    documents={documents()}
                    active={fileOf(open())}
                    broken={broken()}
                    footer={chrome()}
                  >
                    <Calendar
                      today={today()}
                      open={only(open(), "day")?.date}
                      days={dated}
                    />
                  </Sidebar>
                  {/* The room under the outline is for the phone's home
                      indicator — the inset is real because the shell asks for
                      `viewport-fit=cover` — and it is the same amount the pages
                      WITHOUT a sidebar need for the pair in their corner, so it
                      is spelled once where those pills are
                      (./connection/Indicator.tsx). */}
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
                        {(open) => <DocumentPage document={open().document} />}
                      </Match>
                      <Match when={only(open(), "day")}>
                        {(open) => (
                          <DayPage
                            date={open().date}
                            groups={open().groups}
                            today={today()}
                            view={view}
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
            </RouterProvider>
          )}
          </Match>
        </Switch>
      </div>
    </>
  )
}
