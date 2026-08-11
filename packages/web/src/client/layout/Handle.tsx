/**
 * The drag handle between a panel and the page.
 *
 * A 4px hit strip, wider than it looks so a pointer can find it, with a rule
 * that lights on hover. Keyboard users resize through the palette / defaults;
 * this control is pointer-only by design (a second number field would be a
 * second way to set one width).
 */

import { TESTID, type TestId } from "../testids.ts"
import {
  CHAT_MAX_PX,
  CHAT_MIN_PX,
  setChatWidth,
  setSidebarWidth,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
  chatWidth,
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
      onWidth={setSidebarWidth}
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
      onWidth={setChatWidth}
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
  readonly onWidth: (px: number) => void
}) {
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
        startResize({
          event,
          edge: props.edge,
          startWidth: props.width(),
          min: props.min,
          max: props.max,
          onMove: props.onWidth,
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
