import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createWaitingForms } from "./waiting-forms.ts"

test("question reveal follows document order after a move, and skips detached or answered forms", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Node")
  Object.defineProperty(globalThis, "Node", { configurable: true, value: { DOCUMENT_POSITION_FOLLOWING: 4 } })
  const order: HTMLElement[] = []
  const element = () => ({ isConnected: true, compareDocumentPosition(other: HTMLElement) { return order.indexOf(this as unknown as HTMLElement) < order.indexOf(other) ? 4 : 2 } }) as HTMLElement
  const first = element(), second = element()
  order.push(first, second)
  let waiting = true
  const owner = createRoot(dispose => {
    const forms = createWaitingForms()
    // Register in the opposite order: mounting order must not choose the form.
    forms.register(second, () => true)
    forms.register(first, () => waiting)
    return { forms, dispose }
  })
  try {
    expect(owner.forms.first()).toBe(first)
    order.reverse()
    expect(owner.forms.first()).toBe(second)
    Object.defineProperty(second, "isConnected", { value: false })
    expect(owner.forms.first()).toBe(first)
    waiting = false
    expect(owner.forms.first()).toBeUndefined()
    owner.dispose()
    expect(owner.forms.first()).toBeUndefined()
  } finally {
    owner.dispose()
    if (original) Object.defineProperty(globalThis, "Node", original)
    else Reflect.deleteProperty(globalThis, "Node")
  }
})
