import { createDoneRows } from "./pruning.ts"
import { FocusProvider } from "./focus.ts"
import { usePaneId } from "olai-plugin-navigation/routing"
import { EditorMemoryProvider, editorMemory, resetEditorMemory } from "./edit/memory.ts"
import { Dynamic } from "solid-js/web"
import { PAGE_SUBJECT } from "olai-plugin-navigation/contract"
import { TESTID as IDS_NAVIGATION } from "olai-plugin-navigation/testids"
import { TESTID as IDS_UI_PRIMITIVES } from "@olai/ui-primitives/testids.ts"
import { shownIn } from "olai-plugin-navigation/address/address.ts"
import { nameOf } from "./routing.ts"
import { useUndo } from "./edit/undoing.ts"
import { batch, createEffect, on, createMemo, Match, Show, Switch } from "solid-js"

import { parseFilter, samePageRequest } from "@olai/format"

import { CLEARANCE } from "olai-plugin-layout/clearance"
import { Empty } from "@olai/web/client/Empty.tsx"
import { Broken } from "olai-plugin-vault/errors/Broken.tsx"
import { createAsked } from "./filter/asking.ts"
import { FilterBar } from "./filter/FilterBar.tsx"
import { NarrowedProvider } from "./filter/narrowed.tsx"
import { createNarrowing } from "./filter/narrowing.ts"
import { tagPressed } from "./filter/tag.ts"
import { desktop } from "./shell.ts"
import { only } from "@olai/web/client/narrow.ts"
import { useToday } from "./clock.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { drawnBy, requestFor, fileOf } from "./page.ts"
import { createReading, ReadingProvider, useReadings } from "./reading.tsx"
import { OutlinePage } from "./OutlinePage.tsx"
import { useHere, useRouter } from "olai-plugin-navigation/routing"
import type { MountedNodePage } from "olai-plugin-navigation/routes"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { TESTID } from "../testids.ts"
import { filterOf, hrefOf, narrowable, narrowedTo, routeFace, samePage } from "./routing.ts"
import { panesOf } from "olai-plugin-navigation/workspace"
import { pageFileOf, doneHiddenOn, landingReveal } from "./settings/done.ts"


export function OutlinePageView(props: {readonly render?: (props: import("../index.ts").PageBodyProps) => import("solid-js").JSX.Element} = {}) {
  const router = useRouter()
  const here = useHere()
  const route = createMemo(() => router.panes()[here()]!.route())
  const source = createMemo(() => routeFace(route()))
  return (
    <FocusProvider><PageAt source={source() ?? null} render={props.render} /></FocusProvider>
  )
}

