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
 * nodes are drawn, and which month the calendar is showing are signals: they
 * belong to this tab's reading and not to the file.
 *
 * This file is the composition and nothing else — the subscription, the route,
 * the clock, the one derivation of the set, which page that adds up to, and the
 * stores the live node content is reconciled into. Every screen it can show is
 * its own component, and each is handed what it draws rather than the set to
 * draw it from.
 */

import {
  type BrokenFile,
  datedDays,
  type DayGroup,
  derive,
  type Document,
  type Row,
} from "@olai/format"
import { createEffect, createMemo, Match, Show, Switch } from "solid-js"
import { createStore, reconcile } from "solid-js/store"

import { Calendar } from "./calendar/Calendar.tsx"
import { createToday } from "./clock.ts"
import { Connection } from "./connection/Connection.tsx"
import { CLEARANCE } from "./connection/Indicator.tsx"
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

  // RECONCILED into a store rather than handed over as a fresh array, and the
  // live store is why. The row walk mints new objects every time it runs, and a
  // `<For>` compares by reference — so without this, one character changing in
  // one title on disk would tear down and rebuild every row on screen: its DOM,
  // its collapse memo, its rendered note. Keyed on `row.key`, which the format
  // already mints per PLACE, the diff touches the rows that actually changed
  // and leaves the rest of the tree standing.
  //
  // ONE store for every page that draws rows, filtered before it is reconciled:
  // a zoomed node's children are as live as an outline's roots, and hiding what
  // is done must not look like a thousand rows changing.
  const [rows, setRows] = createStore<Array<Row>>([])
  createEffect(() => {
    const indexes = derived()
    const built = indexes === undefined ? [] : rowsFor(indexes, page())
    setRows(reconcile([...view.visible(built)], { key: "key" }))
  })

  // A day's nodes go through the same seam, for the same reason: `datedOn`
  // mints fresh objects on every frame too, and a `<For>` over them would
  // re-render — and re-parse the markdown of — every note on the page each time
  // any file in the directory is saved. Keyed on the outline, which is what a
  // group IS; the nodes inside merge positionally, which is enough to leave a
  // note whose text did not change alone.
  const [day, setDay] = createStore<Array<DayGroup>>([])
  createEffect(() => {
    const open = page()
    setDay(reconcile(open?.kind === "day" ? [...open.groups] : [], { key: "file" }))
  })

  return (
    <>
      {/* Outside the switch, and first: every shape below — the report, the
          waiting page, the outline — is a page whose reader deserves to know
          whether the server behind it is still there. */}
      <Connection status={connectionStatus()} />
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
                  >
                    <Calendar
                      today={today()}
                      open={only(open(), "day")?.date}
                      days={dated}
                    />
                  </Sidebar>
                  {/* The room under the outline is for two things a phone has
                      that a laptop does not: the home indicator (the inset is
                      real because the shell asks for `viewport-fit=cover`), and
                      the connection dot, which is fixed over this corner and
                      would otherwise sit on the last row of the tree — so the
                      amount is the dot's own (./connection/Indicator.tsx). */}
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
                          <NodePage zoomed={node().zoomed} rows={rows} view={view} />
                        )}
                      </Match>
                      <Match when={only(open(), "outline")}>
                        <OutlinePage rows={rows} view={view} />
                      </Match>
                      <Match when={only(open(), "document")}>
                        {(open) => <DocumentPage document={open().document} />}
                      </Match>
                      <Match when={only(open(), "day")}>
                        {(open) => (
                          <DayPage date={open().date} groups={day} today={today()} />
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
    </>
  )
}
