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

import { pluginsPatch } from "./bundle.ts"
import { BUNDLE_NAMES, DEFAULT_BUNDLE_NAMES, inBundleOrder, ROWS } from "./rows.ts"

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

/**
 * THE ORDER THREE READERS TAKE, and the two properties it is not obvious about.
 *
 * The sort exists because registration order is the order two dynamic `import()`s
 * came back in, and three separate readings — the session's servers, the tab's
 * plugin-keyed faces, this build's engines — are lists a PERSON reads and has to
 * be able to read twice. The comparator was written out at all three of those
 * before it lived here; what those copies could not state, and this can, is what
 * happens at the edges.
 */
test("the build's own list decides, whatever order things arrived in", () => {
  const arrived = [...BUNDLE_NAMES].reverse().map((name) => ({ id: name }))
  expect(inBundleOrder(arrived, (one) => one.id).map((one) => one.id)).toEqual([...BUNDLE_NAMES])
})

test("a name this build never heard of sorts LAST, not first", () => {
  // The `-1` a bare `indexOf` gives would put a stranger before every row the
  // build DOES have, which is the wrong end: the day `olai plugin add` lands,
  // an out-of-tree plugin belongs after the ones that shipped.
  const first = BUNDLE_NAMES[0] ?? "claude"
  const sorted = inBundleOrder(
    [{ id: "not-a-plugin-this-build-has" }, { id: first }],
    (one) => one.id,
  )
  expect(sorted.map((one) => one.id)).toEqual([first, "not-a-plugin-this-build-has"])
})

test("...and two strangers keep the order they arrived in", () => {
  // The only order there is to keep for them: the build has no opinion about a
  // plugin it never named, so the sort must not invent one. `Array.sort` is
  // stable, and this is the claim that says we are relying on that.
  const sorted = inBundleOrder([{ id: "zeta-x" }, { id: "alpha-x" }], (one) => one.id)
  expect(sorted.map((one) => one.id)).toEqual(["zeta-x", "alpha-x"])
})

test("the input is not reordered under its owner", () => {
  // Three callers hand over a live registry's own array (`plugins.engines()`,
  // `app.hung(slot)`); a sort in place would reorder somebody else's table as a
  // side effect of reading it.
  const arrived = [{ id: "zeta-x" }, { id: BUNDLE_NAMES[0] ?? "claude" }]
  inBundleOrder(arrived, (one) => one.id)
  expect(arrived.map((one) => one.id)).toEqual(["zeta-x", BUNDLE_NAMES[0] ?? "claude"])
})
