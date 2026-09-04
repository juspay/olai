/**
 * The drag handle between a panel and the page.
 *
 * A 4px hit strip, wider than it looks so a pointer can find it. Widths are
 * live on the signal during the drag and written to localStorage only on
 * pointerup (see layout/prefs.ts), so a short drag is one storage write and
 * not twenty cross-tab re-renders.
 *
 * Keyboard users reset widths from the palette ("Reset panel widths"); this
 * control is pointer-only.
 */

import { onCleanup } from "solid-js"

import { WITHIN } from "../layer.ts"
import { TESTID, type TestId } from "../testids.ts"
import {
  PANEL_MAX_PX,
  PANEL_MIN_PX,
  panelWidth,
  setPanelWidth,
  setSidebarWidth,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
  sidebarWidth,
} from "./prefs.ts"
import { startResize, type ResizeEdge } from "./resize.ts"

export function SidebarHandle() {
  return (
    <ResizeHandle
      edge="right"
      testid={TESTID.sidebarResize}
      label="resize the sidebar"
      width={sidebarWidth}
      min={SIDEBAR_MIN_PX}
      max={SIDEBAR_MAX_PX}
      onLive={(px) => setSidebarWidth(px, { persist: false })}
      onCommit={(px) => setSidebarWidth(px, { persist: true })}
    />
  )
}

export function PanelHandle() {
  return (
    <ResizeHandle
      edge="left"
      testid={TESTID.panelResize}
      label="resize the agent panel"
      width={panelWidth}
      min={PANEL_MIN_PX}
      max={PANEL_MAX_PX}
      onLive={(px) => setPanelWidth(px, { persist: false })}
      onCommit={(px) => setPanelWidth(px, { persist: true })}
    />
  )
}

function ResizeHandle(props: {
  readonly edge: ResizeEdge
  readonly testid: TestId
  readonly label: string
  readonly width: () => number
  readonly min: number
  readonly max: number
  readonly onLive: (px: number) => void
  readonly onCommit: (px: number) => void
}) {
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      aria-valuenow={props.width()}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      data-testid={props.testid}
      data-edge={props.edge}
      class={
        `group absolute top-0 ${WITHIN.raised} h-full w-1.5 cursor-col-resize touch-none ` +
        (props.edge === "right" ? "right-0" : "left-0")
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return
        stop?.()
        stop = startResize({
          event,
          edge: props.edge,
          startWidth: props.width(),
          min: props.min,
          max: props.max,
          onMove: props.onLive,
          onEnd: (px) => {
            props.onCommit(px)
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
