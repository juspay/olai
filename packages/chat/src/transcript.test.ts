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

/** A row of this kind, or `undefined` — so a test that reads a kind-specific
 *  field names the kind rather than pretending every row carries it. */
const asKind = <K extends ChatEntry["kind"]>(
  entry: ChatEntry | undefined,
  kind: K,
): Extract<ChatEntry, { kind: K }> | undefined =>
  entry?.kind === kind ? (entry as Extract<ChatEntry, { kind: K }>) : undefined

const parentOf = (entry: ChatEntry | undefined): string | undefined =>
  entry?.kind === "tool" || entry?.kind === "ask" ? entry.parent : undefined

/** A change that says nothing at all — spelled once, because the empty
 *  answer has three fields now and a test asserting two of them would pass
 *  while the third carried a piece nobody meant to publish. */
const NOTHING: Change = { upserts: [], removes: [], appends: [] }

/** What one change touched, so a test can say a re-publish happened rather
 *  than inferring it from the state afterwards. */
const touched = (change: Change): ReadonlyArray<string> =>
  change.upserts.map(([key]) => key)

/** What one change ADDED to a row, as `<key>@<offset>:<text>` — the other half
 *  of {@link touched}, and spelled the same way for the same reason: a
 *  streaming answer's whole subject is what a change carries about a row it is
 *  not republishing. */
