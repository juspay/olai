import { expect, test } from "bun:test"

import { notifyClick } from "./notify.ts"

test("a click envelope of ours is read", () => {
  expect(notifyClick({ kind: "ask" })).toEqual({ kind: "ask" })
})

test("anything that is not one of ours is dropped", () => {
  // What a stale worker or a pre-upgrade notification substitutes, and what the
  // framework's seam hands over unvalidated. It warns and drops rather than
  // routing it (`@kolu/surface-app/notify`), which is why this gate exists at
  // all — a press that arrived as `{}` would otherwise open the panel for a
  // reason nobody can name.
  expect(notifyClick({})).toBeUndefined()
  expect(notifyClick(null)).toBeUndefined()
  expect(notifyClick("ask:3")).toBeUndefined()
  expect(notifyClick({ kind: "terminal" })).toBeUndefined()
})
