import { expect, test } from "bun:test"

import { type Branch, doneUnder } from "./hidden.ts"

const leaf = (status: Branch["status"]): Branch => ({ status, children: [] })
const under = (status: Branch["status"], ...children: Branch[]): Branch => ({
  status,
  children,
})

test("a leaf is holding nothing back", () => {
  expect(doneUnder(leaf("todo"))).toBe(0)
})

test("done children are counted, and nothing else is", () => {
  expect(
    doneUnder(under(undefined, leaf("done"), leaf("todo"), leaf(undefined), leaf("doing"))),
  ).toBe(1)
})

test("the count reaches every depth", () => {
  expect(
    doneUnder(
      under(
        undefined,
        under("done", leaf("done"), under("todo", leaf("done"))),
        leaf("doing"),
      ),
    ),
  ).toBe(3)
})

test("the row itself is never in its own count — it is the one still on screen", () => {
  expect(doneUnder(under("done", leaf("todo")))).toBe(0)
})
