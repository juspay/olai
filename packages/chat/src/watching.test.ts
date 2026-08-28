/**
 * The strip's list, over values.
 *
 * ROUTE TAKEN, and why: this is {@link ./watching.ts} rather than a chat driven
 * the way {@link ./lifecycle.test.ts} drives one. The projection used to live
 * inside `make()`'s closure, and every fact below would have cost a subprocess,
 * a hand-shake and a scripted agent talked into a fan-out — for facts that are
 * entirely about ROWS. Worse, the interesting halves are unreachable from out
 * there at all: a STRANDED spawn is written by a turn ending, and asking a
 * fixture agent to announce a spawn and then walk away from it is an
 * arrangement of somebody else's script rather than an assertion about this
 * rule. So the projection came out into a module of its own, `chat.ts` calls
 * it, and the rules are asked here the way {@link ./turns.ts}' and
 * {@link ./calls.ts}' are.
 *
 * WHAT EACH TEST IS ABOUT is a way the strip lies. A strip is a live face with
 * a clock on it and a door behind it: an entry that should not be there is a
 * duration ticking in every open tab for something that has stopped, and a
 * missing entry is a fan-out nobody can reach the calls of, since a subagent's
 * calls are no longer in the transcript's column at all.
 */

import { describe, expect, test } from "bun:test"

import type { ChatEntry, ToolEntry, Watching } from "@olai/surface"

import { Transcript } from "./transcript.ts"
import { sameWatching, watching } from "./watching.ts"

/** When a row was announced. The strip's clock counts from it, so it is the
 *  one field a test can tell two otherwise identical entries apart by. */
const SINCE = "2026-08-27T09:00:00.000Z"
const LATER = "2026-08-27T09:31:00.000Z"

/** One tool row under its transcript key, announced `pending` — which is what
 *  the writer stamps on a call nothing has reported on yet, and which means
 *  "still out" rather than "not started". Everything a test is about is said
 *  in `over`. */
const call = (
  key: string,
  over: Partial<ToolEntry> = {},
): readonly [string, ChatEntry] => [
  key,
  { id: key, seq: 1, since: SINCE, kind: "tool", text: "Agent", status: "pending", ...over },
]

/** The transcript's rows, in the order they were announced. */
const rows = (
  ...entries: ReadonlyArray<readonly [string, ChatEntry]>
): ReadonlyMap<string, ChatEntry> => new Map(entries)

