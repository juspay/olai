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
 * HOW FULL THE INBOX IS is the rest, and it is the law in one sentence: the
 * badge counts the rows in the inbox marked `todo` or `doing — any depth,
 * full stop. There is no walk and no branch arithmetic left to pin: a record
 * answers for itself. What the cases below hold is the truth table of the
 * marks (todo counts, doing counts, done and cancelled do not, an unmarked
 * row — loose line or header — never did), the one clause that is still a
 * clause (a placement is not a node), and the two halves of the convention
 * meeting (a capture lands already counted, because its row was born `todo`).
 * Which FILE the count is asked of is found by name over the SET's paths —
 * the same list capture walks — so an empty or torn shallowest file is the
 * file the door names, not a deeper one that still holds records.
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
  expect(heldOf({ "house.org": `{"id":"k","ord":"a0","title":"kitchen"}` }))
    .toEqual(NO_INBOX)
})

test("the marked rows of whichever file the inbox is are the count", () => {
  expect(heldOf({
    "Inbox.org": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain","todo":true}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil","doing":true}`,
    ].join("\n"),
  })).toEqual({ count: 2 })

  expect(heldOf({
    "_olai/Inbox.org": `{"id":"a","ord":"a0","title":"buy the walnut stain","todo":true}`,
    "house.org": `{"id":"k","ord":"a0","title":"kitchen"}`,
  })).toEqual({ count: 1 })
})

test("todo counts at any depth, and every marked row counts for itself", () => {
  // Two levels down under furniture: the mark, nothing above it, is the one.
  expect(heldOf({
    "Inbox.org": [
      `{"id":"h","ord":"a0","title":"Deferrals"}`,
      `{"id":"g","parent":"h","ord":"a0","title":"a group"}`,
      `{"id":"t","parent":"g","ord":"a0","title":"still to do","todo":true}`,
      `{"id":"d","parent":"h","ord":"a1","title":"already done","done":true}`,
    ].join("\n"),
  })).toEqual({ count: 1 })

  // No walk, no dedup: two marks in one branch are two rows awaiting you.
  expect(heldOf({
    "Inbox.org": [
      `{"id":"t","ord":"a0","title":"the remodel","todo":true}`,
      `{"id":"a","parent":"t","ord":"a0","title":"demo first","doing":true}`,
    ].join("\n"),
  })).toEqual({ count: 2 })
})

