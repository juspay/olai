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

  test("a subagent's call names the row of the Agent frame, not its id", () => {
    // The panel looks the frame UP by what this field says, so what it says
    // has to be a key of this collection — the same rule `ask` rows follow in
    // the other direction. An id here would be a mapping somebody has to keep
    // in step for nothing.
    const transcript = new Transcript()
    transcript.tool("toolu_01AGENT", { title: "find the call sites" })
    transcript.tool("call-1", { title: "Grep", parent: "toolu_01AGENT" })

    expect(rows(transcript)[1]).toMatchObject({ parent: "tool:toolu_01AGENT" })
    expect(transcript.entries().get("tool:toolu_01AGENT")).toBeDefined()
  })

  test("the main agent's own calls are in nobody's lane", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep" })
    expect(rows(transcript)[0]?.parent).toBeUndefined()
  })

  test("a completion that forgets the agent does not take the row out of its lane", () => {
    // The adapter stamps the attribution on a subagent's announcement and on
    // most of what follows, and it has shapes that carry only a status. A row
    // that read one of those as "no agent now" would step out of its lane at
    // the moment the call finished — which is the moment a reader looks.
    const transcript = new Transcript()
    transcript.tool("call-1", {
      title: "Grep",
      status: "in_progress",
      parent: "toolu_01AGENT",
    })
    transcript.tool("call-1", { status: "completed" })

    expect(rows(transcript)[0]).toMatchObject({
      status: "completed",
      parent: "tool:toolu_01AGENT",
    })
  })

  test("a call that spawned an agent goes on having spawned one", () => {
    // The other end of the same rule, and it is sticky a level DOWN as well.
    // The fact arrives split across frames because the ARGUMENTS do: the call
    // is announced as the tool use starts, refined once they have parsed, and
    // sent with no arguments at all when the input would not serialize — and
    // its completion says nothing about being a spawn either. A row that took
    // the last word literally would stop being a spawn, or keep being one with
    // the kind of agent taken back off it.
    const transcript = new Transcript()
    transcript.tool("toolu_01AGENT", {
      title: "explore the outline",
      status: "pending",
      spawned: { kind: "Explore" },
    })
    transcript.tool("toolu_01AGENT", { status: "in_progress", spawned: {} })
    transcript.tool("toolu_01AGENT", { status: "completed" })

    expect(rows(transcript)[0]).toMatchObject({
      status: "completed",
      spawned: { kind: "Explore" },
    })
  })

  test("a spawn is one before it says which kind of agent it sent", () => {
    // The arguments arrive incrementally — announced as the tool use starts,
    // refined as they finish parsing — so the first frame can honestly say a
    // spawn happened and nothing about who. The row is drawable then; the
    // kind lands on the next frame.
    const transcript = new Transcript()
    transcript.tool("toolu_01AGENT", { title: "Task", spawned: {} })
    expect(rows(transcript)[0]?.spawned).toEqual({})

    transcript.tool("toolu_01AGENT", {
      title: "explore the outline",
      spawned: { kind: "Explore" },
    })
    expect(rows(transcript)[0]).toMatchObject({
      text: "explore the outline",
      spawned: { kind: "Explore" },
    })
  })

  test("an ordinary call never becomes a spawn", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "completed" })
    expect(rows(transcript)[0]?.spawned).toBeUndefined()
  })
})

describe("questions", () => {
  const fields = [{
    key: "question_0",
    label: null,
    hint: null,
    kind: "choice" as const,
    choices: [{ value: "yes", label: "yes", hint: null }],
    required: false,
    attachedTo: null,
  }]

  test("answering a question moves the row it was asked on", () => {
    // The form and its answer are one thing that happened. A second row would
    // leave an answer with nothing above it saying what was asked.
    const transcript = new Transcript()
    transcript.ask("ask:1", "Shall I?", fields)
    const settled = transcript.settleAsk("ask:1", {
      how: "answered",
      answers: [{ key: "question_0", values: ["yes"] }],
    })

    expect(touched(settled)).toEqual(["ask:1"])
    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({ kind: "ask", text: "Shall I?" })
    expect(rows(transcript)[0]?.ask).toEqual({
      fields,
      outcome: { how: "answered", answers: [{ key: "question_0", values: ["yes"] }] },
    })
  })

  test("a question closes the paragraph the agent was writing", () => {
    const transcript = new Transcript()
    transcript.say("I need to know something")
    const change = transcript.ask("ask:1", "Shall I?", fields)

    expect(touched(change)).toEqual(["agent:1", "ask:1"])
    expect(rows(transcript)[0]?.streaming).toBeUndefined()
  })

  test("settling one that is no longer there says nothing", () => {
    // A session replaced under a pending question empties the transcript before
    // the withdrawal arrives; minting a row here would put a dead question at
    // the top of a fresh conversation.
    const transcript = new Transcript()
    transcript.ask("ask:1", "Shall I?", fields)
    transcript.clear()

    expect(transcript.settleAsk("ask:1", { how: "withdrawn", answers: [] }))
      .toEqual({ upserts: [], removes: [] })
    expect(rows(transcript)).toEqual([])
  })
})

