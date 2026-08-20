/**
 * ONE pane's page: the same chrome a lone view has always drawn.
 *
 * A pane is a route. This is that route, resolved and drawn — breadcrumbs,
 * filter box, the page itself — not a stripped copy. The app holds the
 * store, the clock and the directory; this holds the reading of ONE
 * address against them.
 *
 * Dismissal and completion stay where they were: each composer, each
 * editor, each pane. Nothing here shares a stack with its neighbour.
 */

import { createMemo, Match, Show, Switch } from "solid-js"

import { parseFilter, samePageRequest } from "@olai/format"

import { AgendaPage } from "../agenda/AgendaPage.tsx"
import { CLEARANCE } from "../connection/Indicator.tsx"
import { DayPage } from "../day/DayPage.tsx"
import { DocumentPage } from "../document/DocumentPage.tsx"
import { Broken } from "../errors/Broken.tsx"
import { createAsked } from "../filter/asking.ts"
import { FilterBar } from "../filter/FilterBar.tsx"
import { NarrowedProvider } from "../filter/narrowed.tsx"
import { createNarrowing } from "../filter/narrowing.ts"
import { tagPressed } from "../filter/tag.ts"
import { desktop } from "../layout/media.ts"
import { chatOpen } from "../layout/prefs.ts"
import { only } from "../narrow.ts"
import { useToday } from "../today.tsx"
import { NodePage } from "../NodePage.tsx"
import { Nothing } from "../Nothing.tsx"
import { drawnBy, requestFor } from "../page.ts"
import { createReading, ReadingProvider, useReadings } from "../reading.tsx"
import { OutlinePage } from "../OutlinePage.tsx"
import { followed, followedSplit, useGo, useHere, useRouter } from "../router.tsx"
import { filterOf, hrefOf, narrowable, narrowedTo, samePage } from "../routes.ts"
import { panesOf } from "../workspace.ts"
import { visibleIn } from "../settings/done.ts"
import { TESTID } from "../testids.ts"
import { TrashPage } from "../trash/TrashPage.tsx"

