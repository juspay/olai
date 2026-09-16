import { expect, test } from "bun:test"
import { readingOf, setOf } from "@olai/format/testlib"
import { wakingIn, type Seats } from "./inbox.ts"
import { kinds } from "./kinds.ts"
import { Config, pollMillis } from "./settings.ts"
import { Schema } from "effect"
const node = (id: string, custom = {}) => JSON.stringify({ id, ord: "a0", title: id, custom })
test("mail admits the shared case-insensitive yes/no words, but never arbitrary text", () => {
  for (const word of ["on", "yes", "true", "off", "no", "false", "ON", " True "]) expect(kinds[0].admits(word)).toBe(true)
  for (const word of ["", "1", "maybe"]) expect(kinds[0].admits(word)).toBe(false)
})
test("waking joins declared columns and current seats, keeps intent, skips mirrors and deduplicates sessions", () => {
  const derived = readingOf(setOf({
    "_olai/Properties.olai": JSON.stringify({ id: "prop", ord: "a0", title: "notify", custom: { type: "mail-inbox" } }),
    "inbox.olai": [node("a", { notify: "ON" }), node("b", { notify: "yes" }), node("c", { notify: "true" }), node("off", { notify: "off" }), JSON.stringify({ id: "mirror", ord: "a1", mirror: "a" })].join("\n"),
  })).derived
  const seated: Seats = ["a", "b", "c", "off", "mirror"].map(id => ({ id, file: "inbox.olai", title: id, engine: "claude", session: id === "b" ? null : "session" }))
  const answer = wakingIn(derived, seated)
  expect(answer.named.map(at => at.node)).toEqual(["a", "b", "c"])
  expect(answer.binds.map(at => at.node)).toEqual(["a"])
})
test("poll defaults to two minutes and refuses zero, missing units and timer overflow", () => {
  expect(Schema.decodeUnknownSync(Config)({})).toEqual({ poll: "2m" })
  expect(pollMillis("500ms")).toBe(500)
  expect(pollMillis("2m")).toBe(120000)
  for (const value of ["0s", "5", "-1m", "1.5m", "25d", "never"]) expect(() => Schema.decodeUnknownSync(Config)({ poll: value })).toThrow()
})
