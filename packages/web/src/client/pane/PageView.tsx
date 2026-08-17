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

import type { Agenda, Derived } from "@olai/format"

import { AgendaPage } from "../agenda/AgendaPage.tsx"
import { CLEARANCE } from "../connection/Indicator.tsx"
import { DayPage } from "../day/DayPage.tsx"
import { DocumentPage } from "../document/DocumentPage.tsx"
import { Broken } from "../errors/Broken.tsx"
import { FilterBar } from "../filter/FilterBar.tsx"
import { NarrowedProvider } from "../filter/narrowed.tsx"
import { createNarrowing } from "../filter/narrowing.ts"
import { taggedBy } from "../filter/tag.ts"
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

  const narrowing = createNarrowing({
    derived: () => props.derived,
    text: () => filterOf(route()),
    all: allDrawn,
    visible: shownDrawn,
    today: () => props.today,
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
      class={`flex min-w-0 flex-1 flex-col overflow-x-clip px-4 pt-4 ${CLEARANCE} md:px-12 md:py-8 lg:pl-16 lg:pr-12 ${
        !desktop() && !chatOpen() ? "pb-16" : ""
      }`}
      data-testid={TESTID.pane}
      data-pane={String(here())}
      data-pane-focused={here() === router.workspace().focus ? "true" : undefined}
      data-href={hrefOf(route())}
      data-narrowable={narrowable(route()) ? "true" : undefined}
      onPointerDown={() => router.focus(here())}
      onClick={(event) => {
        const tag = narrowable(route()) ? taggedBy(event) : null
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
