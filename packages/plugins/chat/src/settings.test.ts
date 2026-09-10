import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Config } from "./settings.ts"

test("idle-ms decodes property strings within the Node timer range", () => {
  const decode = Schema.decodeUnknownSync(Config)
  expect(decode({})).toEqual({ "idle-ms": 900000 })
  for (const value of ["1", "1200", "2147483647"]) expect(decode({ "idle-ms": value })["idle-ms"]).toBe(Number(value))
  for (const value of ["0", "-1", "2147483648", "1.5", "NaN", "forever", ""]) expect(() => decode({ "idle-ms": value })).toThrow()
})
