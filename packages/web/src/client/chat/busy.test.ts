/**
 * What the panel says it is doing, over values.
 *
 * The whole reason this strip exists is that a busy panel used to look
 * identical to a finished one from the bottom of the transcript, which is where
 * a person who has just pressed enter is looking — so the cases that matter are
 * the ones where it must NOT be drawn (silence is the answer, and a strip left
 * up over an idle panel is the same lie the other way round) and the one where
 * a turn is in flight but the move is a person's.
 */

import { CHAT_OFF, type ChatState } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { busyWith } from "./busy.ts"

/** A live panel talking to somebody, as the cell holds one. */
const LIVE: ChatState = {
  ...CHAT_OFF,
  status: "idle",
  talking: { kind: "agent", id: "opencode", name: "opencode", steers: false },
}

describe("when the panel says nothing at all", () => {
  test("an idle conversation is not busy", () => {
    expect(busyWith(LIVE)).toBeNull()
  })

  test("neither is one whose agent has gone", () => {
    // The header says `not running` and the banner says why. A live dot over
    // that would be the panel claiming work is happening in a dead process.
    expect(busyWith({ ...LIVE, status: "gone" })).toBeNull()
  })

  test("nor a panel with no agent configured", () => {
    expect(busyWith(CHAT_OFF)).toBeNull()
  })
})

describe("a turn in flight", () => {
  test("names who is working", () => {
    // A machine with two agents installed is one where "the agent" is a
    // question, and the answer is already on the cell.
    expect(busyWith({ ...LIVE, status: "thinking" })).toBe("opencode is working…")
  })

  test("... and says so without a name where there is none yet", () => {
    expect(busyWith({ ...LIVE, status: "thinking", talking: null })).toBe("working…")
  })

  test("A QUESTION OUTRANKS IT: the move is the person's, and it says so", () => {
    // `asking` is only ever true while a turn is in flight, so "thinking →
    // working" without this arm tells somebody to wait for themselves.
    expect(busyWith({ ...LIVE, status: "thinking", asking: 1 })).toBe(
      "waiting on your answer",
    )
  })
})

describe("an agent starting", () => {
  test("is busy too, and is the longer of the two", () => {
    // Choosing an agent starts a subprocess, so this is the window a message
    // sent into it goes quiet in — and it was invisible down here.
    expect(busyWith({ ...LIVE, status: "booting" })).toBe("starting opencode…")
  })

  test("... with no name while nobody is bound yet", () => {
    expect(busyWith({ ...LIVE, status: "booting", talking: null })).toBe("starting…")
  })

  test("a boot that stopped to ask which agent is not starting one", () => {
    // The panel is waiting on a person, and the picker is what it is drawing.
    expect(busyWith({ ...LIVE, status: "booting", talking: { kind: "asking" } })).toBe(
      "starting…",
    )
  })
})
