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
  root: ElementDouble; meta: ElementDouble; darkMeta: ElementDouble; icon: ElementDouble; apple: ElementDouble; canvas: ElementDouble
  stored: Map<string, string>; listeners: Set<(event: StorageEvent) => void>
  created: string[]; revoked: string[]
}) => Promise<void>) => {
  const root = new ElementDouble({ "data-theme": "inherited" })
  // TWO of them, the way the shell ships them: one per OS scheme, each with
  // its own `media`. A chrome that repainted only the first would leave the
  // other to be the one the browser actually uses.
  const meta = new ElementDouble({ media: "(prefers-color-scheme: light)", content: "original-color" })
  const darkMeta = new ElementDouble({ media: "(prefers-color-scheme: dark)", content: "original-dark-color" })
  const icon = new ElementDouble({ href: "/original.svg" })
  const apple = new ElementDouble({ content: "Inherited app" })
  // What the shell authored, or what its boot script left there: either way
  // this activation INHERITS it and owes it back on withdrawal.
  const canvas = new ElementDouble({ content: "light dark" })
  const stored = new Map<string, string>([["olai.theme", "basalt"], ["olai.font", "system"], ["olai.size", "larger"]])
  const listeners = new Set<(event: StorageEvent) => void>()
  const globals = {
    document: {
      title: "olai",
      documentElement: root,
      querySelector: (selector: string) => selector.includes("apple-mobile") ? apple : selector.includes("color-scheme") ? canvas : selector.startsWith("meta") ? meta : icon,
      querySelectorAll: (_: string) => [meta, darkMeta],
    },
    window: { addEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.add(listener), removeEventListener: (_: string, listener: (event: StorageEvent) => void) => listeners.delete(listener) },
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) },
  }
  const before = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const created: string[] = []; const revoked: string[] = []
  const create = spyOn(URL, "createObjectURL").mockImplementation(() => { const url = `blob:choice-${created.length}`; created.push(url); return url })
  const revoke = spyOn(URL, "revokeObjectURL").mockImplementation((url) => { revoked.push(url) })
  try { await body({ root, meta, darkMeta, icon, apple, canvas, stored, listeners, created, revoked }) } finally {
    create.mockRestore(); revoke.mockRestore()
    for (const [key, descriptor] of before) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
}
export const close = (scope: Scope.Closeable) => Effect.runPromise(Scope.close(scope, Exit.void))

