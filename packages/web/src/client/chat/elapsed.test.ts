/**
 * How long a call has been going, as a table.
 *
 * No DOM and no agent: one function over a row and a clock, which is the whole
 * point of it being one — the interesting cases are a minute and an hour apart,
 * and waiting for them is not a test strategy. The clock being an argument is
 * what makes them a table, exactly as it is for `../commit/ago.ts`; the last
 * case below is about the thunk itself.
 *
 * The last block is the one this file exists for, and it is not about
 * arithmetic at all: a stopwatch that outlived the conversation it was timing.
 */

import type { ChatEntry } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { elapsedOf } from "./elapsed.ts"
import { toolRow } from "./rows.testlib.ts"

/** A RUNNING tool row, which is the only kind this rule has anything to say
 *  about — the skeleton is the shared one, and what is added here is the
 *  subject: a call the wire has not reported back on, with the stamp every
 *  duration below is measured from. */
const row = (extra: Partial<ChatEntry> = {}): ChatEntry =>
  toolRow({
    id: "tool:call-1",
    text: "grep for worktops",
    status: "in_progress",
    ...extra,
  })

/** The reader's clock, as a thunk — the shape the real one has, and the reason
 *  it has it: only the rows with something to draw may read it. */
const at = (iso: string) => () => Date.parse(iso)

describe("what it says", () => {
  test("seconds, while seconds are the question", () => {
    // "Is this stuck?" is a question about 5s against 50s, so below a minute
    // nothing is rounded away.
    expect(elapsedOf(row(), at("2026-08-21T12:00:05.000Z"))).toBe("5s")
    expect(elapsedOf(row(), at("2026-08-21T12:00:47.900Z"))).toBe("47s")
  })

  test("... and minutes keep theirs, because a minute and a half is still a wait", () => {
    expect(elapsedOf(row(), at("2026-08-21T12:01:12.000Z"))).toBe("1m 12s")
    expect(elapsedOf(row(), at("2026-08-21T12:04:00.000Z"))).toBe("4m 0s")
  })

  test("an hour drops them, because by then nobody is watching the last digit", () => {
    expect(elapsedOf(row(), at("2026-08-21T13:20:30.000Z"))).toBe("1h 20m")
  })
})

