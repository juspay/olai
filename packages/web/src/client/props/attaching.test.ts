/**
 * THE RE-ATTACH POLICY — the four rules, each as the case that would have cost
 * a production incident without it.
 *
 * These are kolu's rules and kolu's incidents (kolu#2101, deploys #2 and #3:
 * three panes blank over live agents, and scrollback rebuilt at the wrong
 * width). The package ships the rules; the loop is olai's policy, so these are
 * olai's tests of olai's decisions about them.
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

const GRID = { cols: 80, rows: 24 }
const fresh = (): Attaching => opening(GRID)

/** A pane that has used every attach it is going to get. */
const exhausted = (): Attaching => {
  let state = fresh()
  while (!spent(state)) state = again(state, GRID)
  return state
}

describe("rule 1 — a snapshot is only valid at the grid it was asked for", () => {
  it("REFUSES a snapshot that answers another grid, rather than painting it", () => {
    // The irreversible one. A later resize repaints a full-screen app; nothing
    // rebuilds scrollback that has already been wrapped at the wrong width.
    const { next } = onFrame(fresh(), { kind: "snapshot", data: "a screen" }, false)
    expect(next.kind).toBe("reattach")
  })

  it("paints one that does, and RESETS first — a snapshot is a whole screen", () => {
    const { next } = onFrame(fresh(), { kind: "snapshot", data: "hello" }, true)
    expect(next).toEqual({ kind: "write", data: "hello", reset: true })
  })

  it("writes a DELTA whatever the grid is doing — bytes carry no layout claim", () => {
    // The distinction the discriminated frame exists for: refusing deltas on a
    // grid mismatch would drop output that was never a layout claim.
    const { next } = onFrame(fresh(), { kind: "delta", data: "$ " }, false)
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
    const { state } = onFrame(fresh(), { kind: "delta", data: "x" }, true)
    expect(onSilence(state).kind).toBe("idle")
    expect(again(state, GRID).seen).toBe(false)
  })
})

describe("a refusal in words", () => {
  it("STOPS rather than re-attaching — asking again gets the same answer", () => {
    const { next } = onFrame(fresh(), { kind: "refused", says: "no padi" }, true)
    expect(next).toEqual({ kind: "stop", says: "no padi" })
  })
})

describe("the budget", () => {
  it("is spent by attaches and nothing else", () => {
    let state = fresh()
    expect(state.attempts).toBe(1)
    for (let i = 1; i < ATTEMPT_BUDGET; i += 1) state = again(state, GRID)
    expect(spent(state)).toBe(true)
  })

  it("remembers the grid each attach ASKED at, not the one the pane has now", () => {
    // The answer in flight belongs to the question that was asked — which is
    // also why the framework's transport retry replaying a captured input is
    // one of the three ways a grid goes stale.
    expect(again(fresh(), { cols: 100, rows: 40 }).asked).toEqual({ cols: 100, rows: 40 })
  })
})