function PageAt(props: { readonly source: MountedNodePage | null; readonly render?: (props: import("../index.ts").PageBodyProps) => import("solid-js").JSX.Element }) {
  const router = useRouter()
  const here = useHere()
  const today = useToday()
  const route = createMemo(() => router.panes()[here()]!.route())
  const opened = createMemo(route, undefined, { equals: samePage })
  const memory = editorMemory()
  const missing = createMemo(() => props.source === null && opened().kind === "plugin")

  const request = createMemo(() => {
    const open = opened()
    if (props.source !== null && open.kind === "plugin") {
      return props.source.route.request(open.value, today())
    }
    return requestFor(open)
  }, undefined, {
    equals: (before, after) =>
      before === null || after === null ? before === after : samePageRequest(before, after),
  })
  const filter = createMemo(() => filterOf(route()))
  const query = createMemo(() => parseFilter(filter(), today()))

  const asked = createAsked({
    query,
    text: () => filterOf(route()),
    page: request,
    opened,
  })

  const reading = createReading(request, asked.awaiting, () => props.source?.route.stream)
  const answered = createMemo(previous => reading.pending() ? previous : opened(), opened(), { equals: samePage })
  createEffect(on(answered, () => batch(() => resetEditorMemory(memory)), { defer: true }))
  useReadings().join(usePaneId(), reading)
  const navigation = useRouter() as import("olai-plugin-navigation/contract").Navigation
  const undo = useUndo()
  navigation.report(here, () => ({ pending: reading.pending(), failure: reading.failure()?.message, history: undo, title: nameOf(route(), shownIn(reading.names(), route())), file: reading.page() === undefined ? undefined : fileOf(reading.page()!.shows) }))

  const page = createMemo(() => reading.page()?.shows)

  const allDrawn = createMemo(() => drawnBy(page()))

  const paneId = usePaneId()
  const treeRows = createMemo(() => { const drawn = allDrawn(); return drawn.kind === "tree" ? drawn.rows : [] })
  const doneRows = createDoneRows(treeRows,
    () => { const file = pageFileOf(page()); return file !== undefined && doneHiddenOn(file) },
    () => { const file = pageFileOf(page()); return file === undefined ? undefined : landingReveal(file, paneId()) })
  const afterDoneHidden = createMemo(() => {
    const drawn = allDrawn()
    return drawn.kind === "tree" ? { ...drawn, rows: doneRows() } : drawn
  })

  const together = createMemo(() => {
    const drawn = reading.about()
    const answered = asked.about()
    return drawn !== null && answered !== null && samePageRequest(drawn, answered)
  })

  const narrowing = createNarrowing({
    query,
    text: () => filterOf(route()),
    all: allDrawn,
    afterDone: afterDoneHidden,
    matched: () => (together() ? asked.matched() : undefined),
    answering: () => (together() ? asked.answering() : null),
  })

  const rows = () => only(narrowing.drawn(), "tree")?.rows ?? []
  const trash = () => only(narrowing.drawn(), "trash")

  const narrow = (text: string): void => {
    router.replaceIn(here(), narrowedTo(route(), text))
  }

  return (
    <main
      class={`relative flex min-w-0 flex-1 flex-col overflow-x-clip px-4 pt-4 ${CLEARANCE} md:px-8 md:py-6 ${
        !desktop() ? "pb-16" : ""
      }`}
      data-testid={IDS_NAVIGATION.pane}
      data-pane={String(here())}
      data-pane-focused={here() === router.focusIndex() ? "true" : undefined}
      data-href={hrefOf(route())}
      data-drawn-file={pageFileOf(page())}
      data-narrowable={narrowable(route()) ? "true" : undefined}
      onPointerDown={() => router.focus(here())}
      onClick={(event) => {
        const tag = narrowable(route()) ? tagPressed(event) : null
        if (tag !== null) {
          event.preventDefault()
          narrow(tag)
          return
        }
      }}
    >
      <EditorMemoryProvider value={memory}><ReadingProvider reading={reading}>
      <NarrowedProvider narrowed={narrowing}>
        <Show when={narrowable(route())}>
          <FilterBar
            narrowing={narrowing}
            asked={asked}
            onType={narrow}
            doneAt={reading.pending() ? undefined : pageFileOf(page())}
          />
        </Show>
        <Show when={reading.pending() && page() !== undefined}>
          <p class="pointer-events-none absolute top-0 m-0 text-muted" role="status">
            {reading.failure() === undefined ? "Loading…" : `Could not load page: ${reading.failure()!.message}`}
          </p>
        </Show>
        <div class="contents" {...{ [PAGE_SUBJECT]: String(here()) }} aria-busy={reading.pending()}>
        <Show
          when={page()}
          fallback={
            <Show
              when={missing()}
              fallback={<p class="m-0 py-8 text-muted">Loading…</p>}
            >
              <Empty
                testid={IDS_UI_PRIMITIVES.nothing}
                line="Page not found"
                action={{ label: "Go home", href: router.routes.href(HOME_ROUTE), testid: TESTID.missingGoHome }}
              />
            </Show>
          }
        >
          {(open) => (
            <Switch>
              <Match when={props.render}>{render => render()({get page() { return open() }, get drawn() { return narrowing.drawn() }, get held() { return allDrawn() }, get today() { return today() }})}</Match>
              <Match when={props.source}>
                {(source) => <Dynamic component={source().face} page={open()} drawn={narrowing.drawn()} today={today()} />}
              </Match>
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
                    held={only(allDrawn(), "tree")?.rows ?? []}
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
          )}
        </Show>
        </div>
      </NarrowedProvider>
      </ReadingProvider></EditorMemoryProvider>
    </main>
  )
}
