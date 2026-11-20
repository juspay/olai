import { describe, expect, test } from "bun:test"

import type { ChatEntry, ToolEntry } from "olai-plugin-chat/wire"
import type { Watching } from "@kolu/acp/wire"
import { armedTask, sentAgent } from "./outings.testlib.ts"
import { clock } from "./clock.testlib.ts"
import { Transcript, toolKey } from "@kolu/acp-harness"
import { sameWatching, watching } from "./watching.ts"

const SINCE = "2026-08-27T09:00:00.000Z"
const LATER = "2026-08-27T09:31:00.000Z"

const call = (
  key: string,
  over: Partial<ToolEntry> = {},
): readonly [string, ChatEntry] => [
  key,
  { id: key, seq: 1, since: SINCE, kind: "tool", text: "Agent", status: "pending", ...over },
]

const rows = (
  ...entries: ReadonlyArray<readonly [string, ChatEntry]>
): ReadonlyMap<string, ChatEntry> => new Map(entries)

describe("what is still out", () => {
  test("a spawn that has not come back is one entry, an agent, called what its row is called", () => {
    expect(watching(rows(call("tool:7", { text: "audit the pins", spawned: sentAgent() })))).toEqual([
      { row: "tool:7", kind: "agent", name: "audit the pins", since: SINCE },
    ])
  })

  test("an armed task is one entry, a task, called by the description it was armed with", () => {
    expect(
      watching(rows(call("tool:1", {
        text: "Monitor",
        armed: armedTask({ task: "task-9", description: "kolu fleet watch" }),
      }))),
    ).toEqual([{ row: "tool:1", kind: "task", name: "kolu fleet watch", since: SINCE }])
  })

  test("... and by the call's own title when it was armed with none", () => {
    expect(
      watching(rows(call("tool:1", { text: "Monitor", armed: armedTask({ task: "task-9" }) }))),
    ).toEqual([{ row: "tool:1", kind: "task", name: "Monitor", since: SINCE }])
  })

  test("a call that is both a spawn and an armed task is on the strip ONCE, as the agent", () => {
    const out = watching(rows(call("tool:2", {
      text: "hunt the leak",
      spawned: sentAgent({ kind: "Explore" }),
      armed: armedTask({ task: "task-3", description: "hunt the leak (background)" }),
    })))
    expect(out).toEqual([
      { row: "tool:2", kind: "agent", name: "hunt the leak", since: SINCE },
    ])
  })

  test("a STRANDED spawn is on neither list", () => {
    expect(watching(rows(call("tool:2", { spawned: sentAgent(), stranded: true })))).toEqual([])
    expect(
      watching(rows(call("tool:2", {
        spawned: sentAgent(),
        armed: armedTask({ task: "task-3", description: "hunt the leak" }),
        stranded: true,
      }))),
    ).toEqual([])
  })

  test("a spawn whose call has come back is off the list, completed or failed", () => {
    expect(watching(rows(call("tool:2", { spawned: sentAgent(), status: "completed" })))).toEqual([])
    expect(watching(rows(call("tool:2", { spawned: sentAgent(), status: "failed" })))).toEqual([])
  })

  test("a spawn SENT OUT AGAIN is back on it, and it is still one entry", () => {
    expect(
      watching(rows(call("tool:2", {
        text: "author the PR",
        spawned: sentAgent(),
        status: "in_progress",
        resumed: LATER,
      }))),
    ).toEqual([{ row: "tool:2", kind: "agent", name: "author the PR", since: LATER }])
  })

  test("a stamp on a call that is OVER dates from the row, not the last outing", () => {
    expect(
      watching(rows(
        call("tool:2", { spawned: sentAgent(), status: "completed", resumed: LATER }),
        call("tool:3", { spawned: sentAgent(), status: "in_progress", resumed: LATER }),
      )),
    ).toEqual([{ row: "tool:3", kind: "agent", name: "Agent", since: LATER }])
  })

  test("a resumed spawn that has come back AGAIN is off the list again", () => {
    expect(
      watching(rows(call("tool:2", { spawned: sentAgent(), status: "completed", resumed: LATER }))),
    ).toEqual([])
  })

  test("a task the harness has told us the end of is off the list", () => {
    expect(
      watching(rows(call("tool:1", {
        status: "completed",
        armed: armedTask({ task: "task-9", description: "tick watch", ended: "killed" }),
      }))),
    ).toEqual([])
  })

  test("a call that spawned nobody and armed nothing contributes nothing", () => {
    expect(watching(rows(call("tool:1", { text: "Bash", status: "in_progress" })))).toEqual([])
  })

  test("a row that is not a call is not on the strip at all", () => {
    const prose: readonly [string, ChatEntry] = [
      "agent:1",
      { id: "agent:1", seq: 2, since: SINCE, kind: "agent", text: "spawning four" },
    ]
    expect(watching(rows(prose, call("tool:2", { spawned: sentAgent() })))).toEqual([
      { row: "tool:2", kind: "agent", name: "Agent", since: SINCE },
    ])
  })

  test("a fan-out is every one of them, in the order the calls were announced", () => {
    expect(
      watching(rows(
        call("tool:1", { text: "read the web", spawned: sentAgent() }),
        call("tool:2", { text: "Monitor", since: LATER, armed: armedTask({ task: "task-9" }) }),
        call("tool:3", { text: "read the server", since: LATER, spawned: sentAgent() }),
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
    expect(sameWatching([{ ...agent }], [{ ...agent }])).toBe(true)
    expect(sameWatching([], [])).toBe(true)
  })

  test("a list whose only difference is the KIND is NOT the same list", () => {
    expect(sameWatching([{ ...agent, kind: "task" }], [agent])).toBe(false)
  })

  test("a row, a name or a stamp that has changed is news", () => {
    expect(sameWatching([{ ...agent, row: "tool:3" }], [agent])).toBe(false)
    expect(sameWatching([{ ...agent, name: "read the web" }], [agent])).toBe(false)
    expect(sameWatching([{ ...agent, since: LATER }], [agent])).toBe(false)
  })

  test("one more out, or one fewer, has moved", () => {
    expect(sameWatching([agent], [])).toBe(false)
    expect(sameWatching([], [agent])).toBe(false)
  })
})

describe("out, back, out again", () => {
  const strip = (transcript: Transcript<ChatEntry>): ReadonlyArray<string> =>
    watching(transcript.entries()).map((one) => `${one.kind} ${one.name} since ${one.since}`)

  test("the strip carries an agent, loses it, and carries it AGAIN", () => {
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript<ChatEntry>({ now: time.now, firstSeq: "zero" })

    transcript.tool("toolu_01AGENT", {
      title: "Task",
      status: "pending",
      spawned: { kind: "general-purpose", said: "author the PR" },
    })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T09:00:00.000Z"])

    time.pass(20 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "completed" })
    expect(strip(transcript)).toEqual([])

    time.pass(60 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T10:20:00.000Z"])

    transcript.tool("toolu_01CALL", {
      title: "run the tests",
      status: "in_progress",
      parent: toolKey("toolu_01AGENT"),
    })
    expect(
      [...transcript.entries().values()].filter((row) =>
        row.kind === "tool" && row.parent === "tool:toolu_01AGENT"
      ),
    ).toHaveLength(1)

    transcript.tool("toolu_01CALL", { status: "completed" })
    transcript.tool("toolu_01AGENT", { status: "completed" })
    expect(strip(transcript)).toEqual([])

    time.pass(60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toEqual(["agent author the PR since 2026-08-28T10:21:00.000Z"])
  })

  test("AN ASYNC agent, resumed, survives the turn boundary its task always did", () => {
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript<ChatEntry>({ now: time.now, firstSeq: "zero" })
    transcript.tool("toolu_01AGENT", {
      title: "Task",
      status: "in_progress",
      spawned: sentAgent({ said: "audit the pins" }),
      armed: armedTask({ task: "bu13xz2ie" }),
    })
    transcript.tool("toolu_01AGENT", {
      status: "completed",
      armed: armedTask({ task: "bu13xz2ie", ended: "completed" }),
    })
    expect(strip(transcript)).toEqual([])

    time.pass(60 * 60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    transcript.settle()
    expect(strip(transcript)).toEqual(["agent audit the pins since 2026-08-28T10:00:00.000Z"])
  })

  test("a turn that ends under a resumed agent takes the face off, as ever", () => {
    const time = clock("2026-08-28T09:00:00.000Z")
    const transcript = new Transcript<ChatEntry>({ now: time.now, firstSeq: "zero" })
    transcript.tool("toolu_01AGENT", { title: "Task", status: "pending", spawned: sentAgent() })
    transcript.tool("toolu_01AGENT", { status: "completed" })
    time.pass(60_000)
    transcript.tool("toolu_01AGENT", { status: "in_progress" })
    expect(strip(transcript)).toHaveLength(1)

    transcript.settle()
    expect(strip(transcript)).toEqual([])
  })
})