describe("when it says nothing", () => {
  test("a call younger than the threshold is drawn as the panel working", () => {
    // Most calls are a `Read` that lands in a quarter of a second. A number
    // that flashed onto every one of them would be a panel that flickers, and
    // furniture is the thing a reader stops seeing.
    expect(elapsedOf(row(), at("2026-08-21T12:00:00.200Z"))).toBeNull()
    expect(elapsedOf(row(), at("2026-08-21T12:00:02.999Z"))).toBeNull()
    // The threshold itself is the first moment there is something to say.
    expect(elapsedOf(row(), at("2026-08-21T12:00:03.000Z"))).toBe("3s")
  })

  test("a browser whose clock sits behind the server's says nothing, never a negative", () => {
    // Two machines, two clocks — `../commit/ago.ts` meets the same thing from
    // the other end. A call cannot have started in the future; what this is, is
    // a call that has only just started.
    expect(elapsedOf(row(), at("2026-08-21T11:59:55.000Z"))).toBeNull()
  })

  test("a call that has come back has no duration to draw", () => {
    // The mark and the report the frame already carries are what say what
    // became of it. A clock still running on a finished call would be the panel
    // claiming a grep was going while its output sat one fold away.
    expect(elapsedOf(row({ status: "completed" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
    expect(elapsedOf(row({ status: "failed" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
  })

  test("nor has a row that is not a call at all", () => {
    // `status` is a TOOL row's field, and the rule reads the KIND rather than
    // guessing from the field's absence (`./running.ts`) — because an absent
    // status on a tool row means `pending`, which is a running state. Guessing
    // would put a stopwatch on the sentence somebody typed.
    expect(elapsedOf(
      row({ kind: "user", status: undefined, text: "done order" }),
      at("2026-08-21T12:05:00.000Z"),
    )).toBeNull()
    // ... and it stays null for a row that somehow carries a status it has no
    // business carrying: the kind is what makes the field mean anything, so the
    // kind is what is asked.
    expect(elapsedOf(
      row({ kind: "agent", text: "let me look" }),
      at("2026-08-21T12:05:00.000Z"),
    )).toBeNull()
  })

  test("a call the panel has only just been told about is timed from the start", () => {
    // An announcement with no status yet is `pending` — announced, not "not
    // started" — so it counts from the moment it arrived rather than waiting
    // for a word the adapter may not send for half a minute.
    expect(elapsedOf(row({ status: undefined }), at("2026-08-21T12:00:09.000Z")))
      .toBe("9s")
  })

  test("a stamp that is not a time is left alone rather than guessed at", () => {
    // The wire REQUIRES the stamp, so this is never a missing field — it is
    // somebody else's string, and `Invalid Date` in a transcript is worse than
    // a row with no readout. `./when.ts` makes the same refusal about a
    // session's own stamp, through the same reading.
    expect(elapsedOf(row({ since: "the other day" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
  })
})

describe("a stopwatch may not outlive the turn it was timing", () => {
  test("a turn that ended stops the clock, whatever the status still says", () => {
    // The way this actually goes wrong, and the half a status cannot answer —
    // `./spawn.ts`'s own reason, arriving at a second face. A status is sticky
    // and the rows a dead agent left are deliberately still on screen to read,
    // so a call the agent died in the middle of says `pending` for as long as
    // the panel is open. Asked of the status alone, that is a number counting
    // up all afternoon under a process that stopped at lunchtime — a lie that
    // keeps getting bigger, which is the one kind a panel must not tell.
    const long = at("2026-08-21T12:40:00.000Z")
    expect(elapsedOf(row({ status: "pending", stranded: true }), long)).toBeNull()
    expect(elapsedOf(row({ status: "in_progress", stranded: true }), long)).toBeNull()
    // ... and the same row whose turn is still going is exactly the one that
    // should say so. The mark is the whole difference.
    expect(elapsedOf(row({ status: "pending" }), long)).toBe("40m 0s")
  })

  test("... and a LATER turn does not start it again", () => {
    // The case a conversation-level answer could not reach, and the reason the
    // fact lives on the row. A dead agent's rows are deliberately not cleared,
    // so the next thing anybody sends puts a live turn over a transcript full
    // of calls that will never report. Asked "is a turn in flight", every one
    // of them answers yes at once — and each draws a duration measured from its
    // own original stamp, so the panel sprouts half-hour clocks on work nothing
    // is doing.
    //
    // The row from the dead turn and the row from the live one are told apart
    // by the ROW, which is the only thing that CAN tell them apart.
    const now = at("2026-08-21T12:40:00.000Z")
    const abandoned = row({ id: "tool:old", status: "in_progress", stranded: true })
    const fresh = row({ id: "tool:new", since: "2026-08-21T12:39:50.000Z" })
    expect(elapsedOf(abandoned, now)).toBeNull()
    expect(elapsedOf(fresh, now)).toBe("10s")
  })

  test("the clock is not read at all for a row with nothing to time", () => {
    // Not an optimisation dressed as a claim: whatever computation asks this
    // becomes a subscriber to whatever it reads, and EVERY row of the
    // transcript asks. Read as a value, a tick would wake four hundred rules
    // once a second to answer `null` for three hundred and ninety-nine of them.
    // So the gate the ROW answers out of itself comes first, and the clock is
    // read only past it.
    let clocks = 0
    const counted = () => {
      clocks++
      return Date.parse("2026-08-21T12:05:00.000Z")
    }
    expect(elapsedOf(row({ status: "completed" }), counted)).toBeNull()
    expect(elapsedOf(row({ kind: "agent" }), counted)).toBeNull()
    expect(elapsedOf(row({ stranded: true }), counted)).toBeNull()
    expect(clocks).toBe(0)
    expect(elapsedOf(row(), counted)).toBe("5m 0s")
    expect(clocks).toBe(1)
  })
})
