import { onCleanup } from "solid-js"

/**
 * 500ms matches both mobile platforms' own long press: Android fires
 * `contextmenu` at that deadline, and a menu opening later than the callout it
 * suppresses would show a text selection first.
 */
export const LONG_PRESS_MS = 500

const SLOP_PX = 10

export interface LongPress {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onContextMenu: (event: Event) => void
}

type Finger =
  | { readonly kind: "gone" }
  | {
    readonly kind: "holding"
    readonly from: PointerEvent
    readonly until: ReturnType<typeof setTimeout>
  }
  | { readonly kind: "adrift" }
  | { readonly kind: "held" }

export const longPressOn = (
  press: (from: PointerEvent) => void,
  swallowGhost: () => void = () => {},
): LongPress => {
  let finger: Finger = { kind: "gone" }

  const move = (event: PointerEvent): void => {
    if (finger.kind !== "holding") return
    const drift = Math.hypot(
      event.clientX - finger.from.clientX,
      event.clientY - finger.from.clientY,
    )
    if (drift > SLOP_PX) finger = stop({ kind: "adrift" })
  }

  const stop = (next: Finger): Finger => {
    if (finger.kind === "holding") clearTimeout(finger.until)
    return next
  }

  const release = (): void => {
    finger = stop({ kind: "gone" })
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", lifted)
    window.removeEventListener("pointercancel", release)
  }

  const lifted = (): void => {
    const opened = finger.kind === "held"
    release()
    if (opened) swallowGhost()
  }

  const fire = (): void => {
    if (finger.kind !== "holding") return
    const from = finger.from
    finger = stop({ kind: "held" })
    press(from)
  }

  onCleanup(release)

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== "touch") return release()
      if (finger.kind !== "gone") {
        finger = stop({ kind: "adrift" })
        return
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", lifted)
      window.addEventListener("pointercancel", release)
      finger = {
        kind: "holding",
        from: event,
        until: setTimeout(fire, LONG_PRESS_MS),
      }
    },
    onContextMenu: (event: Event) => {
      if (finger.kind === "gone") return
      // Prevented, so the text-selection callout Android raises with it goes too.
      event.preventDefault()
      if (finger.kind === "holding") fire()
    },
  }
}
