import { expect, spyOn, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createAppearance } from "./state.ts"

class ElementDouble {
  readonly attributes = new Map<string, string>()
  constructor(values: Record<string, string>) { for (const [key, value] of Object.entries(values)) this.attributes.set(key, value) }
  getAttribute(key: string) { return this.attributes.get(key) ?? null }
  setAttribute(key: string, value: string) { this.attributes.set(key, value) }
  removeAttribute(key: string) { this.attributes.delete(key) }
  set href(value: string) { this.setAttribute("href", value) }
}

const browser = async (body: (state: {
  root: ElementDouble; meta: ElementDouble; icon: ElementDouble
  stored: Map<string, string>; listeners: Set<(event: StorageEvent) => void>
  created: string[]; revoked: string[]
}) => Promise<void>) => {
  const root = new ElementDouble({ "data-theme": "inherited" })
  const meta = new ElementDouble({ content: "original-color" })
  const icon = new ElementDouble({ href: "/original.svg" })
  const stored = new Map<string, string>([["olai.theme", "pitch"], ["olai.font", "system"], ["olai.size", "larger"]])
  const listeners = new Set<(event: StorageEvent) => void>()
  const globals = {
    document: { documentElement: root, querySelector: (selector: string) => selector.startsWith("meta") ? meta : icon },
    window: { addEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.delete(listener) },
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) },
  }
  const before = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const created: string[] = []; const revoked: string[] = []
  const create = spyOn(URL, "createObjectURL").mockImplementation(() => { const url = `blob:choice-${created.length}`; created.push(url); return url })
  const revoke = spyOn(URL, "revokeObjectURL").mockImplementation((url) => { revoked.push(url) })
  try { await body({ root, meta, icon, stored, listeners, created, revoked }) } finally {
    create.mockRestore(); revoke.mockRestore()
    for (const [key, descriptor] of before) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
}
const close = (scope: Scope.Closeable) => Effect.runPromise(Scope.close(scope, Exit.void))

test("appearance survives without preferences UI, releases observers and metadata, and returns with fresh state", () => browser(async ({ root, meta, icon, stored, listeners, created, revoked }) => {
  const first = Scope.makeUnsafe()
  try {
    const state = await Effect.runPromise(Scope.provide(createAppearance, first))
    expect(state.theme.current().name).toBe("pitch")
    expect(state.font.current().name).toBe("system")
    expect(state.size.current().name).toBe("larger")
    expect(listeners.size).toBe(3)
    for (const listener of listeners) listener({ key: "olai.size", newValue: "medium", storageArea: localStorage } as StorageEvent)
    expect(state.size.current().name).toBe("medium")
    await close(first)
    expect(listeners.size).toBe(0)
    expect(root.getAttribute("data-theme")).toBe("inherited")
    expect(root.getAttribute("data-size")).toBeNull()
    expect(meta.getAttribute("content")).toBe("original-color")
    expect(icon.getAttribute("href")).toBe("/original.svg")
    expect(revoked).toEqual(created)
    expect(() => state.size.pick(state.size.current())).toThrow("no longer active")
    stored.set("olai.theme", "reef")
    stored.set("olai.size", "large")
    const second = Scope.makeUnsafe()
    try {
      const next = await Effect.runPromise(Scope.provide(createAppearance, second))
      expect(next).not.toBe(state)
      expect(next.theme.current().name).toBe("reef")
      expect(next.size.current().name).toBe("large")
      expect(listeners.size).toBe(3)
    } finally { await close(second) }
    expect(revoked).toEqual(created)
  } finally { await close(first) }
}))

test("unknown stored choices are forgotten and a failed initialization releases its chrome claim", () => browser(async ({ root, stored, listeners }) => {
  stored.set("olai.theme", "unknown")
  stored.set("olai.font", "unknown")
  stored.set("olai.size", "unknown")
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const state = yield* createAppearance
    expect(stored.size).toBe(0)
    expect(state.theme.current().name).toBe("reef")
    expect(root.getAttribute("data-theme")).toBeNull()
  })))
  const create = spyOn(URL, "createObjectURL")
  create.mockImplementationOnce(() => { throw new Error("icon failed") })
  const failed = await Effect.runPromise(Effect.exit(Effect.scoped(createAppearance)))
  expect(Exit.isFailure(failed)).toBe(true)
  expect(listeners.size).toBe(0)
  await Effect.runPromise(Effect.scoped(createAppearance))
  expect(listeners.size).toBe(0)
}))