describe("what is still out", () => {
  test("a spawn that has not come back is one entry, an agent, called what its row is called", () => {
    // The row's own title and no fallback: a spawn's title IS the description
    // it was sent with, so the strip and the record read as one thing. A
    // fallback here would be a second string for the same call.
    expect(watching(rows(call("tool:7", { text: "audit the pins", spawned: {} })))).toEqual([
      { row: "tool:7", kind: "agent", name: "audit the pins", since: SINCE },
    ])
  })

  test("an armed task is one entry, a task, called by the description it was armed with", () => {
    // `Monitor` is what the call is called and not what the task is. A strip
    // drawn by the title puts four rows saying `Monitor` in front of somebody
    // watching four different things.
    expect(
      watching(rows(call("tool:1", {
        text: "Monitor",
        armed: { task: "task-9", description: "kolu fleet watch" },
      }))),
    ).toEqual([{ row: "tool:1", kind: "task", name: "kolu fleet watch", since: SINCE }])
  })

  test("... and by the call's own title when it was armed with none", () => {
    // Naming a task is optional in the tool that arms one, and a `Monitor`
    // reads better on a strip than a blank does.
    expect(
      watching(rows(call("tool:1", { text: "Monitor", armed: { task: "task-9" } }))),
    ).toEqual([{ row: "tool:1", kind: "task", name: "Monitor", since: SINCE }])
  })

  test("a call that is both a spawn and an armed task is on the strip ONCE, as the agent", () => {
    // What an asynchronous `Agent` launch is: it registers a harness task as
    // well as sending somebody out. Written as two `if`s this row is on the
    // strip twice — the same agent, once with a door behind it and once
    // without — and the precedence is the surface's, so the strip entry and
    // the rail under the row cannot disagree about what kind of thing it is.
    const out = watching(rows(call("tool:2", {
      text: "hunt the leak",
      spawned: { kind: "Explore" },
      armed: { task: "task-3", description: "hunt the leak (background)" },
    })))
    expect(out).toEqual([
      { row: "tool:2", kind: "agent", name: "hunt the leak", since: SINCE },
    ])
  })

  test("a STRANDED spawn is on neither list", () => {
    // The ending nothing reports: an agent that died mid-fan-out never
    // completes the `Agent` calls it left open, so the status stays `pending`
    // for as long as the panel is up. What takes it off is the turn's own
    // observation that it walked away. Left on, a dead subagent keeps a rail
    // lit and the panel's clock ticking forever.
    expect(watching(rows(call("tool:2", { spawned: {}, stranded: true })))).toEqual([])
    // ... and the task it armed does not resurrect it on the way past: the
    // agent test failing is not a licence for the second branch to answer.
    expect(
      watching(rows(call("tool:2", {
        spawned: {},
        armed: { task: "task-3", description: "hunt the leak" },
        stranded: true,
      }))),
    ).toEqual([])
  })

  test("a spawn whose call has come back is off the list, completed or failed", () => {
    expect(watching(rows(call("tool:2", { spawned: {}, status: "completed" })))).toEqual([])
    expect(watching(rows(call("tool:2", { spawned: {}, status: "failed" })))).toEqual([])
  })

  test("a spawn SENT OUT AGAIN is back on it, and it is still one entry", () => {
    // The bug this rule was rewritten for (the human, 2026-08-28): a subagent
    // that had reported was sent more work, ran for twenty minutes, and the
    // strip said nothing at all — a running agent with no face anywhere in the
    // panel. The membership rule never had to change: the adapter reopens the
    // call that SPAWNED the agent when the harness starts its task again
    // (`acp/patches/README.md`), so the row is running again and this reads it
    // running again. What matters here is that it is the SAME row — one agent,
    // one entry, one door — rather than a second entry beside the first.
    expect(
      watching(rows(call("tool:2", {
        text: "author the PR",
        spawned: {},
        status: "in_progress",
        resumed: LATER,
      }))),
    ).toEqual([{ row: "tool:2", kind: "agent", name: "author the PR", since: LATER }])
  })

  test("... and its clock counts from the resume, never from the row's birth", () => {
    // The half a re-armed entry would otherwise get wrong out loud. The row was
    // born when the agent was FIRST sent out — the record starts there and must
    // — so a strip drawn off `since` would meet somebody watching a minute-old
    // resume with *running for 3h 12m*. {@link @olai/surface}'s `outSince` is
    // the one rule, and the row's own readout asks it too.
    const [entry] = watching(rows(call("tool:2", { spawned: {}, resumed: LATER })))
    expect(entry?.since).toBe(LATER)
    expect(entry?.since).not.toBe(SINCE)
  })

  test("a resumed spawn that has come back AGAIN is off the list again", () => {
    // The second outing ends the way the first did, and the stamp that says the
    // row has been round twice is not a licence to stay: what decides membership
    // is the status, and `resumed` only says what a clock counts from.
    expect(
      watching(rows(call("tool:2", { spawned: {}, status: "completed", resumed: LATER }))),
    ).toEqual([])
  })

  test("a task the harness has told us the end of is off the list", () => {
    // The ordinary way a task stops being out, and the one a status cannot
    // say: the call completed the moment the task was armed.
    expect(
      watching(rows(call("tool:1", {
        status: "completed",
        armed: { task: "task-9", description: "tick watch", ended: "killed" },
      }))),
    ).toEqual([])
  })

  test("a call that spawned nobody and armed nothing contributes nothing", () => {
    // Nearly every call. A strip that carried them would be the transcript
    // again, above the transcript.
    expect(watching(rows(call("tool:1", { text: "Bash", status: "in_progress" })))).toEqual([])
  })

  test("a row that is not a call is not on the strip at all", () => {
    // The agent's prose has a `text` and a `since` and no status: read as a
    // call it is an entry with nothing behind its door.
    const prose: readonly [string, ChatEntry] = [
      "agent:1",
      { id: "agent:1", seq: 2, since: SINCE, kind: "agent", text: "spawning four" },
    ]
    expect(watching(rows(prose, call("tool:2", { spawned: {} })))).toEqual([
      { row: "tool:2", kind: "agent", name: "Agent", since: SINCE },
    ])
  })

  test("a fan-out is every one of them, in the order the calls were announced", () => {
    // What the strip is FOR: five agents out at once, read at the bottom of
    // the transcript where the reader is, each addressed by the key its own
    // calls name as their parent.
    expect(
      watching(rows(
        call("tool:1", { text: "read the web", spawned: {} }),
        call("tool:2", { text: "Monitor", since: LATER, armed: { task: "task-9" } }),
        call("tool:3", { text: "read the server", since: LATER, spawned: {} }),
      )),
    ).toEqual([
      { row: "tool:1", kind: "agent", name: "read the web", since: SINCE },
      { row: "tool:2", kind: "task", name: "Monitor", since: LATER },
      { row: "tool:3", kind: "agent", name: "read the server", since: LATER },
    ])
  })

  test("nothing out is an empty strip, not an absence", () => {
    expect(watching(rows())).toEqual([])
  })
})

