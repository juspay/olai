import { createEscapeKeyDown, createInteractOutside } from "@kobalte/core"
import { onCleanup, type Accessor } from "solid-js"

import { topmostWhileOpen } from "./topmost.ts"

export interface Dismissable {
  readonly open: Accessor<boolean>
  readonly root: Accessor<HTMLElement | undefined>
  readonly trigger?: Accessor<HTMLElement | undefined>
  readonly dismiss: () => void
}

export const dismissOn = (on: Dismissable): void => {
  const shut = () => !on.open()
  const topmost = topmostWhileOpen(on.open)

  createInteractOutside(
    {
      isDisabled: shut,
      shouldExcludeElement: (element) =>
        on.trigger?.()?.contains(element) === true,
      onPointerDownOutside: () => {
        if (topmost()) on.dismiss()
      },
    },
    on.root,
  )

  createEscapeKeyDown({
    isDisabled: shut,
    onEscapeKeyDown: (event) => {
      if (!topmost()) return
      event.preventDefault()
      on.dismiss()
      on.trigger?.()?.focus()
    },
  })
}

export const lightDismiss = (dialog: HTMLDialogElement): void => {
  dialog.setAttribute("closedby", "any")
  if ("closedBy" in HTMLDialogElement.prototype) return

  const outside = (event: PointerEvent): boolean => {
    const box = dialog.getBoundingClientRect()
    return event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom
  }
  let pressedOutside = false
  const down = (event: PointerEvent) => { pressedOutside = outside(event) }
  const up = (event: PointerEvent) => {
    if (!pressedOutside || !outside(event)) return
    pressedOutside = false
    const request = new Event("cancel", { cancelable: true })
    if (dialog.dispatchEvent(request)) dialog.close()
  }
  dialog.addEventListener("pointerdown", down)
  dialog.addEventListener("pointerup", up)
  onCleanup(() => {
    dialog.removeEventListener("pointerdown", down)
    dialog.removeEventListener("pointerup", up)
  })
}

export const claimCloseRequest = (dialog: HTMLDialogElement): void => {
  const claim = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.stopPropagation()
  }
  dialog.addEventListener("keydown", claim)
  onCleanup(() => dialog.removeEventListener("keydown", claim))
}
