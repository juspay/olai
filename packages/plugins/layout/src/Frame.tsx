/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one or more panes, each a full page.
 *
 * Layout principle: the header carries what is about the APP (wordmark, and
 * on desktop the connection, git, agent, preferences). On a phone those four
 * leave the bar: connection and git are banners when they are news, the agent
 * is the thumb strip, preferences live in the directory drawer. The sidebar
 * carries what is about the DIRECTORY (the agenda, the inbox, the calendar,
 * the file tree), collapsing to an icon rail when minimized; chat is a
 * resizable dock or a minimized pill/strip.
 * The main column is a LIST of routes (`./workspace.ts`) — one pane is the
 * page this app has always been; two or more are the same page component
 * side by side, never a stripped copy.
 *
 * This file is the composition and nothing else — the subscriptions, the
 * workspace, the clock, the directory, and the chrome that sits outside every
 * pane. What each PANE shows is a subscription of its own
 * (`./reading.tsx`), asked of the address that pane is drawing.
 */
import { LAYER } from "@olai/web/client/layer.ts"
import { TipFloor } from "@olai/web/client/Tip.tsx"
import { TESTID as LAYOUT_TESTID } from "./testids.ts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { contentStatus,overlays,sidebar,strip } from "./index.ts"
import {
createEffect,
createMemo,
onCleanup,
Show
} from "solid-js"

import { Offline } from "@olai/web/client/connection/Offline.tsx"
import { watchFocus } from "@olai/web/client/connection/focus.ts"
import { Panes } from "olai-plugin-layout/pane/Panes.tsx"
import { PluginBanners } from "./Chrome.tsx"
import { PluginsMounted } from "./Mounted.tsx"
import { PluginPanel } from "./Seats.tsx"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { desktop } from "./layout/live.ts"
import { drawerOpen as menuOpen,setDrawerOpen as setMenuOpen,sidebarOpen,toggleSidebar } from "./layout/live.ts"
import { SHELL_LONE,SHELL_SPLIT } from "olai-plugin-layout/sheet"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { RouterProvider } from "olai-plugin-navigation/routing"
import { Header } from "./Header.tsx"
import { SidebarHandle } from "./layout/Handle.tsx"
import { Tools } from "./Tools.tsx"

