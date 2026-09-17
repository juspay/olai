import { expect, test } from "bun:test"
import { createRoot, onCleanup } from "solid-js"
import { createPageOwners } from "./page-owners.ts"

test("head and foot share one owner; another pane has its own; the last face releases", () => {
  let made = 0
  let stopped = 0
  let finish = () => {}
  const acquire = createRoot(dispose => { finish = dispose; return createPageOwners<number>() })
  const make = () => { onCleanup(() => { stopped++ }); return ++made }
  const pane = {}
  let closeHead = () => {}, closeFoot = () => {}, closeOther = () => {}
  const head = createRoot(dispose => { closeHead = dispose; return acquire(pane, "one", make) })
  const foot = createRoot(dispose => { closeFoot = dispose; return acquire(pane, "one", make) })
  const other = createRoot(dispose => { closeOther = dispose; return acquire({}, "one", make) })
  expect(head).toBe(foot)
  expect(other).not.toBe(head)
  expect(made).toBe(2)
  closeHead()
  expect(stopped).toBe(0)
  closeFoot()
  expect(stopped).toBe(1)
  finish()
  expect(stopped).toBe(2)
  closeOther()
  expect(stopped).toBe(2)
})
