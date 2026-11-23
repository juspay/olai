import { expect, test } from "bun:test"
import { Schema } from "effect"
import { environmentReadings } from "@olai/plugin-api/configuration"
import { BuiltPlugin, EnvironmentReading, isPluginCode } from "./plugins.ts"

test("a secret reading has no value; machine paths retain theirs", () => {
  const readings = environmentReadings([
    { key: "TOKEN", secret: true, says: "credential" },
    { key: "ABSENT", secret: true, says: "credential" },
    { key: "EXECUTABLE", secret: false, says: "machine path" },
  ], { TOKEN: "never-on-the-wire", EXECUTABLE: "/machine/bin/tool" })
  expect(readings).toEqual([
    { key: "TOKEN", kind: "secret", set: true, says: "credential" },
    { key: "ABSENT", kind: "secret", set: false, says: "credential" },
    { key: "EXECUTABLE", kind: "resource", set: true, says: "machine path", value: "/machine/bin/tool" },
  ])
  for (const reading of readings) {
    const wire = Schema.encodeSync(EnvironmentReading)(reading)
    expect(JSON.stringify(wire)).not.toContain("never-on-the-wire")
    if (reading.kind === "secret") expect(Object.hasOwn(wire, "value")).toBe(false)
  }
})

test("wrapper provenance is explicit, never inferred from a store path", () => {
  const declarations = [{ key: "EXECUTABLE", secret: false, says: "machine path" }]
  const value = "/nix/store/example/bin/tool"
  const operator = environmentReadings(declarations, { EXECUTABLE: value })[0]!
  const wrapper = environmentReadings(declarations, { EXECUTABLE: value, OLAI_WRAPPER_DEFAULTS: "EXECUTABLE" })[0]!
  expect(operator).not.toHaveProperty("source")
  expect(Schema.decodeUnknownSync(EnvironmentReading)(wrapper)).toMatchObject({ source: "wrapper", value })
})

test("resource URLs redact userinfo before a roster can carry them", () => {
  const declaration = [{ key: "RESOURCE_URL", secret: false, says: "the remote resource" }]
  const reading = environmentReadings(declaration, { RESOURCE_URL: "https://operator:secret@example.test/api?q=1" })
  expect(reading).toEqual([{ key: "RESOURCE_URL", kind: "resource", set: true, says: "the remote resource", value: "https://example.test/api?q=1" }])
  expect(environmentReadings(declaration, { RESOURCE_URL: "https://example.test" })[0]).toMatchObject({ value: "https://example.test" })
})


test("controls and file problems survive the row and process wire readings", async () => {
  const { PluginRoster } = await import("./plugins.ts")
  const policy = { key: "mode", value: "quiet", setBy: "default", says: "how much", control: { kind: "choice", options: ["quiet", "loud"] }, problem: { raw: "louder", why: "expected quiet or loud" } } as const
  const decoded = Schema.decodeUnknownSync(PluginRoster)({ built: [], instance: { hostname: "machine", host: "localhost", port: 1, hostAuthor: "default", portAuthor: "default", policy: [policy], origins: [], bearer: { set: true } } })
  expect(decoded.instance!.policy[0]).toEqual(policy)
  const { BuiltPlugin } = await import("./plugins.ts")
  const row = Schema.decodeUnknownSync(BuiltPlugin)({ name: "example", running: true, configurationValues: [policy] })
  expect(row.configurationValues![0]).toEqual(policy)
  for (const reading of environmentReadings([{ key: "TOKEN", secret: true, says: "credential" }], { TOKEN: "private" })) {
    expect(reading).not.toHaveProperty("control")
    expect(reading).not.toHaveProperty("value")
  }
})

test("a choice with a typed value survives the row wire, and one without still decodes", () => {
  const typed = { key: "size", value: "250k", setBy: "vault", says: "how big", control: { kind: "choice", options: ["200k", "auto"], other: { expected: "a number of thousands" } } } as const
  const bare = { key: "mode", value: "quiet", setBy: "default", says: "how much", control: { kind: "choice", options: ["quiet", "loud"] } } as const
  const row = Schema.decodeUnknownSync(BuiltPlugin)({ name: "example", running: true, configurationValues: [typed, bare] })
  expect(row.configurationValues).toEqual([typed, bare])
})

test("a name with a line break, a line separator or another control character is not plugin code", () => {
  // A file's name is shown as a tab's label, never as code; a name that could
  // end a line is refused rather than carried anywhere text is evaluated.
  for (const name of ["a\nb.ts", "a\rb.ts", "lib/a\u2028b.ts", "a\u2029b.tsx", "a\u0000b.ts", "a\tb.ts", "a\u007fb.ts"]) {
    expect(isPluginCode(name)).toBe(false)
  }
  expect(isPluginCode("lib/sm2.ts")).toBe(true)
  expect(isPluginCode("a#b.tsx")).toBe(true)
  expect(isPluginCode("app/étude.ts")).toBe(true)
})
