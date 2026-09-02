/**
 * THE ROWS' OWN CLAIMS — what the built-in default is, and what a flag does to
 * it.
 *
 * ## Why this is about the ROW and not about a manifest field
 *
 * A plugin that needs a secret this machine may not have is off until somebody
 * asks for it. That could be a `defaultOn: false` on the wire half — a field
 * core reads to build a default list — and it is the row's own `disabled`
 * instead, because that is the SAME FIELD the flag's patch writes. One
 * mechanism, two writers: the file says what the build does by default, and the
 * patch says what the operator asked for, and there is no second spelling for
 * the two to disagree across.
 *
 * What that buys is visible in the third case below: turning an opt-in plugin ON
 * is not a special path. It is a patch setting `disabled: false` on a row the
 * file set `true`, which is the same line of code that turns another row off.
 */

import { expect, test } from "bun:test"

import { BUNDLE_NAMES, DEFAULT_BUNDLE_NAMES, pluginsPatch, ROWS } from "./bundle.ts"

/** What a patch says about one row, as a reader would ask it. `undefined` is a
 *  row the patch does not mention, which is what "nobody said" writes. */
const patched = (
  names: ReadonlyArray<string> | null,
  id: string,
): boolean | undefined =>
  (pluginsPatch(names).find((one) => one.id === id) as { disabled?: boolean } | undefined)?.disabled

test("the built-in default is the rows that did not opt out", () => {
  expect(DEFAULT_BUNDLE_NAMES.length).toBeGreaterThan(0)
  for (const row of ROWS) {
    if (row.disabled === true) expect(DEFAULT_BUNDLE_NAMES).not.toContain(row.id)
    else expect(DEFAULT_BUNDLE_NAMES).toContain(row.id)
  }
  // NOT VACUOUS in either direction: this build has a row of each kind, which is
  // what makes the two arms above claims rather than one arm and a `for` loop.
  expect(ROWS.some((row) => row.disabled === true)).toBe(true)
  expect(DEFAULT_BUNDLE_NAMES.length).toBeLessThan(BUNDLE_NAMES.length)
})

test("nobody having said writes no patch at all, so the rows' own default stands", () => {
  // The distinction the whole flag is shaped around, as a fact about the patch:
  // an omitted flag leaves the file's answer alone, so a browser drawing the row
  // can say `the built-in default` rather than repeating a list back.
  expect(pluginsPatch(null)).toEqual([])
})

test("a named pin writes BOTH directions, which is how an opt-in row is opted into", () => {
  const optedOut = ROWS.filter((row) => row.disabled === true).map((row) => row.id)
  const optedIn = ROWS.filter((row) => row.disabled !== true).map((row) => row.id)
  expect(optedOut.length).toBeGreaterThan(0)
  expect(optedIn.length).toBeGreaterThan(0)
  const off = optedOut[0] as string
  const on = optedIn[0] as string

  // Naming the opt-in row turns it ON — `disabled: false` over a row the file
  // set `true`, which is the case a patch that only ever wrote `true` could not
  // express at all.
  expect(patched([off], off)).toBe(false)
  // ...and every row the flag did not name goes off, including one the file left
  // on. Both directions from one expression.
  expect(patched([off], on)).toBe(true)

  // `--plugins=` — somebody saying NONE out loud — disables every row.
  for (const row of ROWS) expect(patched([], row.id)).toBe(true)
  // ...and naming everything turns everything on, opt-in rows included.
  for (const row of ROWS) expect(patched([...BUNDLE_NAMES], row.id)).toBe(false)
})
