import { expect, test } from "bun:test"
import { claims, type Claim } from "./kinds.ts"

const claim = (kind: string, exts: Claim["exts"]): Claim => ({
  kind, exts, holds: "text", kept: false, fetched: false, noun: "file", article: "a",
})

test("claims copy their input and separate hosts' snapshots", () => {
  const exts: [string, ...string[]] = [".first"]
  const input = claim("one", exts)
  const one = claims([input])
  const two = claims([claim("two", [".second"])])
  exts.push(".later")
  expect(one.byKind.get("one")?.exts).toEqual([".first"])
  expect(one.byExt.get(".first")).toBe("one")
  expect(one.byExt.has(".later")).toBe(false)
  expect(two.byKind.has("one")).toBe(false)
})

test("claims refuse duplicate owners and suffixes, including within one claim", () => {
  expect(() => claims([claim("one", [".first"]), claim("one", [".second"])])).toThrow("second claim")
  expect(() => claims([claim("one", [".first"]), claim("two", [".first"])])).toThrow("overlapping")
  expect(() => claims([claim("one", [".first", ".first"])])).toThrow("overlapping")
})

test("suffix overlap is refused in either registration order", () => {
  const short = claim("short", [".first"])
  const long = claim("long", [".nested.first"])
  expect(() => claims([short, long])).toThrow("overlapping")
  expect(() => claims([long, short])).toThrow("overlapping")
})

test("empty claims form an empty snapshot and malformed suffixes are refused", () => {
  expect(claims([]).byKind.size).toBe(0)
  for (const suffix of ["", ".", "first", ".a/b", ".a\\b", ".two words"]) {
    expect(() => claims([claim("one", [suffix])])).toThrow("invalid suffix")
  }
})
