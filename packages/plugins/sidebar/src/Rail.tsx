import { TESTID } from "olai-plugin-sidebar/testids"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { PluginRailEntries } from "./Seats.tsx"

import { setSidebarOpen } from "./shell.ts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { railEntries } from "./contract.ts"

const ICON = "size-4"

export function Rail(props: {
  readonly slots: RendererSlots
  readonly home: () => void
}) {
  return (
    <div
      class="olai-frame sticky top-[var(--height-header)] hidden h-[calc(100dvh-var(--height-header))] w-[var(--width-rail)] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-rule py-2 md:flex"
      data-testid={TESTID.sidebarRail}
      aria-label="Sidebar"
    >
      <Tip text="Expand sidebar">
        <RailButton
          testid={TESTID.sidebarExpand}
          label="Expand sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
          </svg>
        </RailButton>
      </Tip>

      <PluginRailEntries place="top" />

      <For each={props.slots.read(railEntries)}>{({value: Entry}) => <Entry />}</For>

      <PluginRailEntries place="bottom" />

      <div class="mt-auto flex flex-col items-center gap-1 empty:hidden">
        <PluginRailEntries place="foot" />
      </div>
    </div>
  )
}
