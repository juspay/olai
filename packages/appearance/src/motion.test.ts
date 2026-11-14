/** The preference is read at the moment it is asked for, and answered in the
 *  platform's own words. The reading that matters is the SECOND one: a reader
 *  who changes the system switch mid-session gets the new answer without
 *  reloading the tab, which a module-scope constant could never do. */
import { afterEach, expect, test } from "bun:test"

import { motionIsReduced, scrollManner } from "./motion.ts"

const previous = Reflect.get(globalThis, "matchMedia") as unknown
const asks: string[] = []
const answering = (reduced: boolean) => {
  Reflect.set(globalThis, "matchMedia", (query: string) => {
    asks.push(query)
    return { matches: reduced }
  })
}

afterEach(() => {
  if (previous === undefined) Reflect.deleteProperty(globalThis, "matchMedia")
  else Reflect.set(globalThis, "matchMedia", previous)
  asks.length = 0
})

test("the reading is the reduce query, and it is asked every time", () => {
  answering(false)
  expect(motionIsReduced()).toBe(false)
  expect(scrollManner()).toBe("smooth")
  expect(asks).toEqual([
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-motion: reduce)",
  ])
})

test("a reader who asks for less motion is answered without a reload", () => {
  answering(false)
  expect(scrollManner()).toBe("smooth")
  answering(true)
  expect(scrollManner()).toBe("auto")
  expect(motionIsReduced()).toBe(true)
})

test("a host with no matchMedia at all is not a reader asking for motion", () => {
  Reflect.deleteProperty(globalThis, "matchMedia")
  expect(motionIsReduced()).toBe(false)
  expect(scrollManner()).toBe("smooth")
})
