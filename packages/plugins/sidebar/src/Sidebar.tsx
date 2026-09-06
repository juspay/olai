/** Sidebar owns its container and child regions. Feature entries acquire and
 * withdraw independently; no notebook tree or reading belongs to this plugin. */
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { LAYER,WITHIN } from "@olai/web/client/layer.ts"
import { PluginEntries,PluginSections } from "./Seats.tsx"
import { TESTID } from "@olai/web/client/testids.ts"
import { setSidebarOpen } from "olai-plugin-layout/preferences"
import { For,Show } from "solid-js"
import { regions,type SidebarRegionProps } from "./contract.ts"
function Regions(props: { at: string; props: SidebarRegionProps }) {
  return <For each={props.props.slots.read(regions).filter(({ value }) => value.at === props.at)}>{({ value }) => <value.Body {...props.props} />}</For>
}
export function Sidebar(props: SidebarRegionProps) {
  return (
    <>
      {/* Mobile scrim: under the header so app chrome stays tappable (#101). */}
      <Show when={props.open}>
        <button
          type="button"
          class={`fixed inset-x-0 bottom-0 top-[var(--height-header)] ${LAYER.page} bg-ink/40 md:hidden`}
          data-testid={TESTID.sidebarScrim}
          aria-label="close the directory"
          onClick={() => props.onClose()}
        />
      </Show>

      <nav
        class={
          // Mobile closed: `hidden` (off-screen translate still counts as
          // visible to Playwright). Mobile open: FIXED under the header —
          // never also `relative` (that utility wins the cascade and demotes
          // the drawer into flow offsets). Desktop: a STICKY column, pinned
          // under the header (see the note above).
          (props.open ? "flex " : "hidden ") +
          `${LAYER.chrome} olai-frame flex-col border-r border-paper/20 ` +
          // Wide enough that the month's 7 day cells still hit 44×44.
          "fixed bottom-0 left-0 top-[var(--height-header)] w-[min(22rem,92vw)] " +
          // `top-` above is BOTH positions' offset — the drawer's inset and
          // this column's sticky threshold are the same seam, so they read the
          // same token. `bottom`/`left` are the drawer's alone and must not
          // survive here: an inset on a sticky box is a constraint against the
          // scrollport, not a place to sit.
          "md:sticky md:bottom-auto md:left-auto md:flex " +
          "md:h-[calc(100dvh-var(--height-header))] md:w-full md:translate-x-0"
        }
        data-testid={TESTID.sidebar}
        data-open={props.open ? "true" : "false"}
      >
        {/* Desktop: collapse sits at the bottom of the column so it cannot
            cover the calendar's month-step chevrons (top-right of the body). */}
        <button
          type="button"
          class={`absolute bottom-2 right-2 ${WITHIN.raised} hidden ${TARGET_BOX} items-center justify-center rounded-full border border-paper/20 bg-ink text-paper/65 hover:bg-paper/10 hover:text-paper md:inline-flex md:min-h-8 md:min-w-8`}
          data-testid={TESTID.sidebarCollapse}
          aria-label="collapse the sidebar to the icon rail"
          title="collapse sidebar"
          onClick={() => setSidebarOpen(false)}
        >
          <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
            <path d="M9.78 3.22a.75.75 0 0 1 0 1.06L6.56 8l3.22 3.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0z" />
          </svg>
        </button>
        <div class="hidden md:contents">
          <props.Resize />
        </div>

        <div
          class="olai-scroll min-h-0 flex-1 overflow-y-auto p-3"
          data-testid={TESTID.sidebarBody}
          // Any navigation (day, outline, document) bubbles here and puts the
          // mobile drawer away. Folder folds stop propagation so a reader can
          // open several without reopening the drawer each time.
          onClick={() => props.onClose()}
        >
          <PluginEntries place="top" />
          <Regions at="primary" props={props} />
          {/* WHAT THE PLUGINS HANG HERE, in the bundle's order — the agents
              roster is the first and, today, the only one. A row reading *needs
              you* is the same kind of fact as the agenda's alarm and the
              inbox's count, and the shelf's own 2026-08-19 ruling is exactly
              about what may NOT come ahead of those, which is why the seat is
              HERE rather than at the foot. A section draws nothing at all where
              its plugin has nothing to say — the roster does in a directory
              with no node agent — so the column's budget is untouched where a
              feature is unused, and a serve running no chat has no section at
              all (`./plugins/Seats.tsx`). */}
          <PluginSections />
          <PluginEntries place="bottom" />

          <Regions at="shelf" props={props} />
          <Regions at="files" props={props} />
        </div>
        <Show when={props.foot}>
          {(foot) => (
            <div class="shrink-0 border-t border-paper/15 p-3">
              {foot()}
            </div>
          )}
        </Show>
      </nav>
    </>
  )
}
