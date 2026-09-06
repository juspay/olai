import { spyOn } from "bun:test"
import { Effect, Exit, Scope } from "effect"

export class ElementDouble {
  readonly attributes = new Map<string, string>()
  constructor(values: Record<string, string>) { for (const [key, value] of Object.entries(values)) this.attributes.set(key, value) }
  getAttribute(key: string) { return this.attributes.get(key) ?? null }
  setAttribute(key: string, value: string) { this.attributes.set(key, value) }
  removeAttribute(key: string) { this.attributes.delete(key) }
  set href(value: string) { this.setAttribute("href", value) }
}

export const browser = async (body: (state: {
  root: ElementDouble; meta: ElementDouble; icon: ElementDouble; apple: ElementDouble
  stored: Map<string, string>; listeners: Set<(event: StorageEvent) => void>
  created: string[]; revoked: string[]
}) => Promise<void>) => {
  const root = new ElementDouble({ "data-theme": "inherited" })
  const meta = new ElementDouble({ content: "original-color" })
  const icon = new ElementDouble({ href: "/original.svg" })
  const apple = new ElementDouble({ content: "Inherited app" })
  const stored = new Map<string, string>([["olai.theme", "pitch"], ["olai.font", "system"], ["olai.size", "larger"]])
  const listeners = new Set<(event: StorageEvent) => void>()
  const globals = {
    document: { title: "olai", documentElement: root, querySelector: (selector: string) => selector.includes("apple-mobile") ? apple : selector.startsWith("meta") ? meta : icon },
    window: { addEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.delete(listener) },
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) },
  }
  const before = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const created: string[] = []; const revoked: string[] = []
  const create = spyOn(URL, "createObjectURL").mockImplementation(() => { const url = `blob:choice-${created.length}`; created.push(url); return url })
  const revoke = spyOn(URL, "revokeObjectURL").mockImplementation((url) => { revoked.push(url) })
  try { await body({ root, meta, icon, apple, stored, listeners, created, revoked }) } finally {
    create.mockRestore(); revoke.mockRestore()
    for (const [key, descriptor] of before) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
}
export const close = (scope: Scope.Closeable) => Effect.runPromise(Scope.close(scope, Exit.void))

