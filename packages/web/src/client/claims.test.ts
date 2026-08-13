/**
 * Claims this tree's docstrings make about WHERE things are spelled, held as
 * sweeps rather than as sentences.
 *
 * Two files in this client claim a monopoly, and both claims decayed once
 * already — `wire.ts` promised "the only file that knows a websocket exists"
 * while it hand-derived the dial URL a helper already owned, and the readout's
 * states were once folded per consumer. A claim in a docstring is checked at
 * review time by whoever happens to remember it; a claim swept here is checked
 * on every test run, and the failure names the file that broke it.
 *
 * The sweeps grip the CALL and the SPELLING, not the import path: a consumer
 * is free to import `@kolu/surface-app/solid` for its types (`status.ts` is
 * the door to the readout's), and a monopoly on a subpath would outlaw that
 * while missing a re-export. What cannot appear twice is the act — dialling
 * (`connectSurface(...)`), or comparing against a raw state name.
 *
 * Comments are stripped before matching, because these are claims about code:
 * prose is allowed to DISCUSS `connectSurface` or quote "live" while
 * explaining why nothing else may spell it.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

const CLIENT = import.meta.dirname
const SELF = import.meta.filename

/** Every source file under the client, this one excluded — the sweeps below
 *  quote the spellings they hunt, and a sweep that caught its own net would
 *  teach the next reader to weaken the pattern rather than the code. */
const sources = (): ReadonlyArray<string> => {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && full !== SELF) found.push(full)
    }
  }
  walk(CLIENT)
  return found
}

/** The file's code, with its comments removed. Line comments are only taken
 *  when `//` opens the line or follows whitespace, so a `https://…` inside a
 *  string survives; the cost is a comment pasted mid-expression surviving too,
 *  which for a sweep means a false alarm a human reads, never a silent pass. */
const codeOf = (file: string): string =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")

/** Where each file that matched is, client-relative, so a failure is a
 *  file list rather than a boolean. */
const filesSpelling = (pattern: RegExp): ReadonlyArray<string> =>
  sources()
    .filter((file) => pattern.test(codeOf(file)))
    .map((file) => path.relative(CLIENT, file))
    .sort()

// wire.ts's own opening line — "the only file in the client that knows a
// websocket exists" — tested as the CALL: exactly one file dials. Asserting
// equality rather than "nothing else" keeps the sweep honest, because a
// pattern that rotted would report an empty list here instead of passing.
test("only wire.ts dials: connectSurface( is called exactly once in the client", () => {
  expect(filesSpelling(/connectSurface\(/)).toEqual(["wire.ts"])
})

// status.ts's claim — it "says what each of the five looks like, and nothing
// else about them" is only safe if nothing else READS them raw. Everything
// downstream takes the readout whole (a prop, a `data-` attribute) or goes
// through `lookOf`; the day a component branches on `"retired"` itself, the
// sixth state lands everywhere status.ts is not. The test file is the one
// other legitimate speller: its fixtures must utter the states to hold the
// table to them.
test("nothing outside connection/status.ts reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  expect(filesSpelling(states)).toEqual([
    path.join("connection", "status.test.ts"),
    path.join("connection", "status.ts"),
  ])
})
