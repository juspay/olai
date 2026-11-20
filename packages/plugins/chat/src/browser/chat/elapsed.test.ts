import type { ChatEntry, ToolEntry, UserEntry } from "olai-plugin-chat/wire"
import { describe, expect, test } from "bun:test"

import { HOUR, MINUTE, SECOND } from "@olai/web/client/clock.ts"
import { elapsedOf, outFor } from "./elapsed.ts"
import { toolRow } from "./rows.testlib.ts"

const row = (extra: Partial<ToolEntry> = {}): ToolEntry =>
  toolRow({
    id: "tool:call-1",
    text: "grep for worktops",
    status: "in_progress",
    ...extra,
  })

const user = (text: string): UserEntry => ({
  id: "user:1",
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "user",
  text,
})

const agent = (text: string): ChatEntry => ({
  id: "agent:1",
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "agent",
  text,
})

const at = (iso: string) => () => Date.parse(iso)

describe("what it says", () => {
  test("seconds, while seconds are the question", () => {
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
    expect(elapsedOf(row(), at("2026-08-21T12:00:00.200Z"))).toBeNull()
    expect(elapsedOf(row(), at("2026-08-21T12:00:02.999Z"))).toBeNull()
    expect(elapsedOf(row(), at("2026-08-21T12:00:03.000Z"))).toBe("3s")
  })

  test("a browser whose clock sits behind the server's says nothing, never a negative", () => {
    expect(elapsedOf(row(), at("2026-08-21T11:59:55.000Z"))).toBeNull()
  })

  test("a call that has come back has no duration to draw", () => {
    expect(elapsedOf(row({ status: "completed" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
    expect(elapsedOf(row({ status: "failed" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
  })

  test("nor has a row that is not a call at all", () => {
    expect(elapsedOf(user("done order"), at("2026-08-21T12:05:00.000Z"))).toBeNull()
    expect(elapsedOf(agent("let me look"), at("2026-08-21T12:05:00.000Z"))).toBeNull()
  })

  test("a call the panel has only just been told about is timed from the start", () => {
    expect(elapsedOf(row({ status: "pending" }), at("2026-08-21T12:00:09.000Z")))
      .toBe("9s")
  })

  test("a call sent out AGAIN is timed from the resume, not from its birth", () => {
    expect(
      elapsedOf(
        row({ resumed: "2026-08-21T15:00:00.000Z" }),
        at("2026-08-21T15:01:00.000Z"),
      ),
    ).toBe("1m 0s")
  })

  test("... and a resumed stamp that is not a time says nothing, like the other", () => {
    expect(
      elapsedOf(row({ resumed: "the other day" }), at("2026-08-21T12:05:00.000Z")),
    ).toBeNull()
  })

  test("a stamp that is not a time is left alone rather than guessed at", () => {
    expect(elapsedOf(row({ since: "the other day" }), at("2026-08-21T12:05:00.000Z")))
      .toBeNull()
  })
})

describe("a stopwatch may not outlive the turn it was timing", () => {
  test("a turn that ended stops the clock, whatever the status still says", () => {
    const long = at("2026-08-21T12:40:00.000Z")
    expect(elapsedOf(row({ status: "pending", stranded: true }), long)).toBeNull()
    expect(elapsedOf(row({ status: "in_progress", stranded: true }), long)).toBeNull()
    expect(elapsedOf(row({ status: "pending" }), long)).toBe("40m 0s")
  })

  test("... and a LATER turn does not start it again", () => {
    const now = at("2026-08-21T12:40:00.000Z")
    const abandoned = row({ id: "tool:old", status: "in_progress", stranded: true })
    const fresh = row({ id: "tool:new", since: "2026-08-21T12:39:50.000Z" })
    expect(elapsedOf(abandoned, now)).toBeNull()
    expect(elapsedOf(fresh, now)).toBe("10s")
  })

  test("the clock is not read at all for a row with nothing to time", () => {
    let clocks = 0
    const counted = () => {
      clocks++
      return Date.parse("2026-08-21T12:05:00.000Z")
    }
    expect(elapsedOf(row({ status: "completed" }), counted)).toBeNull()
    expect(elapsedOf(agent("let me look"), counted)).toBeNull()
    expect(elapsedOf(row({ stranded: true }), counted)).toBeNull()
    expect(clocks).toBe(0)
    expect(elapsedOf(row(), counted)).toBe("5m 0s")
    expect(clocks).toBe(1)
  })
})

describe("how long a task has been out", () => {
  const ARMED = "2026-08-21T12:00:00.000Z"
  const at = (ms: number) => Date.parse(ARMED) + ms

  test("the same words the row's own readout uses", () => {
    expect(outFor(ARMED, at(47 * SECOND))).toBe("47s")
    expect(outFor(ARMED, at(72 * SECOND))).toBe("1m 12s")
    expect(outFor(ARMED, at(3 * HOUR + 20 * MINUTE))).toBe("3h 20m")
  })

  test("and NO quiet threshold, which is the difference from the row's", () => {
    expect(outFor(ARMED, at(SECOND))).toBe("1s")
    expect(outFor(ARMED, at(0))).toBe("0s")
  })

  test("a clock behind the server's reads as just armed, never as the future", () => {
    expect(outFor(ARMED, at(-5 * SECOND))).toBe("0s")
  })

  test("a stamp that is not a time says nothing", () => {
    expect(outFor("whenever", at(SECOND))).toBeNull()
  })
})
