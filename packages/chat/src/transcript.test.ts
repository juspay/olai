/**
 * The transcript's own rules, over values.
 *
 * Nothing here needs an agent, a socket or a browser: the transcript is a data
 * structure with three rules — chunks accumulate, tool calls update in place by
 * id, a replay replaces rather than appends — and each is assertable directly.
 */

import type { ChatEntry } from "@olai/surface"
import { ValidationFailure } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { type Change, Transcript } from "./transcript.ts"

/** The rows as a reader would see them: conversation order, which is `seq`. */
const rows = (transcript: Transcript): ReadonlyArray<ChatEntry> =>
  [...transcript.entries().values()].sort((a, b) => a.seq - b.seq)

/** What one change touched, so a test can say a re-publish happened rather
 *  than inferring it from the state afterwards. */
const touched = (change: Change): ReadonlyArray<string> =>
  change.upserts.map(([key]) => key)

describe("prose", () => {
  test("chunks accumulate into one row, not one row each", () => {
    const transcript = new Transcript()
    transcript.say("Hello")
    transcript.say(", ")
    transcript.say("world")

    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({
      kind: "agent",
      text: "Hello, world",
      streaming: true,
    })
  })

  test("the turn ending stops the cursor", () => {
    const transcript = new Transcript()
    transcript.say("done thinking")
    const settled = transcript.settle()

    expect(touched(settled)).toEqual(["agent:1"])
    expect(rows(transcript)[0]?.streaming).toBeUndefined()
  })

  test("settling twice says nothing the second time", () => {
    const transcript = new Transcript()
    transcript.say("x")
    transcript.settle()
    expect(transcript.settle()).toEqual({ upserts: [], removes: [] })
  })

  /**
   * The bug the single-source refactor removed, kept as a test.
   *
   * An agent that speaks, then calls a tool, has finished that paragraph — the
   * next thing it says is a new one. The pointer said so; the row did not,
   * because clearing the pointer did not re-publish the row it left. So a
   * cursor blinked on a finished paragraph until the end of the turn.
   */
  test("a row stops streaming the moment something else opens", () => {
    const transcript = new Transcript()
    transcript.say("let me look")
    const change = transcript.tool("call-1", { title: "search_nodes" })

    // The tool frame AND the paragraph it closed, in one frame.
    expect(touched(change)).toEqual(["agent:1", "tool:call-1"])
    expect(rows(transcript)[0]?.streaming).toBeUndefined()

    // And the next thing said is a new paragraph, not an append to the old.
    transcript.say("found it")
    expect(rows(transcript).map((entry) => entry.text)).toEqual([
      "let me look",
      "search_nodes",
      "found it",
    ])
  })

  test("a standalone row closes the open one too", () => {
    const transcript = new Transcript()
    transcript.say("thinking")
    transcript.add("notice", "cancelled")
    expect(rows(transcript)[0]?.streaming).toBeUndefined()
  })
})

describe("tool calls", () => {
  test("a second report is the same row, not a second one", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "set_done", status: "in_progress" })
    transcript.tool("call-1", { status: "completed", detail: "{}" })

    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({
      kind: "tool",
      text: "set_done",
      status: "completed",
      detail: "{}",
    })
  })

  test("an absent field is unchanged, never cleared", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "set_done", detail: "{}" })
    transcript.tool("call-1", { status: "completed" })
    expect(rows(transcript)[0]).toMatchObject({ text: "set_done", detail: "{}" })
  })

  test("a row keeps its place in the conversation when it is updated", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "first" })
    transcript.add("notice", "in between")
    transcript.tool("call-1", { status: "completed" })

    expect(rows(transcript).map((entry) => entry.text)).toEqual([
      "first",
      "in between",
    ])
  })
})

describe("refusals and replacement", () => {
  test("a refusal carries the failure itself, not a sentence about it", () => {
    const transcript = new Transcript()
    const failure = new ValidationFailure({
      reason: "`done: Kitchen remodel` would leave the outlines invalid",
      errors: [{
        code: "duplicate-id",
        file: "house.jsonl",
        line: 3,
        message: "`order` is already the id of another node",
      }],
    })
    transcript.refuse("`set_done` was refused", failure)

    const entry = rows(transcript)[0]
    expect(entry?.kind).toBe("refusal")
    expect(entry?.refusal).toBe(failure)
  })

  test("clearing reports every key it dropped, so a subscriber empties", () => {
    const transcript = new Transcript()
    transcript.add("user", "hello")
    transcript.say("hi")
    transcript.tool("call-1", { title: "x" })

    const cleared = transcript.clear()
    expect([...cleared.removes].sort()).toEqual(["agent:2", "tool:call-1", "user:1"])
    expect(rows(transcript)).toEqual([])

    // And the sequence starts over, so a replayed conversation reads from the
    // top rather than after the one it replaced.
    transcript.add("user", "what did we decide?")
    expect(rows(transcript)[0]?.seq).toBe(0)
  })
})
