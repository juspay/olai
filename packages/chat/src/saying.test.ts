/**
 * The cadence, over values — no server, no socket, and a clock that is turned
 * by hand.
 *
 * What is under test is the whole of what {@link ./saying.ts} decides: which
 * pieces are merged with which, what a window costs in frames, and what a row
 * does to the pieces of itself. Every one of those is a claim about frames, so
 * every test here reads the frames.
 */

import { sayingKey } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { type After, cadence, type Frame } from "./saying.ts"
import type { Change } from "./transcript.ts"

/** A clock somebody turns. `run()` fires the open window; `open` says whether
 *  there is one, which is how a test asserts that nothing is waiting. */
const byHand = (): { readonly after: After; readonly turn: () => void; readonly open: () => boolean } => {
  let pending: (() => void) | null = null
  return {
    after: (_millis, run) => {
      pending = run
      return () => {
        pending = null
      }
    },
    turn: () => {
      const run = pending
      pending = null
      run?.()
    },
    open: () => pending !== null,
  }
}

const appending = (of: string, at: number, text: string): Change => ({
  upserts: [],
  removes: [],
  appends: [{ of, at, text }],
})

const row = (key: string, text: string): Change => ({
  upserts: [[key, { kind: "agent", id: key, seq: 0, since: "2026-08-22T00:00:00.000Z", text }]],
  removes: [],
  appends: [],
})

/** The frames a run produced, and the two readings every test here takes off
 *  them: what went onto the pieces member, and what came off it. */
const driven = () => {
  const frames: Array<Frame> = []
  const clock = byHand()
  const wire = cadence({ onFrame: (frame) => frames.push(frame), after: clock.after })
  return {
    wire,
    clock,
    frames: () => frames,
    /** Every piece published, as `<key>:<text>` — the wire's own units. */
    pieces: () =>
      frames.flatMap((frame) => frame.pieces.upserts.map(([key, piece]) => `${key}:${piece.text}`)),
    removed: () => frames.flatMap((frame) => [...frame.pieces.removes]),
  }
}

describe("a window", () => {
  test("many chunks of one row leave as one piece, in one frame", () => {
    const run = driven()
    for (let chunk = 0; chunk < 100; chunk++) {
      run.wire.publish(appending("agent:1", chunk, "x"))
    }
    // Nothing yet: the window is trailing, so a hundred chunks inside one are
    // a hundred nothings.
    expect(run.frames()).toHaveLength(0)
    run.clock.turn()

    expect(run.frames()).toHaveLength(1)
    expect(run.pieces()).toEqual(["agent:1#0:" + "x".repeat(100)])
  })

  test("the piece a window sends starts where the last one ended", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "one "))
    run.clock.turn()
    run.wire.publish(appending("agent:1", 4, "two"))
    run.clock.turn()

    expect(run.pieces()).toEqual(["agent:1#0:one ", "agent:1#4:two"])
    // Contiguous, which is what lets a reader join them without a protocol:
    // every character of the row is in exactly one piece.
    expect(run.frames().flatMap((frame) => frame.pieces.upserts.map(([, piece]) => piece.text))
      .join("")).toBe("one two")
  })

  test("a piece that is not contiguous does not swallow the one before it", () => {
    // One writer, ordered, so this cannot arise from the transcript — but a
    // merge that assumed contiguity rather than checking it would silently
    // publish a piece under a key that says the wrong offset, which is a hole
    // in somebody's paragraph rather than an error anybody sees.
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "one"))
    run.wire.publish(appending("agent:1", 99, "far"))

    expect(run.pieces()).toEqual(["agent:1#0:one"])
    run.clock.turn()
    expect(run.pieces()).toEqual(["agent:1#0:one", "agent:1#99:far"])
  })

  test("a piece of another row sends the held one rather than displacing it", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "first"))
    run.wire.publish(appending("agent:2", 0, "second"))

    expect(run.pieces()).toEqual(["agent:1#0:first"])
    run.clock.turn()
    expect(run.pieces()).toEqual(["agent:1#0:first", "agent:2#0:second"])
  })

  test("nothing waits once the window has closed", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "hi"))
    expect(run.clock.open()).toBe(true)
    run.clock.turn()
    expect(run.clock.open()).toBe(false)
  })
})

describe("a row supersedes its pieces", () => {
  test("the row's own publication takes them off the wire, in the same frame", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "half "))
    run.clock.turn()
    expect([...run.wire.onWire().keys()]).toEqual(["agent:1#0"])

    run.wire.publish(row("agent:1", "half an answer"))
    const last = run.frames().at(-1)
    // The row and the removal are one frame, and the row is in it whole — so a
    // reader never holds a paragraph that got shorter.
    expect(last?.rows.upserts.map(([, entry]) => entry.text)).toEqual(["half an answer"])
    expect(last?.pieces.removes).toEqual(["agent:1#0"])
    expect(run.wire.onWire().size).toBe(0)
  })

  test("a piece still waiting is dropped rather than sent after the row", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "still typ"))
    run.wire.publish(row("agent:1", "still typing"))

    expect(run.pieces()).toEqual([])
    expect(run.clock.open()).toBe(false)
    run.clock.turn()
    expect(run.pieces()).toEqual([])
  })

  test("a row that is REMOVED takes its pieces with it", () => {
    // A new conversation empties the transcript; the pieces of whatever was
    // being said belong to a row that is not there any more.
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "gone"))
    run.clock.turn()
    run.wire.publish({ upserts: [], removes: ["agent:1"], appends: [] })

    expect(run.removed()).toEqual(["agent:1#0"])
    expect(run.wire.onWire().size).toBe(0)
  })

  test("another row's publication leaves the pieces alone", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "mine"))
    run.clock.turn()
    run.wire.publish(row("tool:call-1", "search_nodes"))

    expect(run.removed()).toEqual([])
    expect([...run.wire.onWire().keys()]).toEqual(["agent:1#0"])
  })
})

describe("what a subscriber is handed", () => {
  test("only what was published — never the piece still waiting", () => {
    const run = driven()
    run.wire.publish(appending("agent:1", 0, "out"))
    run.clock.turn()
    run.wire.publish(appending("agent:1", 3, "waiting"))

    expect([...run.wire.onWire().values()]).toEqual([{ of: "agent:1", at: 0, text: "out" }])
  })

  test("filed under the key both ends derive from the piece", () => {
    const run = driven()
    run.wire.publish(appending("agent:7", 12, "…"))
    run.clock.turn()
    const [key, piece] = [...run.wire.onWire()][0] ?? []
    expect(piece).toBeDefined()
    expect(key).toBe(sayingKey(piece as { of: string; at: number }))
  })
})

test("a change with nothing in it publishes nothing", () => {
  const run = driven()
  run.wire.publish({ upserts: [], removes: [], appends: [] })
  expect(run.frames()).toEqual([])
})

test("stopping drops the open window", () => {
  const run = driven()
  run.wire.publish(appending("agent:1", 0, "unsent"))
  run.wire.stop()
  expect(run.clock.open()).toBe(false)
  run.clock.turn()
  expect(run.frames()).toEqual([])
})
