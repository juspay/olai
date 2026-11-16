/**
 * THE SIX WORDS, PINNED — what a plugin's page, the sidebar's mark and the
 * alert all read off one row.
 *
 * These are the distinctions a roster cannot make on its own, and every one of
 * them was drawn wrongly on this branch before it was tested: *paused* told
 * from *ready* by the switch rather than by whether anybody had ever approved
 * anything, and *being built* ended at a file landing rather than at the agent
 * saying it was done. Both read as a sentence about a different plugin than
 * the one on screen, which is the kind of wrong a type cannot catch.
 */

import { describe, expect, test } from "bun:test"

import type { BuiltPlugin } from "@olai/surface"

import { changedCount, diffLines } from "./diff.ts"
import { building, markOf, metaOf, stageOf, wakes, type Defined } from "./state.ts"

const plugin = (source: Partial<BuiltPlugin["source"] & object>, row: Partial<BuiltPlugin> = {}): Defined => ({
  name: "swatch",
  running: false,
  state: "pending",
  ...row,
  source: {
    folder: "plugins/swatch/",
    title: "Swatch",
    description: "",
    version: "v1",
    approved: false,
    on: false,
    server: "export default definePlugin({})",
    ...source,
  },
}) as Defined

describe("which of the six", () => {
  test("a folder nobody has decided about is ready to be read, whatever its switch says", () => {
    // A folder COPIED IN carries no approval and may well carry `on: yes` from
    // the vault it came from; it is still a plugin nobody here has read.
    expect(stageOf(plugin({}))).toBe("review")
    expect(stageOf(plugin({ on: true }))).toBe("review")
  })

  test("an approval that moved is paused, even with the switch down", () => {
    expect(stageOf(plugin({ decided: true, on: true }))).toBe("paused")
    expect(stageOf(plugin({ decided: true, on: false }))).toBe("paused")
    expect(metaOf(plugin({ decided: true, on: true }), "paused")).toBe("changed since you turned it on")
  })

  test("being built ends when the builder says so, not when a file lands", () => {
    const landing = plugin({ builder: "chat-1", server: "" })
    expect(stageOf(landing)).toBe("building")
    // The server half has landed and the face has not. The old test for this
    // was `server.ts` being non-empty, and it rang *ready for you* here.
    const halfway = plugin({ builder: "chat-1" })
    expect(stageOf(halfway)).toBe("building")
    expect(building(halfway)).toBe(true)
    const done = plugin({ builder: "chat-1", checked: "v1" })
    expect(stageOf(done)).toBe("review")
  })

  test("...and the reader can go past it when nothing ever says so", () => {
    expect(stageOf(plugin({ builder: "chat-1" }), true)).toBe("review")
  })

  test("an agent editing an approved plugin is a change, not a build", () => {
    const edited = plugin({ builder: "chat-1", decided: true, on: true, checked: "v0" })
    expect(stageOf(edited)).toBe("paused")
  })

  test("a half that will not compile is broken before anybody approves it", () => {
    const broken = plugin({ builder: "chat-1", checked: "v1" }, { state: "failed", fault: "Unexpected token" })
    expect(stageOf(broken)).toBe("broken")
    expect(markOf(stageOf(broken))).toBe("problem")
  })

  test("a plugin that stopped because its code changed is worth waking somebody for", () => {
    expect(wakes("paused")).toBe(true)
    expect(wakes("review")).toBe(true)
    expect(wakes("broken")).toBe(true)
    expect(wakes("on")).toBe(false)
    expect(wakes("building")).toBe(false)
  })
})

describe("how much changed", () => {
  test("one line edited is one line, not a removal and an addition", () => {
    expect(changedCount(diffLines("a\nb\nc\n", "a\nB\nc\n"))).toBe(1)
  })

  test("...and two places changed are two", () => {
    expect(changedCount(diffLines("a\nb\nc\nd\n", "A\nb\nc\nD\n"))).toBe(2)
  })

  test("a run counts as its longer side", () => {
    expect(changedCount(diffLines("a\nb\nc\n", "a\nB\nC\nD\nc\n"))).toBe(3)
    expect(changedCount(diffLines("a\nb\nc\nd\n", "a\nd\n"))).toBe(2)
  })

  test("nothing changed is nothing", () => {
    expect(changedCount(diffLines("a\nb\n", "a\nb\n"))).toBe(0)
  })
})