const added = (change: Change): ReadonlyArray<string> =>
  change.appends.map((piece) => `${piece.of}@${piece.at}:${piece.text}`)

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

  /**
   * The defect `transcript-stream-quadratic` names, as a claim about what a
   * change CARRIES rather than about what a row holds.
   *
   * A chunk used to be published as the whole row it grew, so an answer cost
   * the wire the sum of its own prefixes — 1,039,111 bytes for 3,218 of
   * answer, measured on a real turn. The row is still whole HERE, which is the
   * other half of the fix and what makes the pieces safe: a reader handed the
   * row is never handed part of one.
   */
  test("a chunk into an open row is published as the chunk, never as the row", () => {
    const transcript = new Transcript()
    const opened = transcript.say("Hello")
    // The FIRST chunk mints the row, because there is nothing on the far end
    // to append to yet — one row, carrying one chunk.
    expect(touched(opened)).toEqual(["agent:1"])
    expect(added(opened)).toEqual([])

    expect(added(transcript.say(", "))).toEqual(["agent:1@5:, "])
    expect(added(transcript.say("world"))).toEqual(["agent:1@7:world"])
    // ... and not one byte of the row itself.
    expect(touched(transcript.say("!"))).toEqual([])
  })

  test("what the pieces say and what the row holds are the same text", () => {
    const transcript = new Transcript()
    const said = ["Once", " upon", " a", " time"]
    let text = ""
    for (const chunk of said) {
      const change = transcript.say(chunk)
      for (const piece of change.appends) {
        // The offset is where the piece belongs, so a reader with the row's
        // text this long puts it exactly here.
        expect(piece.at).toBe(text.length)
        text += piece.text
      }
      for (const [, row] of change.upserts) text = row.text
    }
    expect(text).toBe(said.join(""))
    expect(rows(transcript)[0]?.text).toBe(said.join(""))
  })

  test("the end of a paragraph publishes it whole, pieces and all", () => {
    const transcript = new Transcript()
    transcript.say("a long ")
    transcript.say("answer")
    const settled = transcript.settle()

    // Whole, so nothing has to be reassembled to be right — and no piece rides
    // with it, because the row it would belong to is right there.
    expect(settled.upserts.map(([key, row]) => [key, row.text])).toEqual([
      ["agent:1", "a long answer"],
    ])
    expect(added(settled)).toEqual([])
  })

  test("a replay of the conversation arrives whole", () => {
    // What a late joiner is snapshotted from is `entries()`, and a row that is
    // still being said is in it complete — the pieces are an acceleration of a
    // fact this map states anyway.
    const transcript = new Transcript()
    transcript.say("still ")
    transcript.say("going")
    expect(rows(transcript)[0]).toMatchObject({
      kind: "agent",
      text: "still going",
      streaming: true,
    })
  })

  test("the turn ending stops the cursor", () => {
    const transcript = new Transcript()
    transcript.say("done thinking")
    const settled = transcript.settle()

    expect(touched(settled)).toEqual(["agent:1"])
    expect(asKind(rows(transcript)[0], "agent")?.streaming).toBeUndefined()
  })

  test("settling twice says nothing the second time", () => {
    const transcript = new Transcript()
    transcript.say("x")
    transcript.settle()
    expect(transcript.settle()).toEqual(NOTHING)
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
    expect(asKind(rows(transcript)[0], "agent")?.streaming).toBeUndefined()

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
    expect(asKind(rows(transcript)[0], "agent")?.streaming).toBeUndefined()
  })

  test("a replayed message's chunks accumulate the way the agent's do", () => {
    // A replay is the one place a PERSON's words arrive in pieces: a message
    // typed here is written whole, before anything is on the wire, but a
    // conversation being re-opened comes back as however many chunks the agent
    // kept it in. A row per chunk is one sentence drawn as three bubbles down
    // the side of the panel — somebody's own words, taken apart, in the place a
    // reader looks to remember what they asked.
    const transcript = new Transcript()
    transcript.userSaid("what did ")
    transcript.userSaid("we decide?")

    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({ kind: "user", text: "what did we decide?" })
  })

  test("a question and the answer to it are two paragraphs, not one", () => {
    // The KIND is what decides whether the open row is the right one to grow.
    // Nothing closes a paragraph between a person's words and the agent's reply
    // to them, so an agent chunk appended to an open user row would put the
    // answer inside the question.
    const transcript = new Transcript()
    transcript.userSaid("what did we decide?")
    transcript.say("we decided to order the cabinets.")

    expect(rows(transcript).map((entry) => [entry.kind, entry.text])).toEqual([
      ["user", "what did we decide?"],
      ["agent", "we decided to order the cabinets."],
    ])
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

  test("a call's name is picked once, and a later title does not move it", () => {
    // A title is a DISPLAY string and the protocol says no more about it: an
    // agent is free to send the tool's name while the call is being announced,
    // a sentence about what it is doing while it runs, and something else again
    // when it fails. Taking the newest is a row that renames itself twice while
    // somebody reads it — and, for a spawn, a lane that renames itself with it.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "bash", status: "in_progress" })
    transcript.tool("call-1", { title: "waiting for the command", status: "in_progress" })
    transcript.tool("call-1", { title: "bash failed", status: "failed" })

    expect(rows(transcript)[0]).toMatchObject({ text: "bash", status: "failed" })
  })

  test("a call nothing has named yet is named by the frame that names it", () => {
    // The other side of the rule, and the shape a REPLAY has: a finished call
    // arrives as one collapsed report with no announcement in front of it, so
    // the frame that names it is not the first frame about it. "Picked once" is
    // about the first title, not about the first frame — a row left wearing its
    // own call id would be a panel that could not name a conversation's history.
    const transcript = new Transcript()
    transcript.tool("call-1", { status: "in_progress" })
    expect(rows(transcript)[0]?.text).toBe("call-1")

    transcript.tool("call-1", { title: "read the notes", status: "completed" })
    expect(rows(transcript)[0]).toMatchObject({ text: "read the notes", status: "completed" })
  })

  test("a frame repeating one already in says nothing", () => {
    // Agents repeat themselves — some send a report twice, byte for byte — and
    // a repeat is not a second report. Nothing about the call moved, so there
    // is nothing for a subscriber to be told.
    const transcript = new Transcript()
    const move = {
      title: "read the notes",
      status: "completed" as const,
      detail: "{}",
      diffs: [{ path: "notes.md", oldText: "one", newText: "two" }],
      locations: ["notes.md:3"],
      spawned: { kind: "Explore" },
    }
    transcript.tool("call-1", move)
    // A FRESH VALUE with the same words in it, which is what a second frame off
    // the wire is: an identical object would be answered by reference and prove
    // nothing about the comparison this rests on.
    expect(transcript.tool("call-1", structuredClone(move)))
      .toEqual(NOTHING)
    expect(rows(transcript)).toHaveLength(1)
  })

  test("a repeat does not take back the mark its turn left", () => {
    // The half that is not merely quiet. The mark says "as far as this end can
    // tell, that one never came back", and it comes off when the agent reports
    // on the call again — so a repeat of a frame the row already had would put
    // a live face and a running clock back on a call in a conversation that has
    // gone idle, which is the bug the mark exists to prevent.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "a call nobody reported on", status: "in_progress" })
    transcript.settle()
    expect(asKind(rows(transcript)[0], "tool")?.stranded).toBe(true)

    transcript.tool("call-1", { title: "a call nobody reported on", status: "in_progress" })
    expect(asKind(rows(transcript)[0], "tool")?.stranded).toBe(true)
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
    expect(parentOf(rows(transcript)[0])).toBeUndefined()
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
    transcript.tool("toolu_01AGENT", { title: "explore the outline", spawned: {} })
    expect(asKind(rows(transcript)[0], "tool")?.spawned).toEqual({})

    transcript.tool("toolu_01AGENT", { spawned: { kind: "Explore" } })
    expect(rows(transcript)[0]).toMatchObject({
      text: "explore the outline",
      spawned: { kind: "Explore" },
    })
  })

  test("an ordinary call never becomes a spawn", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "completed" })
    expect(asKind(rows(transcript)[0], "tool")?.spawned).toBeUndefined()
  })
})

