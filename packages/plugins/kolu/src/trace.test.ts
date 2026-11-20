import { expect, test } from "bun:test"

import { listed, type Trace, tracing } from "./trace.ts"

const bench = (): { trace: Trace; lines: ReadonlyArray<string> } => {
  const lines: Array<string> = []
  return {
    trace: tracing((line) => {
      lines.push(line)
    }),
    lines,
  }
}

test("a line is the prefix, the moment, then the facts in the caller's order", () => {
  const it = bench()
  it.trace("classified", { terminal: "11e565c0", file: "lanes.olai", meaning: "none" })
  // THE ORDER IS THE CALLER'S and is never sorted.
  expect(it.lines[0]).toBe(
    "kolu doorbell classified terminal=11e565c0 file=lanes.olai meaning=none",
  )
})

test("a value that would break the scan is quoted, and one that would not is bare", () => {
  const it = bench()
  it.trace("said", {
    file: "orchestrator/lanes.olai",
    step: "implement + open PR",
    standing: 2,
    coalesce: "kolu:wake",
  })
  expect(it.lines[0]).toBe(
    'kolu doorbell said file=orchestrator/lanes.olai step="implement + open PR" standing=2'
      + " coalesce=kolu:wake",
  )
})

test("an absent fact says `none` and is never dropped", () => {
  const it = bench()
  it.trace("event", { kind: "heartbeat", terminal: null, at: "2026-09-01T21:42:52.000Z" })
  expect(it.lines[0]).toBe(
    "kolu doorbell event kind=heartbeat terminal=none at=2026-09-01T21:42:52.000Z",
  )
  it.trace("said", { who: "" })
  expect(it.lines[1]).toBe('kolu doorbell said who=""')
})

test("a list rides as one bare token, and an empty one is `none`", () => {
  const it = bench()
  it.trace("derived", {
    file: "lanes.olai",
    ringing: listed(["11e565c0@tns", "4b5a3fb6@odu-doorbell"]),
    unmatched: listed([]),
  })
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai ringing=11e565c0@tns,4b5a3fb6@odu-doorbell"
      + " unmatched=none",
  )
})
