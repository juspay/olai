import { TESTID } from "olai-plugin-sidebar/testids"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { LAYER,WITHIN } from "@olai/web/client/layer.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { PluginEntries,PluginSections } from "./Seats.tsx"

import { setSidebarOpen } from "./shell.ts"
import { children, For, Show } from "solid-js"
import { regions,type SidebarRegionProps } from "./contract.ts"
function Regions(props: { at: string; props: SidebarRegionProps }) {
  return <For each={props.props.slots.read(regions).filter(({ value }) => value.at === props.at)}>{({ value }) => <value.Body {...props.props} />}</For>
}
export function Sidebar(props: SidebarRegionProps) {
  const foot = children(() => props.foot)
  return (
    <>
      <Show when={props.open}>
        <button
          type="button"
          class={`fixed inset-x-0 bottom-0 top-[var(--height-header)] ${LAYER.page} bg-ink/40 md:hidden`}
          data-testid={TESTID.sidebarScrim}
          aria-label="Close sidebar"
          onClick={() => props.onClose()}
        />
      </Show>

      <nav
        class={
          (props.open ? "flex " : "hidden ") +
          `${LAYER.chrome} olai-frame flex-col border-r border-rule ` +
          "fixed bottom-0 left-0 top-[var(--height-header)] w-[min(22rem,92vw)] " +
          "md:sticky md:bottom-auto md:left-auto md:flex " +
          "md:h-[calc(100dvh-var(--height-header))] md:w-full md:translate-x-0"
        }
        data-testid={TESTID.sidebar}
        data-open={props.open ? "true" : "false"}
      >
        <Tip text="Collapse sidebar">
          <button
            type="button"
            class={`absolute bottom-2 right-2 ${WITHIN.raised} hidden ${TARGET_BOX} items-center justify-center rounded-control text-muted hover:bg-ink/5 hover:text-ink md:inline-flex md:min-h-7 md:min-w-7`}
            data-testid={TESTID.sidebarCollapse}
            aria-label="Collapse sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
              <path d="M9.78 3.22a.75.75 0 0 1 0 1.06L6.56 8l3.22 3.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0z" />
            </svg>
          </button>
        </Tip>
        <div class="hidden md:contents">
          <props.Resize />
        </div>

        <div
          class="olai-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2"
          data-testid={TESTID.sidebarBody}
          onClick={() => props.onClose()}
        >
          <PluginEntries place="top" />
          <Regions at="primary" props={props} />
          <PluginSections />
          <PluginEntries place="bottom" />

          <Regions at="shelf" props={props} />
          <Regions at="files" props={props} />
        </div>
        <div
          class="shrink-0 px-2 pb-2 pt-1 empty:hidden md:pr-11"
          data-testid={TESTID.sidebarFoot}
          onClick={() => props.onClose()}
        >
          <PluginEntries place="foot" />
        </div>
        <Show when={foot()}>
          {(foot) => (
            <div class="shrink-0 border-t border-rule p-2">
              {foot()}
            </div>
          )}
        </Show>
      </nav>
    </>
  )
}
