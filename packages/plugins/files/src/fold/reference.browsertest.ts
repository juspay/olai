import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createReferenceFold } from "./reference.ts"

test("a reference section's local collapse expires after leaving and returning", () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => null, setItem: () => {}, removeItem: () => {},
  } })
  const owner = createRoot(dispose => {
    const [file, setFile] = createSignal<string | undefined>("reference.md")
    return { dispose, setFile, fold: createReferenceFold(file, name => name === "reference.md") }
  })
  try {
    expect(owner.fold.open()).toBe(true)
    owner.fold.toggle()
    expect(owner.fold.open()).toBe(false)
    owner.setFile("work.olai")
    expect(owner.fold.open()).toBe(false)
    owner.setFile("reference.md")
    expect(owner.fold.open()).toBe(true)
    owner.fold.toggle()
    expect(owner.fold.open()).toBe(false)
  } finally {
    owner.dispose()
    if (saved) Object.defineProperty(globalThis, "localStorage", saved)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
})
