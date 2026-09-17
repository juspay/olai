import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createLandings } from "@olai/plugin-api/carry"
import { createDragging } from "./dragging.ts"
import { holdLandings } from "../landings.ts"
import { createAir, holdAir } from "./air.ts"
import { holdFields } from "./fields.ts"
import { createUndo, holdUndo } from "../edit/undoing.ts"
import type { Row } from "@olai/format"

test("createDragging aims at a receiver before the page gap at the same point", () => {
  // A deterministic layout drives the real pointer listeners and drag controller.
  const globals = ["window", "document", "cancelAnimationFrame"] as const
  const saved = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const win = Object.assign(new EventTarget(), { scrollX: 0, scrollY: 0 })
  const doc = Object.assign(new EventTarget(), { body: { style: { userSelect: "" } }, documentElement: { clientHeight: 800 } })
  Object.assign(globalThis, { window: win, document: doc, cancelAnimationFrame: () => {} })
  const pointer = (type: string, x: number, y: number) => Object.assign(new Event(type), { pageX: x, pageY: y, clientX: x, clientY: y, button: 0, pointerType: "mouse" }) as PointerEvent
  const rect = { top: 100, bottom: 140, left: 20, right: 400, width: 380, height: 40 }
  const element = { closest: () => element, getBoundingClientRect: () => rect, querySelectorAll: () => [{ getAttribute: () => "/target", getBoundingClientRect: () => rect }] } as unknown as Element
  const row = (id: string): Row => ({ kind: "node", key: `/${id}`, at: { file: "house.olai", line: 1, node: { id, ord: "a0", title: id } }, shows: { file: "house.olai", line: 1, node: { id, ord: "a0", title: id } }, children: [], blocked: [], under: 0 })
  const table = createLandings()
  let aims = 0, leaves = 0
  const releases = [holdLandings(table), holdAir(createAir()), holdFields({ join: () => {}, all: () => [{ file: "house.olai", within: [], rows: () => [row("target")], collapsed: () => new Set(), element: () => element }] }), holdUndo(createUndo(async () => { throw new Error("cancelled carries must not write") }))]
  table.register({ lift: () => ({ left: 100, right: 200, top: 100, bottom: 140 }), aim: () => { aims++ }, leave: () => { leaves++ }, drop: async () => null })
  try {
    createRoot(dispose => {
      try {
        const drag = createDragging({ selection: { keys: () => new Set(), rows: () => [], clear: () => {}, say: () => {} } })
        drag.grab(pointer("pointerdown", 25, 110), row("source"))
        win.dispatchEvent(pointer("pointermove", 150, 120))
        expect(aims).toBe(1)
        expect(drag.aim()).toBeNull()
        win.dispatchEvent(pointer("pointermove", 50, 120))
        expect(leaves).toBe(1)
        expect(drag.aim()?.kind).toBe("drop")
        win.dispatchEvent(pointer("pointermove", 150, 120))
        expect(drag.aim()).toBeNull()
      } finally { dispose() }
    })
  } finally {
    releases.reverse().forEach(release => release())
    globals.forEach((key, index) => { const descriptor = saved[index]; if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) })
  }
})
