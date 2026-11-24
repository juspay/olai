/**
 * The whole app: a header of the app's own chrome, a sidebar of the directory,
 * and one or more panes, each a full page.
 *
 * Layout principle: the header carries what is about the APP (wordmark, and
 * on desktop the connection, git, agent, preferences). On a phone those four
 * leave the bar: connection and git are banners when they are news, the agent
 * is the thumb strip, preferences live in the directory drawer. The sidebar
 * carries what is about the DIRECTORY (the agenda, the inbox, the calendar,
 * the file tree), collapsing to an icon rail when minimized.
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
import { contentStatus,overlays,sidebar,thumbs } from "./index.ts"
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
import { connectionCard, connectionReadout, rosterChanging } from "@olai/web/client/wire.ts"
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
  /** WHEN A SPLIT IS COLUMNS: on a desktop. The same list below `md` is one
   *  page with a strip of tabs over it, which is a LONE page's sheet
   *  (`./pane/Panes.tsx` draws the strip and says why the box must grow). */
  const columns = createMemo(() => split() && desktop())
  const ready = createMemo(() => props.slots.read(contentStatus).every(({ value }) => value.ready()))
  onCleanup(router.drawContent(ready))
  const started = createMemo((was: boolean) => was || ready(), false)

  return (
      <RouterProvider router={router}>
      <TipFloor.Provider value={() => header?.getBoundingClientRect().bottom ?? 0}>
      <PluginsMounted>
      {/* THE FREEZE, over everything — the app takes no gesture at all while
          the wire cannot carry a question (`./connection/Offline.tsx`, the
          human's §5b ruling). It is drawn beside the chrome rather than inside
          the page's arm because it covers the chrome too; WHERE it sits in this
          composition decides nothing about what it paints over, because it is a
          `<dialog>` in the top layer rather than a box with a number on it. */}
      <Offline readout={connectionReadout()} memory={focus} rosterChanging={rosterChanging} card={connectionCard} />
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
        {/* A SPLIT IS COLUMNS ONLY ON A DESKTOP. Below `md` the same list is
            a strip of tabs over ONE page (`./pane/Panes.tsx`), and that page
            is read by scrolling the document — so the shell grows with it,
            exactly as a lone page's does. Clamped to the viewport it was a
            box one screen tall with a conversation spilling out of it, and
            everything `sticky` inside this box — the bar, the tab strip, a
            page's own head — stopped sticking at the first screen's end,
            which is why the way back to a note scrolled away. */}
        <div
          class="flex-1"
          classList={{
            "min-h-0": columns(),
          }}
        >
                  <div
                    class="relative md:grid"
                    classList={{
                      [SHELL_SPLIT]: columns(),
                      // Split columns own scrolling. In particular, sticky
                      // children after a resize must not extend document overflow.
                      "md:overflow-clip": split(),
                      // THE COLUMNS: the directory and the page. The width is
                      // the token `layout/css.ts` publishes, so the grid and
                      // the column it holds read one number.
                      "md:grid-cols-[var(--width-sidebar)_1fr]": props.slots.read(sidebar).length > 0,
                      [SHELL_LONE]: !columns(),
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
                      {/* The tabs over these panes are drawn in the bar
                          (`./Header.tsx`), so nothing stands between it and a
                          page: a sticky head under it clears `--height-chrome`,
                          which is the bar alone here. */}
                      <For each={props.slots.read(contentStatus)}>{({value})=><value.Message/>}</For>
                      <div style={{ display: ready() ? "contents" : "none" }}><Show when={started()}><Panes/></Show></div>
                    </div>
                  </div>
        </div>
        {/* THE THUMB BAR, on a phone, while somebody is in the seat
            (`./index.ts`'s `thumbs`): the doors a thumb reaches without the
            drawer — today, what is owed, the chats, a capture. Pinned to the
            foot of the viewport at the strip's layer: over the page and the
            drawer's scrim, under the drawer itself, so a door is pressable
            with the page dimmed and a drawer sliding over it covers it. The
            frame publishes its height as `--height-bottom-chrome` for every
            page's clearance (`./layout/css.ts`). */}
        <Show when={!desktop() && props.slots.read(thumbs).length > 0}>
          <nav
            class={`fixed inset-x-0 bottom-0 ${LAYER.strip} olai-frame flex items-stretch pb-[env(safe-area-inset-bottom,0px)] shadow-[inset_0_1px_0_var(--color-rule)] md:hidden`}
            data-testid={LAYOUT_TESTID.thumbs}
            aria-label="Quick access"
          >
            <For each={[...props.slots.read(thumbs)].sort((a, b) => a.value.order - b.value.order)}>
              {({ value: door }) => <door.body />}
            </For>
          </nav>
        </Show>
      </div>
      </PluginsMounted>
      </TipFloor.Provider>
      </RouterProvider>
  )
}
