/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one or more panes, each a full page.
 *
 * Layout principle: the header carries what is about the APP (wordmark,
 * connection, agent, preferences); the sidebar carries what is about the
 * DIRECTORY (the agenda, the calendar, the file tree), collapsing to an icon
 * rail when minimized; chat is a resizable dock or a minimized pill/strip.
 * The main column is a LIST of routes (`./workspace.ts`) — one pane is the
 * page this app has always been; two or more are the same page component
 * side by side, never a stripped copy.
 *
 * This file is the composition and nothing else — the subscription, the
 * workspace, the clock, the one derivation of the set, and the chrome
 * that sits outside every pane.
 */

import { agendaOf, dailyNoteDays, datedDays } from "@olai/format"
import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js"

import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Commit } from "./commit/Commit.tsx"
import { Connection } from "./connection/Connection.tsx"
import { DerivedProvider } from "./derived.tsx"
import { createDocuments, DocumentsProvider } from "./document/documents.tsx"
import { createUndo, UndoContext } from "./edit/undoing.ts"
import { UndoSaid } from "./edit/UndoSaid.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { publishLayoutCss } from "./layout/css.ts"
import { desktop } from "./layout/media.ts"
import { chatOpen, sidebarOpen, toggleSidebar } from "./layout/prefs.ts"
import { Rail } from "./layout/Rail.tsx"
import { only } from "./narrow.ts"
import { OpensProvider } from "./opens.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, opensAt, pageOf } from "./page.ts"
import { Palette } from "./palette/Palette.tsx"
import { Panes } from "./pane/Panes.tsx"
import { createRouter, RouterProvider } from "./router.tsx"
import { runAsync } from "./run.ts"
import { ServedProvider } from "./served.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { TodayProvider } from "./today.tsx"
import { connectionReadout, olai } from "./wire.ts"
import { isLone } from "./workspace.ts"

export default function App() {
  const outlines = createOutlines()
  const documents = createDocuments()
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const today = createToday()

  const [menuOpen, setMenuOpen] = createSignal(false)

  publishLayoutCss()

  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const problems = () => errors.value() ?? []

  const found = createMemo(() => ({
    files: outlines.files(),
    documents: documents.paths(),
    broken: outlines.broken(),
  }))

  // The FOCUSED pane's page — what the sidebar lights up, what the palette
  // may write about, what undo treats as the open file. Each pane resolves
  // its own page inside `./pane/PageView.tsx`; this is the one the chrome
  // beside the workspace has to agree with, and it is asked of the focused
  // route so a click in the directory never targets "leftmost".
  const focusedPage = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined
      ? undefined
      : pageOf(indexes, found(), router.route(), today())
  })

  const agenda = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? undefined : agendaOf(indexes, today())
  })

  const dated = (month: string): ReadonlySet<string> => {
    const indexes = outlines.derived()
    return indexes === undefined ? new Set() : datedDays(indexes, month)
  }

  const noted = (month: string): ReadonlySet<string> =>
    dailyNoteDays(documents.paths(), month)

  const zoomed = createMemo(() => {
    const open = focusedPage()
    if (open === undefined) return undefined
    const node = only(open, "node")
    return node === undefined ? undefined : only(node.zoomed, "node")
  })

  const undo = createUndo((edit) => runAsync(olai.procedures.edit.apply(edit)))
  const openFile = createMemo(() => {
    const open = focusedPage()
    return open === undefined ? undefined : fileOf(open)
  })
  createEffect(on(openFile, () => undo.clear(), { defer: true }))

  const docked = () => outlines.manifest() !== null && focusedPage() !== undefined
  const split = () => !isLone(router.workspace())

  return (
    <UndoContext.Provider value={undo}>
      <RouterProvider router={router}>
      <DerivedProvider derived={outlines.derived()}>
      <OpensProvider opens={(path, at) => opensAt(found(), path, at)}>
      <ServedProvider outlines={found().files} documents={found().documents}>
      <Connection readout={connectionReadout()} />
      <ChatPanel />
      <Palette
        zoomed={zoomed()}
        go={(route) => router.go(route)}
        toggleDirectory={() => {
          if (desktop()) toggleSidebar()
          else setMenuOpen(!menuOpen())
        }}
      />
      <UndoSaid said={undo.said()} />
      <div class="flex min-h-dvh flex-col">
        <AppHeader
          docked={docked()}
          go={(route) => router.go(route)}
          menu={
            docked()
              ? {
                  open: menuOpen(),
                  onToggle: () => setMenuOpen(!menuOpen()),
                }
              : undefined
          }
        />
        <div
          class="flex-1"
          classList={{
            "lg:pr-[var(--width-chat)]": chatOpen(),
            "min-h-0": split(),
          }}
        >
          <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
          <Match when={outlines.manifest() === null}>
            <ErrorPage errors={problems()} />
          </Match>
          <Match when={focusedPage()}>
            {(open) => (
                <TodayProvider today={today()}>
                <DocumentsProvider documents={documents}>
                  <div
                    class="relative md:grid md:grid-cols-[var(--width-sidebar)_1fr]"
                    classList={{
                      "h-[calc(100dvh-var(--height-header))] min-h-0": split(),
                      "min-h-[calc(100dvh-var(--height-header))]": !split(),
                    }}
                  >
                    <Show when={desktop() && !sidebarOpen()}>
                      <Rail go={(route) => router.go(route)} agenda={agenda()} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
                      <Sidebar
                        files={outlines.files()}
                        documents={documents.paths()}
                        active={fileOf(open())}
                        broken={outlines.broken()}
                        agenda={agenda()}
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
                    <Panes
                      derived={outlines.derived()}
                      found={found()}
                      today={today()}
                      agenda={agenda()}
                      problems={problems()}
                    />
                  </div>
                </DocumentsProvider>
                </TodayProvider>
            )}
            </Match>
          </Switch>
        </div>
      </div>
      </ServedProvider>
      </OpensProvider>
      </DerivedProvider>
      </RouterProvider>
    </UndoContext.Provider>
  )
}
