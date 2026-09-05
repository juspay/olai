import { expect, test } from "bun:test"
import { Schema } from "effect"

import { PluginPin, pluginPinOf } from "./pluginPin.ts"

test("the three arms decode, and an older serve's pinned projection reconstructs", () => {
  expect(Schema.is(PluginPin)({ kind: "omitted" })).toBe(true)
  expect(Schema.is(PluginPin)({ kind: "exact", names: ["vault"] })).toBe(true)
  expect(Schema.is(PluginPin)({
    kind: "delta",
    extra: ["xyne-spaces"],
    without: null,
  })).toBe(true)

  expect(pluginPinOf({ pinned: null })).toEqual({ kind: "omitted" })
  expect(pluginPinOf({ pinned: [] })).toEqual({ kind: "exact", names: [] })
  expect(pluginPinOf({ pinned: ["chat"], pin: { kind: "delta", extra: ["xyne-spaces"], without: null } }))
    .toEqual({ kind: "delta", extra: ["xyne-spaces"], without: null })
})
