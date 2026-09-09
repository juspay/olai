import { expect, test } from "bun:test"
import { Schema } from "effect"
import { environmentReadings } from "@olai/plugin-api/configuration"
import { EnvironmentReading } from "./plugins.ts"

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
