/**
 * THE RE-ATTACH POLICY — the four rules, each as the case that would have cost
 * a production incident without it.
 *
 * These are kolu's rules and kolu's incidents (kolu#2101, deploys #2 and #3:
 * three panes blank over live agents, and scrollback rebuilt at the wrong
 * width). The package ships the rules; the loop is olai's policy, so these are
 * olai's tests of olai's decisions about them.
 *
 * RULE 1 IS TESTED AS ADOPTION now rather than as refusal, and the change is
 * the point: a snapshot names the grid it was serialized at (kolu 5.5, the
 * amendment this lane asked for), so a monitor takes that size instead of
 * asserting one of its own. The three cases below are the ones the kolu author
 * flagged as least-reviewed in that amendment, pinned here from the consumer's
 * side: a grid that MOVES mid-stream, a padi too old to name one at all, and
 * the overflow re-attach that arrives as a fresh snapshot.
 */

import { describe, expect, it } from "bun:test"

import {
  again,
  ATTEMPT_BUDGET,
  type Attaching,
  onEnd,
  onFrame,
  onSilence,
  opening,
  spent,
} from "./attaching.ts"

const fresh = (): Attaching => opening()

/** A pane that has used every attach it is going to get. */
const exhausted = (): Attaching => {
  let state = fresh()
  while (!spent(state)) state = again(state)
  return state
}

describe("rule 1 — a snapshot is only valid at the grid it was serialized at", () => {
  it("ADOPTS the grid the frame names, and resets before painting", () => {
    const { next } = onFrame(fresh(), {
      kind: "snapshot",
      data: "hello",
      grid: { cols: 203, rows: 51 },
    })
    expect(next).toEqual({
      kind: "write",
      data: "hello",
      reset: true,
      grid: { cols: 203, rows: 51 },
    })
  })

  it("takes a grid that MOVED mid-stream — a foreign resize is just a new snapshot", () => {
    // The case no local measurement can see: another client attached at its own
    // size and resized the shared pty. There is no event; the only evidence is
    // that the next snapshot names a different grid, and adopting it is the
    // whole of the response.
    const wide = onFrame(fresh(), {
      kind: "snapshot",
      data: "a",
      grid: { cols: 203, rows: 51 },
    })
    const narrow = onFrame(wide.state, {
      kind: "snapshot",
      data: "b",
      grid: { cols: 80, rows: 24 },
    })
    expect(narrow.next.kind === "write" && narrow.next.grid).toEqual({ cols: 80, rows: 24 })
  })

  it("KEEPS THE SIZE IT HAS when a padi is too old to name one", () => {
    // `grid` is additive and optional, so a padi before 5.5 says nothing. Not
    // knowing is a reason to change nothing — guessing a size is precisely the
    // failure the field was added to end, and a monitor that measured its own
    // box would be asserting a grid again by the back door.
    for (const frame of [
      { kind: "snapshot" as const, data: "x" },
      { kind: "snapshot" as const, data: "x", grid: null },
    ]) {
      const { next } = onFrame(fresh(), frame)
      expect(next.kind === "write" && next.grid).toBeUndefined()
      // ...and it still paints: an unnamed grid is not a refusal.
      expect(next.kind === "write" && next.reset).toBe(true)
    }
  })

  it("treats an OVERFLOW re-attach like any other snapshot — reset, adopt, paint", () => {
    // padi sends a fresh snapshot mid-stream when the delta window overflows.
    // It is not a special case here and must not become one: the arm already
    // means START AGAIN FROM HERE.
    const started = onFrame(fresh(), { kind: "snapshot", data: "first", grid: { cols: 80, rows: 24 } })
    const flowed = onFrame(started.state, { kind: "delta", data: "more" })
    const overflowed = onFrame(flowed.state, {
      kind: "snapshot",
      data: "again",
      grid: { cols: 80, rows: 24 },
    })
    expect(overflowed.next).toEqual({
      kind: "write",
      data: "again",
      reset: true,
      grid: { cols: 80, rows: 24 },
    })
  })

  it("writes a DELTA whatever the grid is doing — bytes carry no layout claim", () => {
    const { next } = onFrame(fresh(), { kind: "delta", data: "$ " })
    expect(next).toEqual({ kind: "write", data: "$ ", reset: false })
  })
})

describe("rule 3 — a clean end does not mean the PTY exited", () => {
  it("re-attaches on a clean end", () => {
    expect(onEnd(fresh()).kind).toBe("reattach")
  })

  it("...but converges: a budget is what makes treating an end as recoverable safe", () => {
    // Without this, a pane over a terminal that closed an hour ago re-attaches
    // until the tab does.
    const done = onEnd(exhausted())
    expect(done.kind).toBe("stop")
    expect(done.kind === "stop" && done.says).toContain("closed")
  })
})

describe("rule 4 — silence is a failure mode with no event", () => {
  it("re-attaches when the first frame never came", () => {
    expect(onSilence(fresh()).kind).toBe("reattach")
  })

  it("says so once the budget is spent, rather than sitting blank forever", () => {
    expect(onSilence(exhausted()).kind).toBe("stop")
  })

  it("is silent about a pane that HAS been fed — the deadline is per attach", () => {
    // A re-attach that goes quiet is the same failure as an opening one, so the
    // flag is per attach rather than per pane; and a pane already painting must
    // not be torn down by a timer nobody cleared.
    const { state } = onFrame(fresh(), { kind: "delta", data: "x" })
    expect(onSilence(state).kind).toBe("idle")
    expect(again(state).seen).toBe(false)
  })
})

describe("a refusal in words", () => {
  it("STOPS rather than re-attaching — asking again gets the same answer", () => {
    const { next } = onFrame(fresh(), { kind: "refused", says: "no padi" })
    expect(next).toEqual({ kind: "stop", says: "no padi" })
  })
})

describe("the budget", () => {
  it("is spent by attaches and nothing else", () => {
    let state = fresh()
    expect(state.attempts).toBe(1)
    for (let i = 1; i < ATTEMPT_BUDGET; i += 1) state = again(state)
    expect(spent(state)).toBe(true)
  })
})
