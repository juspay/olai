/**
 * HOW FULL THE INBOX IS.
 *
 * What is pinned here is the number the door wears: top-level regular nodes
 * of whichever outline is the inbox, found by name. Nested children and
 * placements do not count. The sidebar draws this number; a second walk of
 * the open page would be free to disagree with it.
 */

import { expect, test } from "bun:test"

import { derive } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { inboxHeldOf, NO_INBOX, sameInboxHeld } from "./inbox.ts"

const setWith = (files: Record<string, string>) =>
  derive(recordsOf(setOf(files)))

test("a directory with no inbox holds none", () => {
  expect(inboxHeldOf(setWith({ "house.olai": `{"id":"k","ord":"a0","title":"kitchen"}` })))
    .toEqual(NO_INBOX)
})

test("top-level regular nodes are the count, in whichever file the inbox is", () => {
  const rooted = setWith({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil"}`,
    ].join("\n"),
  })
  expect(inboxHeldOf(rooted)).toEqual({ count: 2 })

  const minted = setWith({
    "_olai/Inbox.olai": `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
    "house.olai": `{"id":"k","ord":"a0","title":"kitchen"}`,
  })
  expect(inboxHeldOf(minted)).toEqual({ count: 1 })
})

test("a nested child does not inflate it — a capture with a note under it is still one", () => {
  const held = inboxHeldOf(setWith({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
      `{"id":"note","parent":"a","ord":"a0","title":"the 250ml tin"}`,
    ].join("\n"),
  }))
  expect(held).toEqual({ count: 1 })
})

test("a mirror is not a capture — a placement does not count", () => {
  const held = inboxHeldOf(setWith({
    "Inbox.olai": `{"id":"m","ord":"a0","mirror":"herbs"}`,
    "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  }))
  expect(held).toEqual(NO_INBOX)
})

test("the shallowest Inbox.olai wins, the way capture does", () => {
  const held = inboxHeldOf(setWith({
    "Inbox.olai": `{"id":"root","ord":"a0","title":"at the root"}`,
    "_olai/Inbox.olai": `{"id":"minted","ord":"a0","title":"olai made this"}`,
  }))
  expect(held).toEqual({ count: 1 })
})

test("two answers that say the same number are the same reading", () => {
  const a = inboxHeldOf(setWith({
    "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}`,
  }))
  const b = inboxHeldOf(setWith({
    "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}`,
  }))
  expect(sameInboxHeld(a, b)).toBe(true)
  expect(sameInboxHeld(a, { count: 2 })).toBe(false)
})