test("done and cancelled settle a row — neither counts", () => {
  expect(heldOf({
    "Inbox.org": [
      `{"id":"a","ord":"a0","title":"buy the walnut stain","done":true}`,
      `{"id":"b","ord":"a1","title":"and a tin of oil","done":"2026-08-22T12:01:00-04:00"}`,
      `{"id":"c","ord":"a2","title":"wipe the bench","cancelled":true}`,
      `{"id":"d","ord":"a3","title":"the leftover stain","todo":true}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

// THE INCIDENT THIS LAW CLOSES. An emptied section header — "Awaiting the
// human's word", a childless bare bullet — wore a badge of 1 over a page
// showing nothing open, and the old top-level walk could only excuse it with
// a special clause. Under the one sentence it wears 0 with none: an unmarked
// row is furniture, bare bullet or branch-full header alike.
test("a bare bullet is furniture — a childless one wears 0, and so does a whole branch of them", () => {
  expect(heldOf({
    "Inbox.org": `{"id":"h","ord":"a0","title":"Awaiting the human's word"}`,
  })).toEqual(NO_INBOX)

  expect(heldOf({
    "Inbox.org": [
      `{"id":"h","ord":"a0","title":"Deferrals"}`,
      `{"id":"a","parent":"h","ord":"a0","title":"one","done":true}`,
      `{"id":"b","parent":"h","ord":"a1","title":"an unprocessed line"}`,
    ].join("\n"),
  })).toEqual(NO_INBOX)
})

test("a placement never counts — not even a mirror of a todo, at any depth", () => {
  // A placement is not a node: the marked row lives in `garden.org`, and the
  // mirror standing in the inbox is a view of it, so the count excludes it
  // without a clause of its own.
  expect(heldOf({
    "Inbox.org": `{"id":"m","ord":"a0","mirror":"herbs"}`,
    "garden.org": `{"id":"herbs","ord":"a0","title":"the herb bed","todo":true}`,
  })).toEqual(NO_INBOX)

  // …and placed under a real row: the clause is depth-blind the way the
  // count is, so this pins it at depth too.
  expect(heldOf({
    "Inbox.org": [
      `{"id":"h","ord":"a0","title":"Awaiting the human's word"}`,
      `{"id":"m","parent":"h","ord":"a0","mirror":"herbs"}`,
    ].join("\n"),
    "garden.org": `{"id":"herbs","ord":"a0","title":"the herb bed","todo":true}`,
  })).toEqual(NO_INBOX)
})

test("the shallowest Inbox.org wins, the way capture does", () => {
  expect(heldOf({
    "Inbox.org": `{"id":"root","ord":"a0","title":"at the root","todo":true}`,
    "_olai/Inbox.org": [
      `{"id":"m1","ord":"a0","title":"olai made this","todo":true}`,
      `{"id":"m2","ord":"a1","title":"and another","todo":true}`,
    ].join("\n"),
  })).toEqual({ count: 1 })
})

test("an empty shallowest inbox is the file the door names — not a deeper one that holds marked rows", () => {
  // THE DIVERGENCE: capture twice into `_olai/Inbox.org`, then create
  // `Inbox.org` from the sidebar. Door and capture walk outlinePaths and
  // land on the empty root file; byFile.keys() would still name the deeper
  // one and the badge would read 2 on a door that opens nothing.
  expect(heldOf({
    "Inbox.org": "",
    "_olai/Inbox.org": [
      `{"id":"a","ord":"a0","title":"olai made this","todo":true}`,
      `{"id":"b","ord":"a1","title":"and another","todo":true}`,
    ].join("\n"),
  })).toEqual(NO_INBOX)
})

test("a torn shallowest inbox is the file the door names — its count is zero, not a deeper file's", () => {
  expect(heldOf(
    { "_olai/Inbox.org": `{"id":"minted","ord":"a0","title":"olai made this","todo":true}` },
    { "Inbox.org": `{"id":"i0","ord":"a0",title:"broken"}` },
  )).toEqual(NO_INBOX)
})

test("two answers that say the same number are the same reading", () => {
  const a = heldOf({ "Inbox.org": `{"id":"a","ord":"a0","title":"one","todo":true}` })
  const b = heldOf({ "Inbox.org": `{"id":"a","ord":"a0","title":"one","todo":true}` })
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

test("every field reaches the `add` — with the minted todo — when the directory already has an inbox", () => {
  expect(captureInto(outlinePaths(setOf({ "house.org": HOUSE, [INBOX]: "" })), WHOLE))
    .toEqual({ op: "add", file: INBOX, ...WHOLE, mark: "todo" })
})

test("…and the identical fields reach the seed of the inbox it mints", () => {
  // The same value, so the two arms cannot drift: a `create`'s seed IS an
  // `add`'s capture (./writing.ts), which is what makes one resolution serve
  // both doors.
  expect(captureInto(outlinePaths(setOf({ "house.org": HOUSE })), WHOLE))
    .toEqual({ op: "create", file: mintedInto(INBOX), seed: { ...WHOLE, mark: "todo" } })
})

test("a capture lands already counted — the row it mints is the row the badge reads", () => {
  // The two halves of this convention meeting is the point of the law, so it
  // is ONE case rather than two: the mark above is what the file holds after
  // the write planner stores it (`todo` stores `true`, the way `set_todo`
  // writes it), and a file holding that record counts it.
  //
  // The literal is hand-written and the case says so, because the join — a
  // `captureInto` request THROUGH the planner, stored, and counted by this
  // same function — is held end to end one package over, where the planner
  // lives: `@olai/server`'s `mcp/tools.test.ts` ("a capture lands in a minted
  // inbox, dated and attributed") runs the real tool door and then asserts
  // `inboxHeldOf` over the set it left. A drift between the plan's spelling
  // of a born mark and this literal would fail THERE, loudly.
  const landed = `{"id":"c1","ord":"a0","title":"the thread about cabinets","todo":true,"date":"2026-08-21T09:15:00-04:00"}`
  expect(heldOf({ "_olai/Inbox.org": landed })).toEqual({ count: 1 })
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
