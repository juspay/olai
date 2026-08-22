/**
 * What the panel is busy doing, over values.
 *
 * The whole reason there is a decision here rather than a ternary in each face
 * is that TWO of them ask it — the header's slot beside the model, and the
 * strip under the transcript — and the one that would silently disagree is the
 * one nobody is looking at. So the cases that matter are the ones where it must
 * answer NOTHING (silence is the answer, and a live cue left up over an idle
 * panel is the same lie the other way round) and the one where a turn is in
 * flight but the move is a person's.
 */

import { CHAT_OFF, type ChatState } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { busyIn } from "./busy.ts"

/** A live panel talking to somebody, as the cell holds one. */
const LIVE: ChatState = {
  ...CHAT_OFF,
  status: "idle",
  talking: { kind: "agent", id: "opencode", name: "opencode", steers: false },
}

describe("when the panel is busy with nothing at all", () => {
  test("an idle conversation", () => {
    expect(busyIn(LIVE)).toBeNull()
  })

  test("one whose agent has gone", () => {
    // The header says `not running` and the banner says why. A live dot over
    // that would be the panel claiming work is happening in a dead process.
    expect(busyIn({ ...LIVE, status: "gone" })).toBeNull()
  })

  test("and one with no agent configured", () => {
    expect(busyIn(CHAT_OFF)).toBeNull()
  })
})

describe("a turn in flight", () => {
  test("is the agent working, and carries who", () => {
    // A machine with two agents installed is one where "the agent" is a
    // question. The face with room to say it says it.
    expect(busyIn({ ...LIVE, status: "thinking" })).toEqual({
      kind: "working",
      agent: "opencode",
    })
  })

  test("... with nobody named where there is nobody yet", () => {
    expect(busyIn({ ...LIVE, status: "thinking", talking: null })).toEqual({
      kind: "working",
      agent: null,
    })
  })

  test("A QUESTION OUTRANKS IT: the move is the person's", () => {
    // `asking` is only ever true while a turn is in flight, so "thinking →
    // working" without this arm tells somebody to wait for themselves.
    expect(busyIn({ ...LIVE, status: "thinking", asking: 1 })).toEqual({ kind: "waiting" })
  })
})

describe("an agent starting", () => {
  test("is busy too, and is the longer of the two", () => {
    // Choosing an agent starts a subprocess, so this is the window a message
    // sent into it waits in — and it was invisible under the transcript.
    expect(busyIn({ ...LIVE, status: "booting" })).toEqual({
      kind: "starting",
      agent: "opencode",
    })
  })

  test("... with nobody named while nobody is bound", () => {
    expect(busyIn({ ...LIVE, status: "booting", talking: null })).toEqual({
      kind: "starting",
      agent: null,
    })
  })

  test("a boot that stopped to ask which agent names nobody either", () => {
    // The panel is waiting on a person, and the picker is what it is drawing.
    expect(busyIn({ ...LIVE, status: "booting", talking: { kind: "asking" } })).toEqual({
      kind: "starting",
      agent: null,
    })
  })
})
