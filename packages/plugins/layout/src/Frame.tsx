import { LAYER } from "@olai/web/client/layer.ts"
import { TipFloor } from "@olai/web/client/Tip.tsx"
import { TESTID as LAYOUT_TESTID } from "./testids.ts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { contentStatus,overlays,sidebar,strip,thumbs } from "./index.ts"
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
import { connectionReadout, rosterChanging } from "@olai/web/client/wire.ts"
import { desktop } from "./layout/live.ts"
import { drawerOpen as menuOpen,setDrawerOpen as setMenuOpen,sidebarOpen,toggleSidebar } from "./layout/live.ts"
import { sheetHeight } from "olai-plugin-layout/sheet"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { RouterProvider } from "olai-plugin-navigation/routing"
import { Header } from "./Header.tsx"
import { SidebarHandle } from "./layout/Handle.tsx"
import { Tools } from "./Tools.tsx"

export default function Frame(props: { readonly slots: RendererSlots; readonly router: import("olai-plugin-navigation/contract").Navigation }) {
  let header: HTMLElement | undefined
  let stripElement: HTMLDivElement | undefined
  const router = props.router
  const focus = watchFocus()

  setMenuOpen(false)
  onCleanup(() => setMenuOpen(false))

  createEffect(() => {
    if (desktop()) setMenuOpen(false)
  })

  const split = router.split
  const columns = createMemo(() => split() && desktop())
  const ready = createMemo(() => props.slots.read(contentStatus).every(({ value }) => value.ready()))
  onCleanup(router.drawContent(ready))
  const started = createMemo((was: boolean) => was || ready(), false)

  return (
      <RouterProvider router={router}>
      <TipFloor.Provider value={() => (stripElement?.isConnected ? stripElement : header)?.getBoundingClientRect().bottom ?? 0}>
      <PluginsMounted>
      <Offline readout={connectionReadout()} memory={focus} rosterChanging={rosterChanging} />
      <For each={props.slots.read(overlays)}>{({value: Overlay})=><Overlay
        toggleDirectory={()=>{if(desktop())toggleSidebar();else setMenuOpen(!menuOpen())}}
      />}</For>

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
            "min-h-0": columns(),
          }}
        >
                  <div
                    class="relative md:grid"
                    classList={{
                      [sheetHeight({ underStrip: false, split: columns() })]: true,
                      "md:overflow-clip": split(),
                      "md:grid-cols-[var(--width-sidebar)_1fr]": props.slots.read(sidebar).length > 0,
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
                          desktop() ? undefined : <Tools slots={props.slots} where="closet" />
                        }
                      />
                    </div>
                    </>}</For>
                    <div class="min-w-0 bg-paper">
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