describe("what a turn leaves behind", () => {
  test("a call still running when the turn ends is marked, status untouched", () => {
    // The agent that would have reported has finished, so nothing will ever
    // report on this call again. What the STATUS says is left exactly as it
    // came — `pending` is the agent's own word and the row is the record of
    // what it said — and what is added is olai's own observation.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "in_progress" })
    transcript.settle()

    expect(rows(transcript)[0]).toMatchObject({ status: "in_progress", stranded: true })
  })

  test("a call that came back is left alone", () => {
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "completed" })
    transcript.tool("call-2", { title: "Read", status: "failed" })
    transcript.settle()

    expect(rows(transcript).map((entry) => asKind(entry, "tool")?.stranded))
      .toEqual([undefined, undefined])
  })

  test("nor is anything that is not a call", () => {
    // `status` is a tool row's field, so every other kind of row is a row this
    // has nothing to say about — and a mark on one would be a claim about a
    // sentence somebody typed.
    const transcript = new Transcript()
    transcript.user("done order")
    transcript.say("looking")
    transcript.settle()

    expect(rows(transcript).map((entry) => asKind(entry, "tool")?.stranded))
      .toEqual([undefined, undefined])
  })

  test("A LATER TURN DOES NOT UNDO IT — which is the whole point", () => {
    // The bug this exists for. A dead agent's rows are deliberately not
    // cleared, so sending again puts a live turn over a transcript full of
    // calls that will never report. A panel asking "is a turn in flight" would
    // light every one of them back up at once; the mark is on the ROW, so it
    // survives the next turn and every turn after it.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "in_progress" })
    transcript.settle()
    transcript.user("try again")
    transcript.begins()
    transcript.tool("call-2", { title: "Read", status: "in_progress" })

    expect(rows(transcript)[0]).toMatchObject({ text: "Grep", stranded: true })
    expect(asKind(rows(transcript)[2], "tool")?.stranded).toBeUndefined()
  })

  test("a turn STARTING says it too, so no path has to have remembered", () => {
    // `settle` normally says this already, at the honest moment. `begins` is
    // the other end of the same turn, and it is what makes "nothing from a
    // previous turn is unstranded under this one" a property rather than a
    // path: a turn that ended some way nobody thought of is still a turn the
    // next one starts after.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "pending" })
    transcript.begins()

    expect(asKind(rows(transcript)[0], "tool")?.stranded).toBe(true)
  })

  test("a call that reports again is running again", () => {
    // The one thing that could make the mark untrue: it means "as far as
    // anything here knows, that one never came back", and a frame about it is
    // anything here knowing.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "in_progress" })
    transcript.settle()
    expect(asKind(rows(transcript)[0], "tool")?.stranded).toBe(true)

    transcript.tool("call-1", { status: "in_progress", progress: "halfway" })
    expect(asKind(rows(transcript)[0], "tool")?.stranded).toBeUndefined()
  })

  test("marking is said once, not once per turn", () => {
    // This runs at both ends of every turn. A frame per idle call per turn
    // would be a conversation republishing its whole history to say nothing.
    const transcript = new Transcript()
    transcript.tool("call-1", { title: "Grep", status: "in_progress" })
    expect(touched(transcript.settle())).toEqual(["tool:call-1"])
    expect(touched(transcript.begins())).toEqual([])
    expect(touched(transcript.settle())).toEqual([])
  })
})

