/**
 * THE TRACE'S OWN BENCH — what one line looks like, and the three shapes that
 * would make a `grep` lie.
 *
 * The whole value of {@link ./trace.ts} is that a person can find one fact in a
 * day of log with one pattern, so what is pinned here is the SPELLING: the
 * prefix, the bare token, the quoted one, and the word an absence gets. A
 * formatter nobody held to a shape would drift the day somebody logged a title.
 */

import { expect, test } from "bun:test"

import { listed, type Trace, tracing } from "./trace.ts"

/** The tracer over a collector — the same wiring `./server.ts` gives it, with
 *  the channel kept rather than logged. */
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
  // THE ORDER IS THE CALLER'S and is never sorted: a seam knows which fact a
  // reader wants first, and an alphabetised line would put `file` before the
  // terminal the reader came looking for.
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
  // A path and a colon-keyed word stay BARE, which is what makes
  // `grep 'file=orchestrator/lanes.olai'` find them. A title holds anything at
  // all — spaces here, and an `=` or a quote on some other board — so it is
  // rendered through `JSON.stringify`, which is both the escape and the test.
  expect(it.lines[0]).toBe(
    'kolu doorbell said file=orchestrator/lanes.olai step="implement + open PR" standing=2'
      + " coalesce=kolu:wake",
  )
})

test("an absent fact says `none` and is never dropped", () => {
  const it = bench()
  it.trace("event", { kind: "heartbeat", terminal: null, at: "2026-09-01T21:42:52.000Z" })
  // DROPPING IT WOULD BE THE LIE. A key that is sometimes absent cannot be told
  // from one that was never written, and "which events named no terminal" is a
  // question about this exact field.
  expect(it.lines[0]).toBe(
    "kolu doorbell event kind=heartbeat terminal=none at=2026-09-01T21:42:52.000Z",
  )
  // ...and the EMPTY string is quoted, because `key=` at the end of a line
  // reads as a value that was lost rather than one that is empty.
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
  // `·` rather than a comma, so the token stays bare and the `grep` that is the
  // whole point survives: quoting the list to keep a comma would cost it.
  expect(it.lines[0]).toBe(
    "kolu doorbell derived file=lanes.olai ringing=11e565c0@tns·4b5a3fb6@odu-doorbell"
      + " unmatched=none",
  )
})
