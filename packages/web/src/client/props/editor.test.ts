/**
 * Editing a chip in place: what a commit would send, and when it sends nothing.
 *
 * The silent cases are the ones worth the file. A gesture that reaches a
 * refusal is worse than one that does nothing, and "open a chip and click away"
 * is a gesture somebody makes by accident several times a minute.
 */

import { expect, test } from "bun:test"

import { sending, writes } from "./editor.ts"

const PR = { key: "pr", value: "https://x/1" }

test("changing a value is a write, and the key comes from the property, not the box", () => {
  expect(writes(PR, "pr", "https://x/2")).toBe(true)
  expect(sending(PR, "anything at all", "https://x/2"))
    .toEqual({ key: "pr", value: "https://x/2" })
})

test("clearing the value is a write, and it is the REMOVAL — the op's own reading", () => {
  // `set_prop` with `""` takes the key off, exactly as `null` does
  // (`@olai/ops`' plan). The face offers what the tool offers.
  expect(writes(PR, "pr", "")).toBe(true)
  expect(sending(PR, "pr", "")).toEqual({ key: "pr", value: "" })
})

test("changing nothing writes nothing — a chip opened and left alone is silent", () => {
  expect(writes(PR, "pr", "https://x/1")).toBe(false)
})

test("a new property needs a key and something to hold", () => {
  expect(writes(null, "agent", "claude-opus")).toBe(true)
  // A blank key is not a key — the ops layer refuses one in those words, and
  // there is nothing here for it to say it about.
  expect(writes(null, "", "claude-opus")).toBe(false)
  expect(writes(null, "   ", "claude-opus")).toBe(false)
  // ...and a new key with an empty value would be the removal of a key that is
  // not there, which is the one thing `set_prop` refuses about removals. So
  // `+` and then Enter is a way out rather than a complaint.
  expect(writes(null, "agent", "")).toBe(false)
})

test("a new key is trimmed, because a key is a name and the space around one is nobody's", () => {
  expect(sending(null, "  agent  ", "claude-opus"))
    .toEqual({ key: "agent", value: "claude-opus" })
  // The VALUE is not trimmed: it is somebody's text, and a sentence that ends
  // in a space is still that sentence.
  expect(sending(null, "merge", "the human approves ").value).toBe("the human approves ")
})
