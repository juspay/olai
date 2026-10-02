import { expect, test } from "bun:test"
import type { PageInfo } from "./index.ts"
import { guardPageInput } from "./page-input.ts"

test("the input guard follows the focused report, respects modals, and leaves with its owner", () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const priorElement = Object.getOwnPropertyDescriptor(globalThis, "Element")
  const target = new EventTarget()
  class ModalControl {
    closest(selector: string) {
      expect(selector).toBe("dialog:modal")
      return this
    }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: target })
  Object.defineProperty(globalThis, "Element", { configurable: true, value: ModalControl })
  let focused: PageInfo | undefined
  const stop = guardPageInput(() => focused)
  let handled = 0
  const handle = () => { handled += 1 }
  target.addEventListener("keydown", handle)
  target.addEventListener("click", handle)
  const press = (type = "keydown", modal = false) => {
    const event = new Event(type, { cancelable: true })
    if (modal) Object.defineProperty(event, "target", { value: new ModalControl() })
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  try {
    expect(press()).toBe(false) // no layout yet
    focused = { pending: true }
    expect(press()).toBe(true)
    expect(press("click")).toBe(true) // palette already open
    expect(handled).toBe(1)
    expect(press("click", true)).toBe(false) // offline recovery owns its input
    expect(handled).toBe(2)
    focused = { pending: false }
    expect(press()).toBe(false) // answer arrived or focus moved
    focused = undefined
    expect(press()).toBe(false) // pane withdrew
    focused = { pending: true }
    stop()
    expect(press()).toBe(false) // navigation withdrew
    expect(handled).toBe(5)
  } finally {
    stop()
    target.removeEventListener("keydown", handle)
    target.removeEventListener("click", handle)
    for (const [key, previous] of [["window", priorWindow], ["Element", priorElement]] as const) {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
