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
