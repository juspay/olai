import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { readingOf, setOf } from "@olai/format/testlib"
import { readConfiguration, warningsOnce, type Declarations } from "./config.ts"

const Config = Schema.Struct({
  mode: Schema.Literals(["quiet", "loud"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed("quiet" as const)), Schema.annotate({ description: "how much to say" })),
  limit: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(5)), Schema.annotate({ description: "how many" })),
  watch: Schema.Struct({ interval: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("1m")), Schema.annotate({ description: "how often" })) })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed({ interval: "1m" })), Schema.annotate({ description: "pacing" })),
})
const declarations: Declarations = new Map([["example", Config], ["another", Config]])
const row = (custom: object = {}) => JSON.stringify({ id: "example", title: "example", ord: "a0", custom })
const read = (files: Record<string, string>, warn = (_: string) => {}) => readConfiguration(readingOf(setOf(files)), declarations, 1, warn)

test("no file and no row use every schema default", () => {
  expect(read({}).rows.get("example")?.config).toEqual({ mode: "quiet", limit: 5, watch: { interval: "1m" } })
  expect(read({}).file).toBeUndefined()
  expect(read({}).rows.get("example")?.values.every((one) => one.setBy === "default")).toBe(true)
})
test("top-level namespaces, child sections, typed values and authors share one revision", () => {
  const at = read({ "_olai/Settings.olai": row({ mode: "loud", limit: "12", on: "no" }) + '\n' + JSON.stringify({ id: "w", title: "watch", parent: "example", ord: "a0", custom: { interval: "2m" } }) })
  expect(at.rows.get("example")?.config).toEqual({ mode: "loud", limit: 12, watch: { interval: "2m" } })
  expect(at.rows.get("example")?.on).toBe(false)
  expect(at.rows.get("example")?.values.map((one) => one.setBy)).toEqual(["vault", "vault", "vault"])
  expect(at.rows.get("another")?.config.mode).toBe("quiet")
})
test("malformed leaves default independently and each shape is warned once", () => {
  const lines: string[] = []
  const warn = warningsOnce((line) => lines.push(line))
  const files = { "_olai/Settings.olai": row({ mode: "wrong", limit: "12", on: "maybe" }) }
  const first = read(files, warn)
  read(files, warn)
  expect(first.rows.get("example")?.config.mode).toBe("quiet")
  expect(first.rows.get("example")?.config.limit).toBe(12)
  expect(first.rows.get("example")?.on).toBeUndefined()
  expect(lines.length).toBe(2)
  expect(lines.join("\n")).toContain("example.mode")
})
test("a broken line defaults all namespaces and still names the file", () => {
  const lines: string[] = []
  const at = readConfiguration(readingOf(setOf({}, [], { "_olai/Settings.olai": "torn line" })), declarations, 1, line => lines.push(line))
  expect(lines).toEqual(["_olai/Settings.olai: malformed settings file; every row uses its defaults"])
  expect(at.broken).toContain("_olai/Settings.olai")
  expect(at.rows.get("example")?.config.mode).toBe("quiet")
  expect(at.rows.get("another")?.config.mode).toBe("quiet")
})
test("case-folded basename, shallowest path and deterministic ties decide", () => {
  const at = read({ "Settings.OLAI": row({ mode: "loud" }), "_olai/Settings.olai": row({ mode: "quiet" }) })
  expect(at.file).toBe("Settings.OLAI")
  expect(at.rows.get("example")?.config.mode).toBe("loud")
})
