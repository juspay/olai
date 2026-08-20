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

import { parseFilter } from "@olai/format"
import type { Agenda, Derived } from "@olai/format"

import { AgendaPage } from "../agenda/AgendaPage.tsx"
import { CLEARANCE } from "../connection/Indicator.tsx"
import { DayPage } from "../day/DayPage.tsx"
import { DocumentPage } from "../document/DocumentPage.tsx"
import { Broken } from "../errors/Broken.tsx"
import { createAsked } from "../filter/asking.ts"
import { showsTrashed } from "../filter/drawn.ts"
import { FilterBar } from "../filter/FilterBar.tsx"
import { NarrowedProvider } from "../filter/narrowed.tsx"
import { createNarrowing } from "../filter/narrowing.ts"
import { tagPressed } from "../filter/tag.ts"
import { desktop } from "../layout/media.ts"
import { chatOpen } from "../layout/prefs.ts"
import { only } from "../narrow.ts"
import { NodePage } from "../NodePage.tsx"
import { Nothing } from "../Nothing.tsx"
import { drawnBy, type Found, NOTHING_DRAWN, pageOf } from "../page.ts"
import { OutlinePage } from "../OutlinePage.tsx"
import { followed, followedSplit, useGo, useHere, useRouter } from "../router.tsx"
import { filterOf, hrefOf, narrowable, narrowedTo, samePage } from "../routes.ts"
import { panesOf } from "../workspace.ts"
import { visibleIn } from "../settings/done.ts"
import { TESTID } from "../testids.ts"
import { TrashPage } from "../trash/TrashPage.tsx"

export function PageView(props: {
  readonly derived: Derived | undefined
  readonly found: Found
  readonly today: string
  readonly agenda: Agenda | undefined
}) {
  const router = useRouter()
  const here = useHere()
  const go = useGo()
  const route = createMemo(() => panesOf(router.workspace())[here()]!.route)
  const opened = createMemo(route, undefined, { equals: samePage })

  const page = createMemo(() => {
    const indexes = props.derived
    return indexes === undefined
      ? undefined
      : pageOf(indexes, props.found, opened(), props.today)
  })

  const allDrawn = createMemo(() => {
    const indexes = props.derived
    return indexes === undefined
      ? NOTHING_DRAWN
      : drawnBy(indexes, page(), props.agenda)
  })

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
  const query = createMemo(() => parseFilter(filterOf(route()), props.today))

  /**
   * WHICH NODES the query selects — the server's answer, debounced and
   * stale-guarded (`filter/asking.ts`). It used to be a walk over every node
   * this tab held; the tab is giving that copy up
   * (docs/brainstorming/vault-in-browser.md).
   *
   * ASKED ONLY WHEN THERE IS A QUESTION: an empty box and a query the grammar
   * refused are both answered by the parse above, so neither is worth a round
   * trip. The `trashed` flag is this page saying its own rows are put-away ones
   * — the one thing the matcher is told about the question rather than asked
   * about the answer (`filter/narrowing.ts`'s header).
   */
  const asked = createAsked({
    question: () => (query().kind === "asking" ? filterOf(route()) : null),
    trashed: () => showsTrashed(allDrawn()),
  })

  const narrowing = createNarrowing({
    query,
    text: () => filterOf(route()),
    all: allDrawn,
    visible: shownDrawn,
    matched: asked.matched,
    answering: asked.answering,
    failure: asked.failure,
    offline: asked.offline,
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
      <NarrowedProvider narrowed={narrowing}>
        <Show when={narrowing.drawn().kind !== "none"}>
          <FilterBar narrowing={narrowing} onType={narrow} />
        </Show>
        <Show when={page()}>
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
                    today={props.today}
                  />
                )}
              </Match>
              <Match when={only(open(), "agenda")}>
                {(open) => (
                  <Show when={owed()}>
                    {(reading) => (
                      <AgendaPage agenda={reading()} today={open().date} />
                    )}
                  </Show>
                )}
              </Match>
              <Match when={only(open(), "trash")}>
                <TrashPage
                  files={trash()?.files ?? []}
                  groups={trash()?.groups ?? []}
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
    </main>
  )
}
