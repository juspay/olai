import { expect, test } from "bun:test"

import { type ClosedBy, type Editing, leavingCommits, openedOn, sending, writes } from "./editor.ts"

const PR = { key: "pr", value: "https://x/1" }

test("changing a value is a write, and the key comes from the property, not the box", () => {
  expect(writes(PR, "pr", "https://x/2")).toBe(true)
  expect(sending(PR, "anything at all", "https://x/2"))
    .toEqual({ key: "pr", value: "https://x/2", was: "https://x/1" })
})

test("clearing the value is a write, and it is the REMOVAL — the op's own reading", () => {
  expect(writes(PR, "pr", "")).toBe(true)
  expect(sending(PR, "pr", "")).toEqual({ key: "pr", value: "", was: "https://x/1" })
})

test("changing nothing writes nothing — a chip opened and left alone is silent", () => {
  expect(writes(PR, "pr", "https://x/1")).toBe(false)
})

test("a new property needs a key and something to hold", () => {
  expect(writes(null, "agent", "claude-opus")).toBe(true)
  expect(writes(null, "", "claude-opus")).toBe(false)
  expect(writes(null, "   ", "claude-opus")).toBe(false)
  expect(writes(null, "agent", "")).toBe(false)
})

test("a new key is trimmed, because a key is a name and the space around one is nobody's", () => {
  expect(sending(null, "  agent  ", "claude-opus"))
    .toEqual({ key: "agent", value: "claude-opus", was: null })
  expect(sending(null, "merge", "the human approves ").value).toBe("the human approves ")
})

test("the snapshot is the write's condition — the one the editor opened on, or none at all", () => {
  expect(sending(PR, "pr", "https://x/2").was).toBe("https://x/1")
  expect(sending(null, "pr", "https://x/2").was).toBeNull()
})

const editor = () => {
  const sent: Array<"enter's write" | "the blur's write"> = []
  const carried: Array<Editing | null> = []
  let answeredBy: ClosedBy = null
  let snapshot: Editing | null = null
  return {
    sent,
    carried,
    open: (on: Editing | null = null) => {
      answeredBy = null
      snapshot = on
    },
    enter: () => {
      answeredBy = "enter"
      sent.push("enter's write")
      carried.push(snapshot)
    },
    escape: () => {
      answeredBy = "escape"
    },
    blur: () => {
      if (leavingCommits(answeredBy)) {
        sent.push("the blur's write")
        carried.push(snapshot)
      }
    },
  }
}

test("one Enter, one commit — the blur its close fires stands down", () => {
  const gestures = editor()
  gestures.open()
  gestures.enter()
  gestures.blur()
  expect(gestures.sent).toEqual(["enter's write"])
})

test("a second open answers for itself — the record is born with the open", () => {
  const gestures = editor()
  gestures.open()
  gestures.enter()
  gestures.blur()
  gestures.open()
  gestures.blur()
  expect(gestures.sent).toEqual(["enter's write", "the blur's write"])
})

test("still once on the way out: leaving the box IS the commit", () => {
  const gestures = editor()
  gestures.open()
  gestures.blur()
  expect(gestures.sent).toEqual(["the blur's write"])
})

test("Escape abandons — and the blur its close fires writes nothing", () => {
  const gestures = editor()
  gestures.open()
  gestures.escape()
  gestures.blur()
  expect(gestures.sent).toEqual([])
})

test("the blur's commit rides in on the very snapshot Enter's would — one open, one answer", () => {
  const stage = { key: "stage", value: "review" }
  const enterFirst = editor()
  enterFirst.open(stage)
  enterFirst.enter()
  enterFirst.blur()
  expect(enterFirst.sent).toEqual(["enter's write"])
  expect(enterFirst.carried).toEqual([stage])

  const blurFirst = editor()
  blurFirst.open(stage)
  blurFirst.blur()
  expect(blurFirst.sent).toEqual(["the blur's write"])
  expect(blurFirst.carried).toEqual([stage])

  const twice = editor()
  twice.open(stage)
  twice.enter()
  twice.blur()
  twice.open({ key: "stage", value: "addressing" })
  twice.blur()
  expect(twice.carried).toEqual([stage, { key: "stage", value: "addressing" }])
})

const custom = (key: string) => ({ key, system: false })
const system = (key: string) => ({ key, system: true })
const EDITING = { key: "date", value: "in review" }

test("the editor is open on the chip it was opened from", () => {
  expect(openedOn(EDITING, custom("date"))).toEqual(EDITING)
  expect(openedOn(EDITING, custom("agent"))).toBeUndefined()
  expect(openedOn(undefined, custom("date"))).toBeUndefined()
  expect(openedOn(null, custom("date"))).toBeUndefined()
})

test("a SYSTEM chip is never the one, however its key is spelled", () => {
  expect(openedOn(EDITING, system("date"))).toBeUndefined()
  expect(openedOn(EDITING, system("id"))).toBeUndefined()
  expect(openedOn(EDITING, custom("date"))).toEqual(EDITING)
})
