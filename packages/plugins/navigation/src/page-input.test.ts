import { expect, test } from "bun:test"
import type { PageInfo } from "./index.ts"
import { PAGE_SUBJECT } from "./index.ts"
import { guardPageInput } from "./page-input.ts"

test("only retained-page controls are blocked; navigation, other input and withdrawal remain usable", () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window")
  const priorElement = Object.getOwnPropertyDescriptor(globalThis, "Element")
  const target = new EventTarget()
  class Control {
    constructor(readonly subject: boolean, readonly link = false, readonly pane = 0) {}
    getAttribute() { return String(this.pane) }
    closest(selector: string): Control | null {
      if (selector === `[${PAGE_SUBJECT}]`) return this.subject ? this : null
      if (selector === "a[href]") return this.link ? this : null
      return null
    }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: target })
  Object.defineProperty(globalThis, "Element", { configurable: true, value: Control })
  let focused: PageInfo | undefined
  const stop = guardPageInput({ info: index => index === 0 ? focused : { pending: false } })
  const press = (control: Control, type = "click") => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperty(event, "target", { value: control })
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  try {
    const row = new Control(true)
    expect(press(row)).toBe(false)
    focused = { pending: true }
    expect(press(row)).toBe(true)
    expect(press(row, "beforeinput")).toBe(true)
    expect(press(new Control(true, true))).toBe(false) // a retained link
    expect(press(new Control(false))).toBe(false) // chrome/recovery controls
    expect(press(new Control(false), "beforeinput")).toBe(false) // chat/search
    expect(press(new Control(true, false, 1))).toBe(false) // another, current pane
    focused = undefined
    expect(press(row)).toBe(false)
    focused = { pending: true }
    stop()
    expect(press(row)).toBe(false)
  } finally {
    stop()
    for (const [key, previous] of [["window", prior], ["Element", priorElement]] as const) {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
