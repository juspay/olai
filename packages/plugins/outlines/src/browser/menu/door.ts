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
  readonly show: () => void
  readonly setOpen: (open: boolean) => void
}

const onTheHandle = (event: PointerEvent): boolean =>
  event.pointerType === "touch" &&
  event.target instanceof Element &&
  event.target.closest(`[${HANDLE}]`) !== null

export const createMenuDoor = (): MenuDoor => {
  const [door, setDoor] = createSignal<Door>("unasked")
  const show = (): void => {
    setDoor("open")
  }
  const press = longPressOn(show, swallowGhost)
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
    show,
    armed: () => door() !== "unasked",
    open: () => door() === "open",
    setOpen: (next) => setDoor(next ? "open" : "shut"),
  }
}
