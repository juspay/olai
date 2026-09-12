/**
 * THE ROWS' OWN CLAIMS — what the built-in default is, and what file policy does to
 * it.
 *
 * ## Why this is about the ROW and not about a manifest field
 *
 * A plugin that needs a secret this machine may not have is off until somebody
 * asks for it. That could be a `defaultOn: false` on the wire half — a field
 * core reads to build a default list — and it is the row's own `disabled`
 * instead, because that is the same field the file-policy patch writes. One
 * mechanism, two writers: the file says what the build does by default, and the
 * patch says what the operator asked for, and there is no second spelling for
 * the two to disagree across.
 *
 * What that buys is pinned in configuration.test.ts: turning an opt-in plugin ON
 * is not a special path. It is a patch setting `disabled: false` on a row the
 * file set `true`, which is the same line of code that turns another row off.
 */

import { expect, test } from "bun:test"

import { readFileSync } from "node:fs"

import { profilePatch } from "./bundle.ts"
import { BUNDLE_NAMES, DEFAULT_BUNDLE_NAMES, inBundleOrder, ROWS } from "./rows.ts"

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

/**
 * THE CHAT ROW IS ON, NAMED — the rule above holds it for every row, and this
 * holds it for the one row whose being off is a different product.
 *
 * A serve without chat has no panel, no transcript, no agents section and no
 * conversation anywhere, and every engine and every tenant sits `waiting`
 * behind the doors it offers. That is a legitimate serve and there is a
 * scenario for it (`features/the_doorbell_rings.feature`) — reached by an
 * operator disabling the chat row through the file or its panel switch. A `disabled: true` left on
 * this row by somebody debugging would ship that serve as the DEFAULT, and
 * every claim about it would still pass: the rule above would simply agree that
 * an opted-out row is opted out.
 *
 * FIRST, too, because the file is read by people and the thing everything else
 * waits on reads first. Nothing depends on the order — the runtime is reactive
 * and a row that mounts late is picked up when its `apply` provides — so this
 * is a claim about the FILE rather than about the boot.
 */
test("every row names a plugins panel section", () => {
  for (const row of ROWS) {
    expect(row.section.length).toBeGreaterThan(0)
  }
})

test("policy defaults belong to schemas; no YAML row carries config", () => {
  const source = readFileSync(new URL("../olai.yml", import.meta.url), "utf8")
  expect(source).not.toMatch(/^\s+config:/m)
  for (const row of ROWS) expect(row).not.toHaveProperty("config")
})

test("alerts precedes its consumers, and chat is on by default", () => {
  expect(DEFAULT_BUNDLE_NAMES).toContain("chat")
  expect(ROWS.find((row) => row.id === "chat")?.disabled).toBeUndefined()
  expect(ROWS[0]?.id).toBe("alerts")
  expect(DEFAULT_BUNDLE_NAMES).toContain("alerts")
  expect(ROWS.find(row => row.id === "alerts")?.browserOnly).toBe(true)
  // ...and an omitted flag leaves it that way, which is the other half: the
  // default is what a person gets by typing nothing.
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

test("profiles select only catalogue rows and preserve build defaults", () => {
  for (const profile of ["web", "surface", "test-minimal"]) {
    const patches = profilePatch(profile)
    expect(patches.every(patch => BUNDLE_NAMES.includes(patch.id))).toBe(true)
    const on = ROWS.filter(row => !(patches.find(patch => patch.id === row.id)?.disabled ?? row.disabled)).map(row => row.id)
    expect<ReadonlyArray<string>>(on).toEqual(profile === "web" ? DEFAULT_BUNDLE_NAMES : profile === "surface" ? ["vault", "settings", "mcp", "outlines", "files", "pins", "capture", "trash", "vault-plugins", "olai", "markdown", "hypertext", "csv", "image", "pdf"] : ["vault", "settings", "olai"])
  }
})

test("transport modifiers apply over each profile's defaults", () => {
  for (const profile of ["web", "surface", "test-minimal"]) {
    const patches = [...profilePatch(profile), { id: "ws", disabled: false }, { id: "mcp", disabled: true }]
    const enabled = (id: string) => !(patches.filter((row) => row.id === id).at(-1)?.disabled ?? ROWS.find((row) => row.id === id)?.disabled)
    expect(enabled("ws")).toBe(true)
    expect(enabled("mcp")).toBe(false)
    expect(enabled("web-app")).toBe(profile === "web")
    expect(enabled("vault")).toBe(true)
  }
})

test("maintained fixtures require an explicit selection and never select each other", () => {
  for (const profile of ["web", "surface", "test-minimal"]) {
    for (const chosen of [undefined, "test-layout", "test-counter"] as const) {
      const patches = [...profilePatch(profile), ...(chosen === undefined ? [] : [{ id: chosen, disabled: false }])]
      const enabled = (id: string) => !(patches.filter(patch => patch.id === id).at(-1)?.disabled ?? ROWS.find(row => row.id === id)?.disabled)
      expect(enabled("test-layout")).toBe(chosen === "test-layout")
      expect(enabled("test-counter")).toBe(chosen === "test-counter")
      expect(enabled("vault")).toBe(true)
      expect(enabled("layout")).toBe(profile === "web")
    }
  }
})
