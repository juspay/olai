/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one page open.
 *
 * Layout principle: the header carries what is about the APP (wordmark,
 * connection, agent, theme); the sidebar carries what is about the DIRECTORY
 * (calendar + file tree), collapsing to an icon rail when minimized; chat is
 * a resizable dock or a minimized pill/strip. All layout state is client-local.
 *
 * This file is the composition and nothing else — the subscription, the route,
 * the clock, the one derivation of the set, which page that adds up to, and the
 * rows that page draws.
 */

import { datedDays } from "@olai/format"
import { createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js"

import { AppHeader } from "./AppHeader.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { Panel as ChatPanel } from "./chat/Panel.tsx"
import { createToday } from "./clock.ts"
import { Connection } from "./connection/Connection.tsx"
import { CLEARANCE } from "./connection/Indicator.tsx"
import { DayPage } from "./day/DayPage.tsx"
import { DocumentPage } from "./document/DocumentPage.tsx"
import { DerivedProvider } from "./derived.tsx"
import { createEditor, EditorProvider } from "./edit/editing.tsx"
import { createDocuments, DocumentsProvider } from "./document/documents.tsx"
import { Banner } from "./errors/Banner.tsx"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
import { publishLayoutCss } from "./layout/css.ts"
import { desktop } from "./layout/media.ts"
import { chatOpen, sidebarOpen, toggleSidebar } from "./layout/prefs.ts"
import { Rail } from "./layout/Rail.tsx"
import { only } from "./narrow.ts"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { createOutlines } from "./outlines.ts"
import { fileOf, pageOf, rowsFor } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { Palette } from "./palette/Palette.tsx"
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
  const today = createToday()

  // Mobile drawer open state. Ephemeral: a reload starts shut so the outline
  // has the screen. Desktop open/rail is `sidebarOpen` in layout prefs.
  const [menuOpen, setMenuOpen] = createSignal(false)

  // Publish --width-sidebar / --width-chat from the preference signals.
  publishLayoutCss()

  // When the viewport crosses the phone/desktop line, shut the mobile drawer
  // so a resize does not leave a scrim stuck on a laptop.
  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

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

  const dated = (month: string): ReadonlySet<string> => {
    const indexes = outlines.derived()
    return indexes === undefined ? new Set() : datedDays(indexes, month)
  }

  const rows = createMemo(() => {
    const indexes = outlines.derived()
    return indexes === undefined ? [] : view.visible(rowsFor(indexes, page()))
  })

  /** The caret, for whichever page is open. It is created here because it
   *  needs what is DRAWN — the same rows and the same folds — to answer where
   *  `↑`/`↓` go, and this is the one place both are in hand. Everything else
   *  about it is the editor's own (./edit/editing.tsx); nothing about a write
   *  passes through this file. */
  const editor = createEditor({ rows, collapsed: view.collapsed })

  const docked = () => outlines.manifest() !== null && page() !== undefined

  return (
    <>
      <Connection status={connectionStatus()} />
      <ChatPanel />
      <Palette
        go={(route) => router.go(route)}
        toggleDirectory={() => {
          // Desktop: open/rail preference. Phone: ephemeral drawer — do not
          // flip the desktop preference a phone cannot show.
          if (desktop()) toggleSidebar()
          else setMenuOpen(!menuOpen())
        }}
      />
      <div class="flex min-h-dvh flex-col">
        <AppHeader
          docked={docked()}
          menu={
            docked()
              ? {
                  open: menuOpen(),
                  onToggle: () => setMenuOpen(!menuOpen()),
                }
              : undefined
          }
        />
        {/* The drawer is fixed, so the page reserves its width from `lg` up —
            below that the dock covers the page (same bar as before this rework). */}
        <div
          class="flex-1"
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
                <EditorProvider editor={editor}>
                <DocumentsProvider documents={documents}>
                  {/*
                    Desktop: two columns (rail or full sidebar + main), widths
                    from --width-sidebar. Mobile: main alone; the directory is
                    a fixed drawer and must not claim a grid track.
                  */}
                  <div class="relative min-h-[calc(100dvh-var(--height-header))] md:grid md:grid-cols-[var(--width-sidebar)_1fr]">
                    <Show when={desktop() && !sidebarOpen()}>
                      <Rail go={(route) => router.go(route)} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
                      <Sidebar
                        files={outlines.files()}
                        documents={documents.paths()}
                        active={fileOf(open())}
                        broken={outlines.broken()}
                        open={desktop() ? true : menuOpen()}
                        onClose={() => setMenuOpen(false)}
                      >
                        <Calendar
                          today={today()}
                          open={only(open(), "day")?.date}
                          days={dated}
                        />
                      </Sidebar>
                    </Show>
                    {/* Extra bottom pad on phone when the chat strip is up so
                        the last lines of a long page are not trapped under it. */}
                    <main
                      class={`overflow-x-auto px-4 pt-4 ${CLEARANCE} md:px-12 md:py-8 lg:pl-16 lg:pr-12 ${
                        !desktop() && !chatOpen() ? "pb-16" : ""
                      }`}
                    >
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
                          {(outline) => (
                            <OutlinePage
                              file={outline().file}
                              rows={rows()}
                              view={view}
                            />
                          )}
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
                </EditorProvider>
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
