import { describe, expect, test } from "bun:test"

import type { BuiltPlugin } from "@olai/surface"

import { changedCount, diffLines } from "./diff.ts"
import { noticeOf } from "./alerts.ts"
import { markOf, metaOf, stageOf, wakes, type Defined } from "./state.ts"

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
    expect(stageOf(plugin({}))).toBe("review")
    expect(stageOf(plugin({ on: true }))).toBe("review")
  })

  test("an approval that moved is paused, even with the switch down", () => {
    expect(stageOf(plugin({ decided: true, on: true }))).toBe("paused")
    expect(stageOf(plugin({ decided: true, on: false }))).toBe("paused")
    expect(metaOf(plugin({ decided: true, on: true }), "paused")).toBe("changed since you turned it on")
  })

  test("a folder the serve says is being built is being built", () => {
    expect(stageOf(plugin({ building: true }))).toBe("building")
  })

  test("...and the reader can go past it when nothing ever says so", () => {
    expect(stageOf(plugin({ building: true }), true)).toBe("review")
  })

  test("a half that will not compile is broken before anybody approves it", () => {
    const broken = plugin({ chat: true }, { state: "failed", fault: "Unexpected token" })
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

describe("what the notice says about a plugin that is ready", () => {
  test("a chat at its address is an agent having finished it", () => {
    expect(noticeOf(plugin({ chat: true }), "review").body).toContain("An agent finished building it")
  })

  test("...and with no chat there, nobody is said to have built it", () => {
    expect(noticeOf(plugin({}), "review").body).toContain("nobody has read it yet")
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
