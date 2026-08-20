/**
 * Which tab of this browser records — the Web Locks election, and the answer
 * for a browser that has not got them.
 */

import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { AUTOCOMMIT_LOCK, createElected } from "./elected.ts"

const held = <A>(body: () => A): A => createRoot((stop) => {
  const value = body()
  stop()
  return value
})

/** A `navigator` with the API, or without it, for as long as `body` runs. */
const withNavigator = <A>(value: unknown, body: () => A): A => {
  const g = globalThis as Record<string, unknown>
  const had = "navigator" in g
  const before = g.navigator
  Object.defineProperty(g, "navigator", { value, configurable: true, writable: true })
  try {
    return body()
  } finally {
    if (had) Object.defineProperty(g, "navigator", { value: before, configurable: true, writable: true })
    else delete g.navigator
  }
}

test("the lock is namespaced to this browser's git preferences", () => {
  expect(AUTOCOMMIT_LOCK).toBe("olai.git.autocommit")
})

// No Web Locks — an insecure origin, an old browser. One tab's word is as good
// as another's, which is what the app did before there was an election at all.
test("a browser with no Web Locks lets every tab record", () => {
  expect(withNavigator({}, () => held(() => createElected()()))).toBe(true)
  expect(withNavigator(undefined, () => held(() => createElected()()))).toBe(true)
})

test("a tab claims nothing until the lock is actually held", async () => {
  let grant = (): void => {}
  const locks = {
    request: (_name: string, body: () => Promise<void>) =>
      new Promise<void>(() => {
        grant = () => void body()
      }),
  }
  const elected = withNavigator({ locks }, () => {
    let value = (): boolean => false
    createRoot(() => {
      value = createElected()
    })
    return value
  })
  expect(elected()).toBe(false)
  grant()
  await Promise.resolve()
  expect(elected()).toBe(true)
})
