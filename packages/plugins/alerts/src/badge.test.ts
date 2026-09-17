import { expect, test } from "bun:test"

import { channelFor, createBadge } from "./badge.ts"

test("an installed app with the API badges its own icon", () => {
  expect(channelFor(true, true)).toBe("app")
})

test("a plain tab marks its title and favicon, API or not", () => {
  // `setAppBadge` exists in a Chromium TAB and is ignored there, so the
  // presence of the API is not the question — where the page is running is.
  expect(channelFor(true, false)).toBe("tab")
  expect(channelFor(false, false)).toBe("tab")
})

test("an install on a browser with no badging API still gets the tab's mark", () => {
  expect(channelFor(false, true)).toBe("tab")
})

test("each attention owner starts fresh and cleanup uses its captured badge sink", () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true, matchMedia: () => ({ matches: false }) } })
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
    const first: boolean[] = [], second: boolean[] = []
    const oldBadge = createBadge(value => first.push(value))
    oldBadge(1)
    oldBadge(1)
    const nextBadge = createBadge(value => second.push(value))
    nextBadge(1)
    // Clearing a departed attention instance must neither look up a removed
    // global settings provider nor clear the replacement instance's badge.
    oldBadge(0)
    expect(first).toEqual([true, false])
    expect(second).toEqual([true])
    nextBadge(0)
    expect(second).toEqual([true, false])
  } finally {
    for (const [key, descriptor] of [["window", savedWindow], ["navigator", savedNavigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
