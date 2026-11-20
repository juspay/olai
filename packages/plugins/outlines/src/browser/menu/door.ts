import { type Accessor, createSignal } from "solid-js"

import { HANDLE } from "../drag/dragging.ts"
import { type LongPress, longPressOn } from "@olai/web/client/longPress.ts"
import { swallowGhost } from "../gestures.ts"

type Door = "unasked" | "shut" | "open"

export interface MenuDoor {
  readonly hold: LongPress
  readonly line: (el: HTMLElement) => void
  readonly at: () => HTMLElement | undefined
  readonly armed: Accessor<boolean>
  readonly open: Accessor<boolean>
  readonly setOpen: (open: boolean) => void
}

const onTheHandle = (event: PointerEvent): boolean =>
  event.pointerType === "touch" &&
  event.target instanceof Element &&
  event.target.closest(`[${HANDLE}]`) !== null

export const createMenuDoor = (): MenuDoor => {
  const [door, setDoor] = createSignal<Door>("unasked")
  const setOpen = (next: boolean): void => { setDoor(next ? "open" : "shut") }
  const press = longPressOn(() => setOpen(true), swallowGhost)
  let line: HTMLElement | undefined

  return {
    hold: {
      onPointerDown: (event) => {
        if (onTheHandle(event) || (event.target instanceof Element && event.target.closest("a[href]"))) return
        press.onPointerDown(event)
      },
      onContextMenu: event => { if (!(event.target instanceof Element && event.target.closest("a[href]"))) press.onContextMenu(event) },
    },
    line: (el) => {
      line = el
    },
    at: () => line,
    armed: () => door() !== "unasked",
    open: () => door() === "open",
    setOpen,
  }
}