// The rule every test here is about: THE MARK AND THE PROMPT MOVE TOGETHER.
// A row offering a retry with no prompt behind it offers one that refuses, and
// a prompt with no marked row is a message nobody can see. They live in one
// place so that neither is constructible, which is what these assert — always
// both, at every door.
//
// And the mark is TWO marks, which is the other half of the same rule: a
// refusal is certain and keeps its prompt, a silence is not and keeps none, so
// the button a person can press exists exactly where pressing it is honest.

describe("a message the agent would not take", () => {
  test("the mark goes on the row that was already drawn, and the words stay", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order", { context: [] })

    const marked = transcript.refused(row.key, "done order\nAbout: `order`")
    // THE SAME ROW, not a second one and not a notice underneath: what a
    // person typed stays where they typed it, and the failure is a property
    // of that message rather than an event beside it.
    expect(touched(marked)).toEqual([row.key])
    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({
      kind: "user",
      text: "done order",
      delivery: "refused",
    })
    // The PROMPT, not the row's text: what the agent refused had a node line
    // under it, and a retry rebuilt from what the panel shows would send
    // something else.
    expect(transcript.undelivered(row.key)).toBe("done order\nAbout: `order`")
  })

  test("a retry that lands takes the mark off and lets the prompt go", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order")
    transcript.refused(row.key, "done order")

    transcript.sent(row.key)
    // ABSENT rather than a third value: an ordinary message says nothing about
    // this, and a row left carrying the field would go on being drawn as one
    // that had failed once.
    expect(rows(transcript)[0]?.delivery).toBeUndefined()
    expect(rows(transcript)[0]?.text).toBe("done order")
    // ... and nothing is left to retry it with, so a second click is refused
    // rather than sending the message twice.
    expect(transcript.undelivered(row.key)).toBeNull()
  })

  test("marking a row a replaced session took away keeps neither half", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order")
    transcript.clear()

    expect(transcript.refused(row.key, "done order")).toEqual({ upserts: [], removes: [] })
    expect(rows(transcript)).toEqual([])
    // The prompt is not kept for a row that is not there: it would be a retry
    // nothing on screen could ask for, landing in a conversation that never
    // saw the message.
    expect(transcript.undelivered(row.key)).toBeNull()
  })

  test("clearing takes the prompts with the rows", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order")
    transcript.refused(row.key, "done order")

    transcript.clear()
    // The one place a conversation ends empties BOTH halves, so no caller has
    // to remember the second — which is the whole reason they live together.
    expect(transcript.undelivered(row.key)).toBeNull()
  })
})

describe("a message nothing ever answered about", () => {
  test("the row says so, and there is nothing to send it again with", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order", { context: [] })

    const marked = transcript.unanswered(row.key)

    expect(touched(marked)).toEqual([row.key])
    expect(rows(transcript)[0]).toMatchObject({
      kind: "user",
      // THE WORDS ARE STILL THERE, which was always the promise. What is
      // missing is the certainty, not the message.
      text: "done order",
      delivery: "unanswered",
    })
    // NO PROMPT, and that is the design rather than an omission: the agent may
    // have this message already, so a retry would be a duplicate offered to
    // somebody with no way to tell. Keeping nothing is what makes the button
    // unofferable rather than merely undrawn.
    expect(transcript.undelivered(row.key)).toBeNull()
  })

  test("a refusal that turns into a silence lets its prompt go", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order")
    transcript.refused(row.key, "done order")

    // The retry went out and THAT one went quiet — the same row, a second
    // reading of what became of it. The first failure's prompt must not
    // outlive it: a button built from it would send a message the agent may
    // now be holding.
    transcript.unanswered(row.key)

    expect(rows(transcript)[0]?.delivery).toBe("unanswered")
    expect(transcript.undelivered(row.key)).toBeNull()
  })
})

describe("refusals and replacement", () => {
  test("a refusal carries the failure itself, not a sentence about it", () => {
    const transcript = new Transcript()
    const failure = new ValidationFailure({
      reason: "`done: Kitchen remodel` would leave the outlines invalid",
      errors: [{
        code: "duplicate-id",
        file: "house.olai",
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
