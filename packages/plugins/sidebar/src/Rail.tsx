/**
 * The minimized desktop sidebar: a ~3rem icon rail.
 *
 * App chrome never disappears — expand, plugin entries, outlines, docs stay as
 * affordances even when the full directory column is put away. The connection
 * dot and the agent toggle stay in the HEADER (reconciled with #101); this
 * rail is only the directory's collapsed face.
 *
 * Which is why it is PINNED on the same terms the open column is
 * (`../Sidebar.tsx`): `sticky` under the header, as tall as what is left of the
 * viewport. "Never disappears" is a claim about the screen, not about the
 * document — five icons at the top of a page-tall column are gone as soon as
 * anybody reads past the fold, and the first of them is the way to get the
 * directory back. It scrolls within itself in a window too short for five
 * buttons rather than clipping the last of them.
 */

import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { PluginRailEntries } from "@olai/web/client/plugins/Seats.tsx"
import { TESTID } from "@olai/web/client/testids.ts"
import { setSidebarOpen } from "olai-plugin-layout/preferences"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { railEntries } from "./contract.ts"

/** How big an icon on this rail is. Spelled once because five buttons draw one
 *  — three inline here and two that are the directory's own glyphs
 *  (`../file/icons.tsx`, which takes its size from whoever draws it) — and a
 *  rail whose icons are not all one size is the only thing a reader would
 *  notice about the number. */
const ICON = "size-4"

export function Rail(props: {
  readonly slots: RendererSlots
  /** Navigate without a full Link tree — the rail is outside the router
   *  provider on some screens, so it takes a callback the shell already has. */
  readonly home: () => void
}) {
  return (
    <div
      class="olai-frame sticky top-[var(--height-header)] hidden h-[calc(100dvh-var(--height-header))] w-[var(--width-rail)] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-paper/20 py-2 md:flex"
      data-testid={TESTID.sidebarRail}
      aria-label="directory rail"
    >
      <RailButton
        testid={TESTID.sidebarExpand}
        label="expand the sidebar"
        title="expand sidebar"
        onClick={() => setSidebarOpen(true)}
      >
        {/* chevron-right */}
        <svg viewBox="0 0 16 16" class={ICON} aria-hidden="true" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </RailButton>

      <PluginRailEntries place="top" />

      <For each={props.slots.read(railEntries)}>{({value: Entry}) => <Entry />}</For>

      <PluginRailEntries place="bottom" />
    </div>
  )
}
