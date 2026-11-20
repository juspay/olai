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
  expect(ROWS.some((row) => row.disabled === true)).toBe(true)
  expect(DEFAULT_BUNDLE_NAMES.length).toBeLessThan(BUNDLE_NAMES.length)
})

test("every row names a plugins panel section", () => {
  for (const row of ROWS) {
    expect(row.section.length).toBeGreaterThan(0)
  }
})

test("every row names a distinct label for the plugins panel", () => {
  const labels = ROWS.map((row) => row.label)
  for (const [index, label] of labels.entries()) {
    expect([ROWS[index]!.id, typeof label === "string" && label.length > 0]).toEqual([ROWS[index]!.id, true])
  }
  expect(new Set(labels).size).toBe(labels.length)
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
})

test("the build's own list decides, whatever order things arrived in", () => {
  const arrived = [...BUNDLE_NAMES].reverse().map((name) => ({ id: name }))
  expect(inBundleOrder(arrived, (one) => one.id).map((one) => one.id)).toEqual([...BUNDLE_NAMES])
})

test("a name this build never heard of sorts LAST, not first", () => {
  const first = BUNDLE_NAMES[0] ?? "claude"
  const sorted = inBundleOrder(
    [{ id: "not-a-plugin-this-build-has" }, { id: first }],
    (one) => one.id,
  )
  expect(sorted.map((one) => one.id)).toEqual([first, "not-a-plugin-this-build-has"])
})

test("...and two strangers keep the order they arrived in", () => {
  const sorted = inBundleOrder([{ id: "zeta-x" }, { id: "alpha-x" }], (one) => one.id)
  expect(sorted.map((one) => one.id)).toEqual(["zeta-x", "alpha-x"])
})

test("the input is not reordered under its owner", () => {
  const arrived = [{ id: "zeta-x" }, { id: BUNDLE_NAMES[0] ?? "claude" }]
  inBundleOrder(arrived, (one) => one.id)
  expect(arrived.map((one) => one.id)).toEqual(["zeta-x", BUNDLE_NAMES[0] ?? "claude"])
})

test("profiles select only catalogue rows and preserve build defaults", () => {
  for (const profile of ["web", "surface", "test-minimal"]) {
    const patches = profilePatch(profile)
    expect(patches.every(patch => BUNDLE_NAMES.includes(patch.id))).toBe(true)
    const on = ROWS.filter(row => !(patches.find(patch => patch.id === row.id)?.disabled ?? row.disabled)).map(row => row.id)
    expect<ReadonlyArray<string>>(on).toEqual(profile === "web" ? DEFAULT_BUNDLE_NAMES : profile === "surface" ? ["vault", "settings", "mcp", "outlines", "files", "pins", "capture", "trash", "vault-plugins", "outline-olai", "markdown", "hypertext", "csv", "hledger", "image", "pdf"] : ["vault", "settings", "outline-olai"])
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
    for (const chosen of [undefined, "test-layout", "test-counter", "test-palette", "test-page"] as const) {
      const patches = [...profilePatch(profile), ...(chosen === undefined ? [] : [{ id: chosen, disabled: false }])]
      const enabled = (id: string) => !(patches.filter(patch => patch.id === id).at(-1)?.disabled ?? ROWS.find(row => row.id === id)?.disabled)
      expect(enabled("test-layout")).toBe(chosen === "test-layout")
      expect(enabled("test-counter")).toBe(chosen === "test-counter")
      expect(enabled("test-palette")).toBe(chosen === "test-palette")
      expect(enabled("test-page")).toBe(chosen === "test-page")
      expect(enabled("vault")).toBe(true)
      expect(enabled("layout")).toBe(profile === "web")
    }
  }
})

test("the outline format row's switch explains its withdrawal consequences", () => {
  const row = ROWS.find(row => row.id === "outline-olai")
  expect(row?.switchHint).toBe("Disabling this row unclaims outlines and prevents creating them; trash, inbox, pins and agenda become unavailable, and settings reading withdraws until it returns.")
})
