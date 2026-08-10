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
 * What is open is a ROUTE — a whole outline (`/o/<file>`), one node zoomed
 * (`/n/<id>`), or one day of the journal (`/d/<date>`, and `/today`) — so
 * every page is a link someone can send. Which places are folded, whether done
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
  type Row,
} from "@olai/format"
import { createEffect, createMemo, Match, Show, Switch } from "solid-js"
import { createStore, reconcile } from "solid-js/store"

import { Calendar } from "./calendar/Calendar.tsx"
import { chatOpen } from "./chat/open.ts"
import { Panel as ChatPanel, Toggle as ChatToggle } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Connection } from "./connection/Connection.tsx"
import { Indicator } from "./connection/Indicator.tsx"
import { DayPage } from "./day/DayPage.tsx"
import { Banner } from "./errors/Banner.tsx"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { outlineOf, pageOf, rowsFor } from "./page.ts"
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
    return indexes === undefined
      ? undefined
      : pageOf(indexes, files(), broken(), router.route(), today())
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

  /** Is there a sidebar on screen to hold the app's own chrome? Only the page
   *  that draws one does; the error report and the waiting page replace the
   *  whole layout. */
  const docked = () => frame() !== null && page() !== undefined

  /** The two pills that are about the APP rather than about the page: whether
   *  the server is still there, and the way into the agent. One expression,
   *  rendered in whichever of the two places the layout has. */
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
      {/* The same two pills, in the only other place there is to put them.
          Every screen below either has a sidebar and gets `chrome` in its
          footer, or has none — the error report, the waiting page — and gets
          this. Fixed is the fallback rather than the rule: a pill fixed to the
          corner of a page with an outline on it sits on top of the outline. */}
      <Show when={!docked()}>
        <div class="fixed bottom-3 left-3 z-40 flex items-center gap-2">{chrome()}</div>
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
              <div class="grid min-h-screen grid-cols-[16rem_1fr]">
                <Sidebar
                  files={files()}
                  active={outlineOf(open())}
                  broken={broken()}
                  footer={chrome()}
                >
                  <Calendar
                    today={today()}
                    open={only(open(), "day")?.date}
                    days={dated}
                  />
                </Sidebar>
                <main class="overflow-x-auto px-8 py-6">
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
                    <Match when={only(open(), "day")}>
                      {(open) => (
                        <DayPage date={open().date} groups={day} today={today()} />
                      )}
                    </Match>
                    <Match when={only(open(), "nothing")}>
                      {(nothing) => <Nothing requested={nothing().requested} />}
                    </Match>
                  </Switch>
                </main>
              </div>
            </RouterProvider>
          )}
          </Match>
        </Switch>
      </div>
    </>
  )
}
