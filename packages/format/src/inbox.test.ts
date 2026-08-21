/**
 * HOW FULL THE INBOX IS.
 *
 * What is pinned here is the number the door wears: top-level regular nodes
 * of whichever outline is the inbox, found by name over the SET's paths —
 * the same list capture walks — so an empty or torn shallowest file is the
 * file the door names, not a deeper one that still holds records. Nested
 * children and placements do not count.
 */

import { expect, test } from "bun:test"

import { readingOf, setOf } from "./fixtures.testlib.ts"
import { inboxHeldOf, NO_INBOX, sameInboxHeld } from "./inbox.ts"

const heldOf = (
  files: Record<string, string>,
  broken: Record<string, string> = {},
) => {
  const at = readingOf(setOf(files, [], broken))
  return inboxHeldOf(at.set, at.derived)
}

test("a directory with no inbox holds none", () => {
  expect(heldOf({ "house.olai": `{"id":"k","ord":"a0","title":"kitchen"}` }))
    .toEqual(NO_INBOX)
})

test("top-level regular nodes are the count, in whichever file the inbox is", () => {
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil"}`,
    ].join("\n"),
  })).toEqual({ count: 2 })

  expect(heldOf({
    "_olai/Inbox.olai": `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
    "house.olai": `{"id":"k","ord":"a0","title":"kitchen"}`,
  })).toEqual({ count: 1 })
})

test("a nested child does not inflate it — a capture with a note under it is still one", () => {
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
      `{"id":"note","parent":"a","ord":"a0","title":"the 250ml tin"}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

test("a mirror is not a capture — a placement does not count", () => {
  expect(heldOf({
    "Inbox.olai": `{"id":"m","ord":"a0","mirror":"herbs"}`,
    "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  })).toEqual(NO_INBOX)
})

test("the shallowest Inbox.olai wins, the way capture does", () => {
  expect(heldOf({
    "Inbox.olai": `{"id":"root","ord":"a0","title":"at the root"}`,
    "_olai/Inbox.olai": `{"id":"minted","ord":"a0","title":"olai made this"}`,
  })).toEqual({ count: 1 })
})

test("an empty shallowest inbox is the file the door names — not a deeper one that still holds captures", () => {
  // THE DIVERGENCE: capture twice into `_olai/Inbox.olai`, then create
  // `Inbox.olai` from the sidebar. Door and capture walk outlinePaths and
  // land on the empty root file; byFile.keys() would still name the deeper
  // one and the badge would read 2 on a door that opens nothing.
  expect(heldOf({
    "Inbox.olai": "",
    "_olai/Inbox.olai": [
      `{"id":"a","ord":"a0","title":"olai made this"}`,
      `{"id":"b","ord":"a1","title":"and another"}`,
    ].join("\n"),
  })).toEqual(NO_INBOX)
})

test("a torn shallowest inbox is the file the door names — its count is zero, not a deeper file's", () => {
  expect(heldOf(
    { "_olai/Inbox.olai": `{"id":"minted","ord":"a0","title":"olai made this"}` },
    { "Inbox.olai": `{"id":"i0","ord":"a0",title:"broken"}` },
  )).toEqual(NO_INBOX)
})

test("two answers that say the same number are the same reading", () => {
  const a = heldOf({ "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}` })
  const b = heldOf({ "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}` })
  expect(sameInboxHeld(a, b)).toBe(true)
  expect(sameInboxHeld(a, { count: 2 })).toBe(false)
})