export function PageView() {
  const router = useRouter()
  const here = useHere()
  const go = useGo()
  const today = useToday()
  const route = createMemo(() => panesOf(router.workspace())[here()]!.route)
  const opened = createMemo(route, undefined, { equals: samePage })

  /**
   * THIS PANE'S OWN QUESTION, and its own subscription to the answer
   * (`../reading.tsx`).
   *
   * `opened` rather than `route()`, which is the same memo the pane has always
   * held and now decides a subscription rather than a re-render: a stream
   * re-opens whenever its input NOTIFIES, and `samePage` is what says a change
   * that was only the `?q=` is not a different page. Without it every keystroke
   * in the filter box would tear this stream down and re-ask the server for the
   * page it is already drawing.
   *
   * The DAY is the tab's own clock (`../clock.ts`), because `/today` names the
   * day it IS and `/agenda` counts against the day the reader is standing on.
   */
  // BY VALUE, which is what keeps the subscription open across a navigation
  // that did not change which page this is: `opened` moves for a link to a
  // heading inside the document already on screen, and the request it produces
  // is the same one (`../page.ts`'s `requestFor`). A memo comparing by
  // reference would re-open the stream for it, blank the pane and unmount the
  // body the reader was being scrolled into.
  const request = createMemo(() => requestFor(opened(), today()), undefined, {
    equals: samePageRequest,
  })
  const reading = createReading(request)
  // …and the pane joins the workspace's register with it, so the chrome outside
  // the panes can read whichever one is focused (`../App.tsx`).
  useReadings().join(here, reading.page)

  const page = createMemo(() => reading.page()?.shows)

  const allDrawn = createMemo(() => drawnBy(page()))

  const shownDrawn = createMemo(() => visibleIn(allDrawn()))

  /**
   * THE BOX, READ ONCE — and both things made of it built off that one value:
   * what the page says about the query (`filter/narrowing.ts`) and the question
   * that goes to the server (`filter/asking.ts`). Two parses would be one
   * grammar asked twice about one string, which is a drift the same function
   * called twice cannot fix.
   *
   * The DAY is the tab's own (`../clock.ts`) and it is what the relative words
   * count from HERE — the words to light, the refusals, whether there is a
   * query at all. What the server matches by counts from the server's clock,
   * exactly as the ⌘K palette and an agent's `search_nodes` already do; the two
   * differ only for a tab left open across midnight or sitting in another time
   * zone, and one answer about what day it is beats a query resolved twice.
   */
  const query = createMemo(() => parseFilter(filterOf(route()), today()))

  /**
   * WHICH NODES the query selects — the server's answer, debounced and
   * stale-guarded (`filter/asking.ts`). It used to be a walk over every node
   * this tab held; the tab is giving that copy up
   * (docs/brainstorming/vault-in-browser.md).
   *
   * IT IS HANDED THE PARSE, THE PAGE AND THE SET, not conditions written here:
   * whether there is a question at all, whether this page's own rows are
   * put-away ones — the one thing the matcher is told about the question rather
   * than asked about the answer — and whether the directory has moved under the
   * answer are each one predicate over a value the pane already has, and a
   * second spelling of any of them is a second answer to it.
   */
  const asked = createAsked({
    query,
    text: () => filterOf(route()),
    page: allDrawn,
    // THE GENERATION the question carries: a filter is a standing view, so an
    // answer that outlived the set it was computed over is a wrong answer that
    // looks like a right one (`filter/asking.ts`'s `Ask.at`). It used to be the
    // tab's derivation, a fresh value per published revision; what says the
    // same thing now is a count of the frames THIS PAGE's reading moved on
    // (`../reading.tsx`'s `Reading.at`, which is why it is a number rather than
    // the value: a subscription's value is a store whose identity survives
    // every frame). Narrower and more honest than what it replaced — a revision
    // that moved nothing on this page sends no frame, so it cannot invalidate
    // an answer about it — and read by nothing, as it always was.
    at: reading.at,
    // WHICH PAGE these words narrow, as an identity that moves exactly when the
    // reader went somewhere else — the same memo this pane's subscription is
    // opened on, so "a navigation" means here what it means there. It is what
    // tells a keystroke from an arrival (`filter/asking.ts`'s settle).
    opened,
  })

  const narrowing = createNarrowing({
    query,
    text: () => filterOf(route()),
    all: allDrawn,
    visible: shownDrawn,
    matched: asked.matched,
    answering: asked.answering,
  })

  const rows = () => only(narrowing.drawn(), "tree")?.rows ?? []
  const day = () => only(narrowing.drawn(), "day")
  const owed = () => only(narrowing.drawn(), "agenda")?.agenda
  const trash = () => only(narrowing.drawn(), "trash")

  const narrow = (text: string): void => {
    router.replaceIn(here(), narrowedTo(route(), text))
  }

  return (
    <main
      class={`flex min-w-0 flex-1 flex-col overflow-x-clip px-5 pt-6 ${CLEARANCE} md:px-10 md:py-10 ${
        !desktop() && !chatOpen() ? "pb-16" : ""
      }`}
      data-testid={TESTID.pane}
      data-pane={String(here())}
      data-pane-focused={here() === router.workspace().focus ? "true" : undefined}
      data-href={hrefOf(route())}
      data-narrowable={narrowable(route()) ? "true" : undefined}
      onPointerDown={() => router.focus(here())}
      onClick={(event) => {
        const tag = narrowable(route()) ? tagPressed(event) : null
        if (tag !== null) {
          event.preventDefault()
          narrow(tag)
          return
        }
        const split = followedSplit(event)
        if (split !== null) {
          event.preventDefault()
          router.openRight(here(), split, event.shiftKey)
          return
        }
        const next = followed(event)
        if (next === null) return
        event.preventDefault()
        go(next)
      }}
    >
      <ReadingProvider reading={reading}>
      <NarrowedProvider narrowed={narrowing}>
        {/* THE BOX BELONGS TO THE ADDRESS, so it is drawn on what the ADDRESS
            says: every page but a document's may carry a `?q=` (`../routes.ts`'s
            `narrowable`, the one place that list is written down), and that is
            true the frame the link is clicked rather than a round trip later.
            Asked of the page's own rows instead, it was drawn on a value that
            collapses to `none` while a navigation is in flight — so the bar and
            the `<input>` somebody was typing in unmounted and were built again
            on every click (docs/brainstorming/reactivity-after-the-flip.md
            §3.1's 1.4). */}
        <Show when={narrowable(route())}>
          <FilterBar narrowing={narrowing} asked={asked} onType={narrow} />
        </Show>
        {/* NOTHING YET, AND ONLY EVER ONCE PER PANE: navigation asks the server
            (the design's §5a ruling — round-tripping is acceptable and nothing
            is cached), so there is one honest beat between an address and the
            first page a pane ever draws. The line is minimal on purpose: a
            loopback answer arrives inside a frame, and a spinner for a
            millisecond is a flicker rather than news.

            EVERY LATER NAVIGATION SWAPS instead. §5a accepted a WAIT, not a
            teardown, and a pane that fell back here on each one tore its page
            down to this line and built the next from nothing — filter bar,
            editors and scroll included. What is on screen while the next answer
            is in flight is the page that is on screen, and the reading holds it
            (`../reading.tsx`); this arm is what a pane with nothing behind it
            draws. */}
        <Show
          when={page()}
          fallback={<p class="m-0 py-8 text-muted">Reading…</p>}
        >
          {(open) => (
            <Switch>
              <Match when={only(open(), "broken")}>
                {(file) => <Broken file={file().file} />}
              </Match>
              <Match when={only(open(), "node")}>
                {(node) => <NodePage zoomed={node().zoomed} rows={rows()} />}
              </Match>
              <Match when={only(open(), "outline")}>
                {(outline) => (
                  <OutlinePage file={outline().file} rows={rows()} />
                )}
              </Match>
              <Match when={only(open(), "document")}>
                {(open) => <DocumentPage file={open().file} />}
              </Match>
              <Match when={only(open(), "day")}>
                {(open) => (
                  <DayPage
                    date={open().date}
                    groups={day()?.groups ?? []}
                    notes={day()?.notes ?? []}
                    today={today()}
                  />
                )}
              </Match>
              <Match when={only(open(), "agenda")}>
                {(open) => (
                  <Show when={owed()}>
                    {(stretches) => (
                      <AgendaPage agenda={stretches()} today={open().date} />
                    )}
                  </Show>
                )}
              </Match>
              <Match when={only(open(), "trash")}>
                <TrashPage
                  files={trash()?.files ?? []}
                  groups={trash()?.groups ?? []}
                  records={only(open(), "trash")?.records ?? 0}
                />
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
          )}
        </Show>
      </NarrowedProvider>
      </ReadingProvider>
    </main>
  )
}
