/**
 * THE INBOX CONVENTION, both readings of it.
 *
 * WHAT A CAPTURE BECOMES ({@link captureInto}) is at the foot of the file, and
 * what is pinned there is the half only the HTTP door exercises: a capture is a
 * whole {@link Capturing} rather than a line, and everything on it has to reach
 * the file through BOTH arms. A field that survived one arm and not the other
 * would be a capture whose note vanished depending on whether the directory had
 * ever captured before, which is the least findable bug this convention could
 * have. Which FILE each arm picks is `@olai/server`'s `edit.test.ts` (the
 * palette section), where it has been held since the door that has been sending
 * captures the longest was written.
 *
 * HOW FULL THE INBOX IS is the rest: top-level regular nodes of whichever
 * outline is the inbox that still await processing, found by name over the
 * SET's paths — the same list capture walks — so an empty or torn shallowest
 * file is the file the door names, not a deeper one that still holds records.
 * Nested children and placements do not count, a done row does not, and a
 * bare-bullet header whose every descendant is finished does not: the badge
 * is what is left to process, not every capture the file has ever held.
 */

import { expect, test } from "bun:test"

import { readingOf, setOf } from "./fixtures.testlib.ts"
import {
  CAPTURED_BY,
  capturingOf,
  type Capturing,
  captureInto,
  inboxHeldOf,
  CaptureRequest,
  NO_INBOX,
  noteOf,
  sameInboxHeld,
} from "./inbox.ts"
import { INBOX, mintedInto } from "./node.ts"
import { outlinePaths } from "./set.ts"

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

test("a done row does not count — the badge is what still awaits processing", () => {
  // A bullet, a todo, a doing: still in the inbox. A done row has been
  // processed, so it does not inflate the door.
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil","todo":true}`,
      `{"id":"c","ord":"a2","title":"wipe the bench","doing":true}`,
      `{"id":"d","ord":"a3","title":"the leftover stain","done":"2026-08-22T12:00:00-04:00"}`,
    ].join("\n"),
  })).toEqual({ count: 3 })

  // All processed: the door wears nothing, the way an empty inbox does.
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain","done":true}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil","done":"2026-08-22T12:01:00-04:00"}`,
      `{"id":"c","ord":"a2","title":"wipe the bench","done":true}`,
    ].join("\n"),
  })).toEqual(NO_INBOX)
})

test("a finished branch does not count — a bare-bullet header whose every task is done is not awaiting", () => {
  // The Inbox's Deferrals root: unmarked, 10/10 done underneath. #348 counted
  // it because a bullet counts; a finished branch is not awaiting processing.
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"h","ord":"a0","title":"Deferrals"}`,
      `{"id":"a","parent":"h","ord":"a0","title":"one","done":true}`,
      `{"id":"b","parent":"h","ord":"a1","title":"two","done":"2026-08-22T16:00:00-04:00"}`,
    ].join("\n"),
  })).toEqual(NO_INBOX)
})

