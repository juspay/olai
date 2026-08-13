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

import { TESTID, type TestId } from "../testids.ts"
import {
  CHAT_MAX_PX,
  CHAT_MIN_PX,
  chatWidth,
  setChatWidth,
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

export function ChatHandle() {
  return (
    <ResizeHandle
      edge="left"
      testid={TESTID.chatResize}
      label="resize the agent panel"
      width={chatWidth}
      min={CHAT_MIN_PX}
      max={CHAT_MAX_PX}
      onLive={(px) => setChatWidth(px, { persist: false })}
      onCommit={(px) => setChatWidth(px, { persist: true })}
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
        "group absolute top-0 z-10 h-full w-1.5 cursor-col-resize touch-none " +
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
      {/* NOTHING AT REST, and the accent under the pointer.

          This line used to be `bg-rule` at half strength, on the argument that
          the affordance had to be visible. The depth pass took that argument
          away: the seam it was drawing IS a change of altitude now — the sheet's
          own edge on one side, the dock's shadow on the other — so a hairline
          here was the border the pass claims to have removed, drawn one more
          time. And `rule` is a value each palette wrote for its own borders, so
          on `robot` (whose rule IS its alarm) half strength was still a red frame
          the height of the window, louder than the accent the pass had just
          finished rationing.

          What is left is the platform's own idiom for a draggable edge: a 6px
          strip that answers `col-resize`, and a line that appears when the
          pointer is on it. The strip is the target, the cursor is the discovery,
          and the accent is spent at the moment the control is about to be used —
          which is exactly the budget the grammar sets for it. */}
      <span
        class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-active:bg-accent"
        aria-hidden="true"
      />
    </div>
  )
}
