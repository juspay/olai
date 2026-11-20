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
    for (const frame of [
      { kind: "snapshot" as const, data: "x" },
      { kind: "snapshot" as const, data: "x", grid: null },
    ]) {
      const { next } = onFrame(fresh(), frame)
      expect(next.kind === "write" && next.grid).toBeUndefined()
      expect(next.kind === "write" && next.reset).toBe(true)
    }
  })

  it("treats an OVERFLOW re-attach like any other snapshot — reset, adopt, paint", () => {
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

describe("the budget refills on a delivered frame", () => {
  it("gives a pane that PAINTED its budget back", () => {
    const { state } = onFrame(exhausted(), { kind: "delta", data: "x" })
    expect(spent(state)).toBe(false)
    expect(onEnd(state).kind).toBe("reattach")
  })

  it("...and a SNAPSHOT refills it too — painting is painting", () => {
    const { state } = onFrame(exhausted(), {
      kind: "snapshot",
      data: "hello",
      grid: { cols: 80, rows: 24 },
    })
    expect(spent(state)).toBe(false)
  })

  it("SURVIVES the resize lane — six grid changes on a painting pane", () => {
    let state = fresh()
    for (let i = 0; i < 6; i += 1) {
      state = again(state)
      state = onFrame(state, { kind: "snapshot", data: `frame ${i}` }).state
    }
    expect(spent(state)).toBe(false)
    expect(onSilence(state).kind).toBe("idle")
  })

  it("does NOT refill for a pane that never painted — convergence is kept", () => {
    let state = fresh()
    while (!spent(state)) state = again(state)
    expect(onEnd(state).kind).toBe("stop")
  })

  it("a REFUSAL does not refill — it stops, and stopping is terminal", () => {
    const { state, next } = onFrame(exhausted(), { kind: "refused", says: "no padi" })
    expect(next.kind).toBe("stop")
    expect(spent(state)).toBe(true)
  })
})