export default function Frame(props: { readonly slots: RendererSlots; readonly router: import("olai-plugin-navigation/contract").Navigation }) {
  let header: HTMLElement | undefined
  let stripElement: HTMLDivElement | undefined
  const router = props.router
  // THE CARET'S MEMORY, for the freeze this frame draws: the dialog takes the
  // keyboard when the wire goes and hands it back when it returns, and the
  // element it goes back to is remembered here rather than guessed by the
  // browser — see `@olai/web/client/connection/focus.ts` for the half of that
  // the browser cannot do. `watchFocus` registers its own `onCleanup`, so the
  // listener goes with this frame.
  const focus = watchFocus()

  // The phone drawer is this frame's for as long as it is drawn — a signal in
  // `./layout/live.ts` so `layout.shell`'s `revealSidebar` can open it from a
  // control outside the sidebar — and it starts shut and leaves shut.
  setMenuOpen(false)
  onCleanup(() => setMenuOpen(false))

  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const split = router.split
  const ready = createMemo(() => props.slots.read(contentStatus).every(({ value }) => value.ready()))
  onCleanup(router.drawContent(ready))
  const started = createMemo((was: boolean) => was || ready(), false)

  return (
      <RouterProvider router={router}>
      <TipFloor.Provider value={() => (stripElement?.isConnected ? stripElement : header)?.getBoundingClientRect().bottom ?? 0}>
      <PluginsMounted>
      {/* ABOVE THE CHAT PANEL, not only around the page: today is a fact about
          the TAB (`./clock.ts`), and the panel reads it too — the `@` list's
          node half is matched by the format's own grammar, whose relative words
          (`@date:today`) count from the day the reader is standing on. Under
          the page's own arm, as it was, the composer's only way to that day
          would be a second `createToday()` — a second midnight timer and a
          second answer to what day it is, in a tab that is supposed to have
          one. */}
      {/* THE FREEZE, over everything — the app takes no gesture at all while
          the wire cannot carry a question (`./connection/Offline.tsx`, the
          human's §5b ruling). It is drawn beside the chrome rather than inside
          the page's arm because it covers the chrome too; WHERE it sits in this
          composition decides nothing about what it paints over, because it is a
          `<dialog>` in the top layer rather than a box with a number on it. */}
      <Offline readout={connectionReadout()} memory={focus} />
      {/* THE PANEL IN THE SEAT THIS APP RESERVES FOR ONE — whichever plugin took
          it, or nothing at all where none did. It was `<ChatPanel />`, an import
          of a feature by name; the shell keeps the seat's geometry and the plugin
          draws inside it (`./plugins/Seats.tsx`). */}
      <PluginPanel />
      <For each={props.slots.read(overlays)}>{({value: Overlay})=><Overlay
        toggleDirectory={()=>{if(desktop())toggleSidebar();else setMenuOpen(!menuOpen())}}
      />}</For>
      {/* No ground of its own: `html` is already ink (./styles.css), and what
          shows through here — the strip under a sticky spine on a page taller
          than the viewport — is that same forest either way. */}

      <div
        class="flex min-h-dvh flex-col"

      >
        <Header ref={element => { header = element }}
          slots={props.slots}
          docked={true}
          menu={
            props.slots.read(sidebar).length > 0
              ? {
                  open: menuOpen(),
                  onToggle: () => setMenuOpen(!menuOpen()),
                }
              : undefined
          }
        />
        <PluginBanners />
        <div
          class="flex-1"
          classList={{
            "min-h-0": split(),
          }}
        >
                  <div
                    class="relative md:grid"
                    classList={{
                      [SHELL_SPLIT]: split(),
                      // Split columns own scrolling. In particular, sticky
                      // children after a resize must not extend document overflow.
                      "md:overflow-clip": split(),
                      "md:grid-cols-[var(--width-sidebar)_1fr]": props.slots.read(sidebar).length > 0,
                      [SHELL_LONE]: !split(),
                    }}
                  >
                    <For each={props.slots.read(sidebar)}>{({ value: parts }) => <>
                    <Show when={desktop() && !sidebarOpen()}>
                      <parts.Rail home={() => router.go(HOME_ROUTE)} />
                    </Show>
                    <div style={{ display: desktop() && !sidebarOpen() ? "none" : "contents" }}>
                      <parts.Sidebar
                        Resize={SidebarHandle}
                        open={desktop() ? true : menuOpen()}
                        onClose={() => setMenuOpen(false)}
                        foot={
                          // THE CLOSET, on a phone: the two doors the header
                          // cannot afford a chip for. Plugins under
                          // preferences, which is the order the desktop bar
                          // reads left to right — a reader who learnt one
                          // arrangement does not have to learn a second.
                          desktop() ? undefined : <Tools slots={props.slots} where="closet" />
                        }
                      />
                    </div>
                    </>}</For>
                    <div class="min-w-0 bg-paper">
                      {/* THE SEAT ABOVE THE PANES (`./index.ts`'s `strip`), on a
                          desktop. Pinned under the header while a lone page
                          scrolls; page headings and jumps reserve both bands
                          through the static --height-chrome contract. Layout owns
                          the opaque desk ground; the occupant fills this seat. */}
                      <Show when={desktop() && props.slots.read(strip).length > 0}>
                        <div ref={stripElement} data-testid={LAYOUT_TESTID.mainStrip} class={`sticky top-[var(--height-header)] h-[var(--height-strip)] bg-desk ${LAYER.strip}`}>
                          <For each={props.slots.read(strip)}>{({value: Strip})=><Strip/>}</For>
                        </div>
                      </Show>
                      <For each={props.slots.read(contentStatus)}>{({value})=><value.Message/>}</For>
                      <div style={{ display: ready() ? "contents" : "none" }}><Show when={started()}><Panes/></Show></div>
                    </div>
                  </div>
        </div>
      </div>
      </PluginsMounted>
      </TipFloor.Provider>
      </RouterProvider>
  )
}
