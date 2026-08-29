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
import { useFollow, useHere, useRouter } from "../router.tsx"
import { filterOf, hrefOf, narrowable, narrowedTo, samePage } from "../routes.ts"
import { panesOf } from "../workspace.ts"
import { pageFileOf, visibleIn } from "../settings/done.ts"
import { TESTID } from "../testids.ts"
import { TrashPage } from "../trash/TrashPage.tsx"

export function PageView() {
  const router = useRouter()
  const here = useHere()
  const follow = useFollow()
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
   *
   * A DURATION (`created:1h`) is the sharpest case of that split and is not a
   * new one. The grammar reads a bare day as midnight on it, so the bound this
   * parse mints for an hour ago is an hour before midnight — a value nothing
   * here selects by, because nothing here selects. What this parse OWES the
   * duration is that it PARSE: a box that drew a refusal under a query the
   * server was busy answering would be the app disagreeing with itself in
   * front of the reader. Reading a ticking clock to mint a bound no one uses
   * would buy nothing and cost the tab its one answer about what time it is.
   */
  const query = createMemo(() => parseFilter(filterOf(route()), today()))

  /**
   * WHICH NODES the query selects on this page — a second subscription beside
   * the page's own, debounced on the keystroke and live on the revision
   * (`filter/asking.ts`).
   *
   * IT IS HANDED THE PARSE AND THE PAGE, not conditions written here: whether
   * there is a question at all is one predicate over one parsed value, and
   * which page these words narrow is the request this pane already asks its
   * rows with. A second spelling of either would be a second answer to it.
   *
   * THE REQUEST rather than what the page DRAWS, which is the shape of
   * `filter-ask-carries-revision`: the server holds the page, so this names it
   * instead of describing it. What used to be handed over was the drawn page —
   * to read one boolean off it (are these rows put-away ones) and a generation
   * beside it (has the set moved under the answer). Both are the server's now,
   * asked of the page it is already computing per revision.
   */
  const asked = createAsked({
    query,
    text: () => filterOf(route()),
    page: request,
    // WHICH PAGE these words narrow, as an identity that moves exactly when the
    // reader went somewhere else — the same memo this pane's subscription is
    // opened on, so "a navigation" means here what it means there. It is what
    // tells a keystroke from an arrival (`filter/asking.ts`'s settle).
    opened,
  })

  /**
   * ...AND THE PAGE ITSELF, held until the answer above is about it.
   *
   * THE ORDER IS NOT PROMISED, which is why the join has two halves. Two
   * subscriptions opened in one tick and read on one pulse arrive in whatever
   * order the socket and the two walks produce, and drawn as each arrives EITHER
   * order lies: the page first shows a `?q=` address WHOLE for a frame before
   * its own query takes rows off it, and the answer first prunes the page BEFORE
   * by ids that name nothing on it, which empties the pane.
   *
   * The first is the one that happens — it is what `pin_to_sidebar.feature`'s
   * "the node `demo` was never drawn" caught when this join did not exist — and
   * `awaiting` covers it (`../reading.tsx`'s `holding`: what was on screen stays,
   * and a pane with nothing on screen yet draws its `Reading…` line, the beat §5a
   * licenses for a navigation). {@link together} covers the other, which is
   * measured NOT to happen; what it buys is that the page below may assert so.
   */
  const reading = createReading(request, asked.awaiting)
  // …and the pane joins the workspace's register with it, so the chrome outside
  // the panes can read whichever one is focused — the page AND the names table
  // derived beside it (`../App.tsx`).
  useReadings().join(here, reading)

  const page = createMemo(() => reading.page()?.shows)

  const allDrawn = createMemo(() => drawnBy(page()))

  // Done-visibility is the PAGE's own pick, so the pruning needs to know which
  // page these rows are — the outline's file; a zoom's canonical file, since a
  // zoomed view is the same page (../settings/done.ts).
  const shownDrawn = createMemo(() => visibleIn(allDrawn(), pageFileOf(page())))

  /**
   * ARE THE TWO READINGS ABOUT THE SAME PAGE?
   *
   * The join, from the side `asked.awaiting` cannot reach. That one holds the
   * PAGE while its narrowing is behind; this is the opposite order — the answer
   * for the page being navigated TO, landing while the pane is still drawing the
   * page before. Spent there it prunes by ids that name nothing on screen, and
   * every row goes.
   *
   * WHAT IS MEASURED, so the reason this exists is not overstated: the page
   * lands first, every time — six runs of the scenario below with this gate
   * bypassed and none of them emptied. That is not something either member
   * PROMISES, though. Two subscriptions opened in one tick and read on one pulse
   * arrive in whatever order the socket and the two walks happen to produce, and
   * nothing in the design fixes it. So the gate is what makes the invariant a
   * property of this code rather than of that ordering — and the scenario can
   * assert it without becoming a canary for scheduling.
   *
   * An answer is spent only where it is ABOUT the page being drawn. Until they
   * agree the page draws whole and the bar says `filtering…`, which is the state
   * `filter/narrowing.ts` already defines for "nothing has answered this query
   * yet" rather than a fifth one invented here.
   */
  const together = createMemo(() => {
    const drawn = reading.about()
    const answered = asked.about()
    return drawn !== null && answered !== null && samePageRequest(drawn, answered)
  })

  const narrowing = createNarrowing({
    query,
    text: () => filterOf(route()),
    all: allDrawn,
    visible: shownDrawn,
    matched: () => (together() ? asked.matched() : undefined),
    answering: () => (together() ? asked.answering() : null),
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
        follow(event)
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
            on every click (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md
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
                  <OutlinePage
                    file={outline().file}
                    rows={rows()}
                    holds={only(allDrawn(), "tree")?.rows.length ?? 0}
                  />
                )}
              </Match>
              <Match when={only(open(), "document")}>
                {(open) => <DocumentPage file={open().file} custom={open().props} />}
              </Match>
              <Match when={only(open(), "day")}>
                {(open) => (
                  <DayPage
                    date={open().date}
                    groups={day()?.groups ?? []}
                    notes={day()?.notes ?? []}
                    noted={open().notes.length > 0}
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
