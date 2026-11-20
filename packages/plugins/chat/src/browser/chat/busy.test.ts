import { CHAT_OFF, type ChatState } from "olai-plugin-chat/wire"
import { describe, expect, test } from "bun:test"

import { busyIn } from "./busy.ts"

const LIVE: ChatState = {
  ...CHAT_OFF,
  status: "idle",
  talking: {
    kind: "agent",
    id: "opencode",
    name: "opencode",
    steers: false,
    queues: false,
    methods: [],
  },
}

describe("when the panel is busy with nothing at all", () => {
  test("an idle conversation", () => {
    expect(busyIn(LIVE)).toBeNull()
  })

  test("one whose agent has gone", () => {
    expect(busyIn({ ...LIVE, status: "gone" })).toBeNull()
  })

  test("and one with no agent configured", () => {
    expect(busyIn(CHAT_OFF)).toBeNull()
  })
})

describe("a turn in flight", () => {
  test("is the agent working, and carries who", () => {
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
    expect(busyIn({ ...LIVE, status: "thinking", asking: 1 })).toEqual({ kind: "waiting" })
  })

  test("...UNLESS THE TURN IS OLAI'S OWN, and then nobody is being waited on", () => {
    expect(busyIn({ ...LIVE, status: "thinking", asking: 1, sleep: true })).toEqual({
      kind: "working",
      agent: "opencode",
    })
  })
})

describe("an agent starting", () => {
  test("is busy too, and is the longer of the two", () => {
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
    expect(busyIn({ ...LIVE, status: "booting", talking: { kind: "asking" } })).toEqual({
      kind: "starting",
      agent: null,
    })
  })
})