test("a header holding one todo still counts, even two levels down", () => {
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"h","ord":"a0","title":"Deferrals"}`,
      `{"id":"g","parent":"h","ord":"a0","title":"a group"}`,
      `{"id":"t","parent":"g","ord":"a0","title":"still to do","todo":true}`,
      `{"id":"d","parent":"h","ord":"a1","title":"already done","done":true}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

test("a header holding a bullet leaf still counts — that line is unprocessed", () => {
  expect(heldOf({
    "Inbox.olai": [
      `{"id":"h","ord":"a0","title":"Deferrals"}`,
      `{"id":"d","parent":"h","ord":"a0","title":"already done","done":true}`,
      `{"id":"b","parent":"h","ord":"a1","title":"an unprocessed line"}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

test("a leaf bullet root still counts, and a todo root still counts even when every child is done", () => {
  expect(heldOf({
    "Inbox.olai": `{"id":"a","ord":"a0","title":"buy the walnut stain"}`,
  })).toEqual({ count: 1 })

  expect(heldOf({
    "Inbox.olai": [
      `{"id":"t","ord":"a0","title":"the remodel","todo":true}`,
      `{"id":"a","parent":"t","ord":"a0","title":"demo","done":true}`,
      `{"id":"b","parent":"t","ord":"a1","title":"paint","done":true}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

test("two answers that say the same number are the same reading", () => {
  const a = heldOf({ "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}` })
  const b = heldOf({ "Inbox.olai": `{"id":"a","ord":"a0","title":"one"}` })
  expect(sameInboxHeld(a, b)).toBe(true)
  expect(sameInboxHeld(a, { count: 2 })).toBe(false)
})

// ── what a capture becomes ─────────────────────────────────────────────

const HOUSE = `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`

/** Everything a capture may carry, so neither assertion below is vacuous. */
const WHOLE: Capturing = {
  title: "the thread about cabinets",
  desc: "worth a reply\n\n<message://%3Cabc@mail%3E>",
  date: "2026-08-21T09:15:00-04:00",
  props: { from: "joinery@example.com", "message-id": "<abc@mail>" },
}

test("every field reaches the `add`, when the directory already has an inbox", () => {
  expect(captureInto(outlinePaths(setOf({ "house.olai": HOUSE, [INBOX]: "" })), WHOLE))
    .toEqual({ op: "add", file: INBOX, ...WHOLE })
})

test("…and the identical fields reach the seed of the inbox it mints", () => {
  // The same value, so the two arms cannot drift: a `create`'s seed IS an
  // `add`'s capture (./writing.ts), which is what makes one resolution serve
  // both doors.
  expect(captureInto(outlinePaths(setOf({ "house.olai": HOUSE })), WHOLE))
    .toEqual({ op: "create", file: mintedInto(INBOX), seed: WHOLE })
})

// ── WHAT A CAPTURE IS on the way in ────────────────────────────────────
//
// These came down from `@olai/server`'s `capture.test.ts` when `POST /capture`
// was retired and the verb became a tool. They used to be driven through a
// real HTTP door because that was the only way to reach the composition; the
// composition is a function here, so they are the same assertions asked
// directly. What did NOT come with them is everything that was about the WIRE
// — the status table, the CSRF gate, the method arm — because there is no wire
// any more.

const POSTED = { title: "the thread about cabinets" } as const

test("the note is the text, and nothing when there is none", () => {
  // A capture is a title and a note now (ruled, human 2026-08-23). It used to
  // take a `url` as well, kept under the note as a markdown autolink, and a
  // `props` map of the named facts a client already knew — both gone, along with
  // the encoding rule the autolink needed and the guard the props map made
  // necessary. What is left has one shape and no cases.
  expect([
    noteOf({ title: "a thought", text: "just this" }),
    noteOf({ title: "buy milk" }),
    // An empty note is no note, so the row has no `desc` rather than a blank one.
    noteOf({ title: "buy milk", text: "" }),
  ]).toEqual(["just this", undefined, undefined])
})

test("the identity the door has is written on, and the capture is dated", () => {
  expect(
    capturingOf(POSTED, "someone@example.com", "2026-08-23T09:41:00+05:30"),
  ).toEqual({
    title: "the thread about cabinets",
    date: "2026-08-23T09:41:00+05:30",
    // The one property a capture carries, and the door is the only thing that
    // can supply it.
    props: { [CAPTURED_BY]: "someone@example.com" },
  })
})

test("a door that knows nobody writes no attribution, rather than a false one", () => {
  // The ruling read literally: the property is OMITTED when the door has no
  // identity, so `captured-by` means one thing wherever it appears — somebody
  // the door actually knew. A capture with none is honest; a capture
  // attributed to a process is not. And the key is absent rather than empty:
  // `prop:captured-by` must not match a capture nobody was named on.
  const made = capturingOf(POSTED, null, "2026-08-23T09:41:00+05:30")
  expect(made).toEqual({
    title: "the thread about cabinets",
    date: "2026-08-23T09:41:00+05:30",
  })
  expect(Object.hasOwn(made, "props")).toBe(false)
})

test("a client CANNOT say who captured this — there is nowhere to say it", () => {
  // This used to be a guard: a check that the props map did not carry
  // `captured-by`, sitting one line from the merge that would have overruled it,
  // and a second case for a key that was only the same key after the write
  // planner trimmed it. Both are gone with the map itself, which is the
  // stronger arrangement — a rule that cannot be broken rather than one
  // enforced. Asserted on the SCHEMA, because that is where the fact now lives.
  const fields = Object.keys(CaptureRequest.fields)
  expect(fields).toEqual(["title", "text"])
  expect(fields).not.toContain("props")
})