describe("whether the strip has moved", () => {
  const agent: Watching = { row: "tool:2", kind: "agent", name: "hunt the leak", since: SINCE }

  test("the same list, field for field, is the same list", () => {
    // Built fresh on every read — deliberately, so it cannot drift from the
    // rows a person is reading — so a reference test would answer "moved"
    // every time and put the whole cell on every open socket once per tool
    // frame.
    expect(sameWatching([{ ...agent }], [{ ...agent }])).toBe(true)
    expect(sameWatching([], [])).toBe(true)
  })

  test("a list whose only difference is the KIND is NOT the same list", () => {
    // The field that arrived with the strip's second sort. Uncompared, a row
    // that turns from a task into an agent — an asynchronous launch whose
    // spawn is announced on a later frame — never reaches a browser: the cell
    // stops republishing and the strip goes on offering no door to the agent
    // it is already naming.
    expect(sameWatching([{ ...agent, kind: "task" }], [agent])).toBe(false)
  })

  test("a row, a name or a stamp that has changed is news", () => {
    expect(sameWatching([{ ...agent, row: "tool:3" }], [agent])).toBe(false)
    expect(sameWatching([{ ...agent, name: "read the web" }], [agent])).toBe(false)
    expect(sameWatching([{ ...agent, since: LATER }], [agent])).toBe(false)
  })

  test("one more out, or one fewer, has moved", () => {
    // The two endings that matter most to a reader: the fan-out starting, and
    // the last of them coming home.
    expect(sameWatching([agent], [])).toBe(false)
    expect(sameWatching([], [agent])).toBe(false)
  })
})

/**
 * ... AND THE WHOLE LIFE OF ONE AGENT, through the writer that stamps the rows
 * this reads.
 *
 * The one test here that is not over hand-built values, and it is the one the
 * human's bug asks for. Both halves of that bug passed their own tests: the
 * projection read `spawned + still running` correctly, and the transcript
 * updated a call in place correctly — what nothing anywhere asserted was the
 * SEQUENCE, and the sequence is where a resumed agent went missing. So this
 * drives the transcript with the frames the patched adapter really sends
 * (`acp/patches/README.md`, measured through `packages/tests/tasks.ts`) and
 * reads the strip after each one.
 *
 * Still no subprocess, no socket and no browser: a Transcript is a data
 * structure and this is the projection over it.
 */
