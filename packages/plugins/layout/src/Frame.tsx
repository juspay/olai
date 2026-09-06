import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { contentStatus,overlays,sidebar } from "./index.ts"
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

import {
createEffect,
createSignal,
Show
} from "solid-js"

import { Offline } from "@olai/web/client/connection/Offline.tsx"
import { Panes } from "olai-plugin-layout/pane/Panes.tsx"
import { PluginBanners } from "./Chrome.tsx"
import { PluginsMounted } from "./Mounted.tsx"
import { PluginPanel } from "./Seats.tsx"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { desktop } from "olai-plugin-layout/media"
import { panelOpen,sidebarOpen,toggleSidebar } from "olai-plugin-layout/preferences"
import { SHELL_LONE,SHELL_SPLIT } from "olai-plugin-layout/sheet"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { RouterProvider } from "olai-plugin-navigation/routing"
import { isLone } from "olai-plugin-navigation/workspace"
import { Header } from "./Header.tsx"
import { SidebarHandle } from "./layout/Handle.tsx"
import { Tools } from "./Tools.tsx"

export default function Frame(props: { readonly slots: RendererSlots; readonly router: import("olai-plugin-navigation/contract").Navigation }) {
  const router = props.router

  const [menuOpen, setMenuOpen] = createSignal(false)


  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const split = () => !isLone(router.workspace())

  return (
      <RouterProvider router={router}>
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
      <Offline readout={connectionReadout()} />
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
        <Header
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
            "lg:pr-[var(--width-panel)]": panelOpen(),
            "min-h-0": split(),
          }}
        >
                  <div
                    class="relative md:grid"
                    classList={{
                      [SHELL_SPLIT]: split(),
                      "md:grid-cols-[var(--width-sidebar)_1fr]": props.slots.read(sidebar).length > 0,
                      [SHELL_LONE]: !split(),
                    }}
                  >
                    <For each={props.slots.read(sidebar)}>{({ value: parts }) => <>
                    <Show when={desktop() && !sidebarOpen()}>
                      <parts.Rail home={() => router.go(HOME_ROUTE)} />
                    </Show>
                    <Show when={desktop() ? sidebarOpen() : true}>
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
                          desktop() ? undefined : (
                            <>
                              <Tools slots={props.slots} where="closet" />
                            </>
                          )
                        }
                      />
                    </Show>
                    </>}</For>
                    <div class="min-w-0 bg-paper">
                      <For each={props.slots.read(contentStatus)}>{({value})=><value.Message/>}</For>
                      <Show when={props.slots.read(contentStatus).every(({value})=>value.ready())}><Panes trouble={null}/></Show>
                    </div>
                  </div>
        </div>
      </div>
      </PluginsMounted>
      </RouterProvider>
  )
}
