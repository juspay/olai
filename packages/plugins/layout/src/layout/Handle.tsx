/**
 * The drag handle between the directory column and the page.
 *
 * A 4px hit strip, wider than it looks so a pointer can find it. Widths are
 * live on the signal during the drag and written to localStorage only on
 * pointerup (see layout/prefs.ts), so a short drag is one storage write and
 * not twenty cross-tab re-renders.
 *
 * Keyboard users reset the width from the palette ("Reset sidebar width"); this
 * control is pointer-only.
 */
import { TESTID } from "olai-plugin-layout/testids"
import { onCleanup } from "solid-js"

import { WITHIN } from "@olai/web/client/layer.ts"

import {
SIDEBAR_MAX_PX,
SIDEBAR_MIN_PX,
} from "./prefs.ts"
import {
setSidebarWidth,
sidebarWidth,
} from "./live.ts"
import { startResize } from "./resize.ts"

/** The directory column's drag handle, on its right edge: dragging right
 *  grows it. */
export function SidebarHandle() {
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={sidebarWidth()}
      aria-valuemin={SIDEBAR_MIN_PX}
      aria-valuemax={SIDEBAR_MAX_PX}
      data-testid={TESTID.sidebarResize}
      class={`group absolute right-0 top-0 ${WITHIN.raised} h-full w-1.5 cursor-col-resize touch-none`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        stop?.()
        stop = startResize({
          event,
          startWidth: sidebarWidth(),
          min: SIDEBAR_MIN_PX,
          max: SIDEBAR_MAX_PX,
          onMove: (px) => setSidebarWidth(px, { persist: false }),
          onEnd: (px) => {
            setSidebarWidth(px, { persist: true })
            stop = undefined
          },
        })
      }}
    >
      <span
        class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-rule transition-colors group-hover:bg-accent group-active:bg-accent"
        aria-hidden="true"
      />
    </div>
  )
}