describe("when a row arrived", () => {
  /** A clock that says what it is told to, so a stamp is a value rather than
   *  something asserted by comparing it with itself. */
  const clock = (from: string) => {
    let at = Date.parse(from)
    return { now: () => at, pass: (ms: number) => { at += ms } }
  }

  test("a row is stamped with the instant it first appeared", () => {
    const time = clock("2026-08-21T12:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.tool("call-1", { title: "Grep", status: "pending" })
    expect(rows(transcript)[0]?.since).toBe("2026-08-21T12:00:00.000Z")
  })

  test("... and keeps it, however many times the call reports again", () => {
    // The rule this stamp exists for. A long call reports itself several times
    // while it runs — content, locations, a status — and every one of those
    // comes through the same writer, so a re-stamp would reset the duration on
    // exactly the frames somebody is watching it grow.
    const time = clock("2026-08-21T12:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.tool("call-1", { title: "Grep", status: "pending" })
    time.pass(30_000)
    transcript.tool("call-1", { status: "in_progress", progress: "halfway" })
    time.pass(30_000)
    transcript.tool("call-1", { status: "completed" })

    expect(rows(transcript)[0]?.since).toBe("2026-08-21T12:00:00.000Z")
  })

  test("a row cannot be handed one: the writer decides, like `seq`", () => {
    // `since` is off `RowContent` for the reason `seq` and `streaming` are —
    // every re-publish goes through a spread of the row as it stands, and a
    // field a caller could set is a field a caller could set WRONG once and
    // then carry forward forever.
    //
    // The TYPE is the first line of that: no door here takes a field the writer
    // derives, so the cast below is what somebody would have to write to get
    // past it. The derivation is the second line, and this is the test of it —
    // handed one anyway, the writer's own stamp is what lands.
    const time = clock("2026-08-21T12:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.user("hello", { since: "1999-01-01T00:00:00.000Z" } as never)
    expect(rows(transcript)[0]?.since).toBe("2026-08-21T12:00:00.000Z")
  })

  test("the row a person typed is stamped too — one rule, not a tool's", () => {
    // It is minted beside `seq`, by the one writer, for every kind of row. A
    // stamp that existed only for the rows the elapsed readout happens to draw
    // would be the row minter knowing about a face.
    const time = clock("2026-08-21T12:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.say("thinking")
    time.pass(1_000)
    transcript.add("notice", "the agent stopped")

    expect(rows(transcript).map((entry) => entry.since)).toEqual([
      "2026-08-21T12:00:00.000Z",
      "2026-08-21T12:00:01.000Z",
    ])
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
    transcript.ask("ask:1", "Shall I?", fields, undefined)
    const settled = transcript.settleAsk("ask:1", {
      how: "answered",
      answers: [{ key: "question_0", values: ["yes"] }],
    })

    expect(touched(settled)).toEqual(["ask:1"])
    expect(rows(transcript)).toHaveLength(1)
    expect(rows(transcript)[0]).toMatchObject({ kind: "ask", text: "Shall I?" })
    expect(asKind(rows(transcript)[0], "ask")?.ask).toEqual({
      fields,
      outcome: { how: "answered", answers: [{ key: "question_0", values: ["yes"] }] },
    })
  })

  test("a question closes the paragraph the agent was writing", () => {
    const transcript = new Transcript()
    transcript.say("I need to know something")
    const change = transcript.ask("ask:1", "Shall I?", fields, undefined)

    expect(touched(change)).toEqual(["agent:1", "ask:1"])
    expect(asKind(rows(transcript)[0], "agent")?.streaming).toBeUndefined()
  })

  test("a subagent's question lands in that subagent's lane", () => {
    // The row a person is about to act on. Drawn in the main column it says
    // the MAIN agent is asking, which is the one thing about a permission form
    // that cannot be wrong — and it names the `Agent` frame's own key, the
    // same shape a tool call the subagent made names it by, so the panel looks
    // one row up rather than mapping an id onto one.
    const transcript = new Transcript()
    transcript.tool("toolu_01AGENT", { title: "explore the outline" })
    transcript.ask("ask:1", "Allow `Bash`?", fields, "toolu_01AGENT")

    expect(rows(transcript)[1]).toMatchObject({
      kind: "ask",
      parent: "tool:toolu_01AGENT",
    })
    expect(transcript.entries().get("tool:toolu_01AGENT")).toBeDefined()
  })

  test("the main agent's own questions are in nobody's lane", () => {
    const transcript = new Transcript()
    transcript.ask("ask:1", "Shall I?", fields, undefined)
    expect(parentOf(rows(transcript)[0])).toBeUndefined()
  })

  test("answering a subagent's question leaves it in that subagent's lane", () => {
    // The row is REWRITTEN when it settles rather than patched, so this is the
    // one place the attribution could be dropped — and it would be dropped at
    // the moment the row becomes the record of a decision somebody made.
    const transcript = new Transcript()
    transcript.ask("ask:1", "Allow `Bash`?", fields, "toolu_01AGENT")
    transcript.settleAsk("ask:1", {
      how: "answered",
      answers: [{ key: "question_0", values: ["yes"] }],
    })

    expect(rows(transcript)[0]).toMatchObject({ parent: "tool:toolu_01AGENT" })
  })

  test("a subagent's question does not break the run of its own work", () => {
    // THE VISIBLE HALF of the same bug. An unattributed form landing between
    // two of one subagent's calls is a row in no lane, which ENDS the stretch
    // — so the lane re-opens and introduces itself again underneath the form,
    // saying a second agent started where there was only ever one. The
    // transcript's half of that is that all three rows name the same lane;
    // what the panel then draws is `lanes.ts`'s.
    const transcript = new Transcript()
    transcript.tool("toolu_01AGENT", { title: "explore the outline" })
    transcript.tool("call-1", { title: "Grep", parent: "toolu_01AGENT" })
    transcript.ask("ask:1", "Allow `Bash`?", fields, "toolu_01AGENT")
    transcript.tool("call-2", { title: "Bash", parent: "toolu_01AGENT" })

    expect(rows(transcript).slice(1).map(parentOf)).toEqual([
      "tool:toolu_01AGENT",
      "tool:toolu_01AGENT",
      "tool:toolu_01AGENT",
    ])
  })

  test("settling one that is no longer there says nothing", () => {
    // A session replaced under a pending question empties the transcript before
    // the withdrawal arrives; minting a row here would put a dead question at
    // the top of a fresh conversation.
    const transcript = new Transcript()
    transcript.ask("ask:1", "Shall I?", fields, undefined)
    transcript.clear()

    expect(transcript.settleAsk("ask:1", { how: "withdrawn", answers: [] }))
      .toEqual(NOTHING)
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
    expect(asKind(rows(transcript)[0], "user")?.delivery).toBeUndefined()
    expect(rows(transcript)[0]?.text).toBe("done order")
    // ... and nothing is left to retry it with, so a second click is refused
    // rather than sending the message twice.
    expect(transcript.undelivered(row.key)).toBeNull()
  })

  test("marking a row a replaced session took away keeps neither half", () => {
    const transcript = new Transcript()
    const row = transcript.user("done order")
    transcript.clear()

    expect(transcript.refused(row.key, "done order")).toEqual(NOTHING)
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

    expect(asKind(rows(transcript)[0], "user")?.delivery).toBe("unanswered")
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
    expect(asKind(entry, "refusal")?.refusal).toBe(failure)
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