describe("out, back, out again", () => {
  const clock = (from: string) => {
    let at = Date.parse(from)
    return { now: () => at, pass: (ms: number) => { at += ms } }
  }
  /** The strip as a reader would read it: what it says, in order. */
  const strip = (transcript: Transcript): ReadonlyArray<string> =>
    watching(transcript.entries()).map((one) => `${one.kind} ${one.name} since ${one.since}`)

  test("the strip carries an agent, loses it, and carries it AGAIN", () => {
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript(time.now)

    // SENT OUT — the adapter announces the `Agent` tool use, titled with the
    // tool's own name and carrying the description in its arguments.
    transcript.tool("toolu_01AGENT", {
      title: "Task",
      status: "pending",
      spawned: { kind: "general-purpose", said: "author the PR" },
    })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T09:00:00.000Z"])

    // ... AND REPORTED, twenty minutes later. The strip goes quiet: the record
    // is not gone, it is on the row where it happened, behind that row's door.
    time.pass(20 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "completed" })
    expect(strip(transcript)).toEqual([])

    // ... AND SENT MORE WORK, an hour after that. The harness starts the same
    // task again, the adapter reopens the call that spawned the agent, and the
    // face comes back — with a clock counting from the resume rather than from
    // this morning.
    time.pass(60 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T10:20:00.000Z"])

    // ... and its work still files under the SAME row, which is what makes one
    // agent one door rather than two.
    transcript.tool("toolu_01CALL", {
      title: "run the tests",
      status: "in_progress",
      parent: "toolu_01AGENT",
    })
    expect(
      [...transcript.entries().values()].filter((row) =>
        row.kind === "tool" && row.parent === "tool:toolu_01AGENT"
      ),
    ).toHaveLength(1)

    // ... AND QUIET AGAIN when the second outing ends, by the same rule that
    // took it off the first time. Nothing anywhere remembers this agent having
    // been on the strip, which is the property that makes a third outing draw a
    // third face: there is no dismissal to leak, because there is nothing that
    // dismisses one (the human, 2026-08-28: get rid of the ×).
    transcript.tool("toolu_01CALL", { status: "completed" })
    transcript.tool("toolu_01AGENT", { status: "completed" })
    expect(strip(transcript)).toEqual([])

    // ... and ONCE MORE, to say that in the only way worth saying it.
    time.pass(60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T10:21:00.000Z"])
  })

  test("AN ASYNC agent, resumed, survives the turn boundary its task always did", () => {
    // The same life as above for the launch that ARMS a harness task, which is
    // where the strip had a second hole: the ending the harness reported for
    // the FIRST outing is what exempts a call from stranding, so a row still
    // carrying it loses its face at the next `settle()` — the strip going
    // quiet under a working agent all over again, this time in a turn boundary
    // rather than in the wire.
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.tool("toolu_01AGENT", {
      title: "Task",
      status: "in_progress",
      spawned: { said: "audit the pins" },
      armed: { task: "bu13xz2ie" },
    })
    transcript.tool("toolu_01AGENT", {
      status: "completed",
      armed: { task: "bu13xz2ie", ended: "completed" },
    })
    expect(strip(transcript)).toEqual([])

    time.pass(60 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    transcript.settle()
    expect(strip(transcript)).toEqual(["agent audit the pins since 2026-08-28T10:00:00.000Z"])
  })

  test("a turn that ends under a resumed agent takes the face off, as ever", () => {
    // The stranding rule is untouched by any of this, and it must be: an agent
    // whose turn walked away from it is over whichever outing it was on, and a
    // face that outlived one is the failure the whole strip is written against.
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript(time.now)
    transcript.tool("toolu_01AGENT", { title: "Task", status: "pending", spawned: {} })
    transcript.tool("toolu_01AGENT", { status: "completed" })
    time.pass(60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toHaveLength(1)

    transcript.settle()
    expect(strip(transcript)).toEqual([])
  })
})
