import { expect, test } from "bun:test"

import {
  DEFAULT_PLUGIN_NAMES,
  enabled,
  isEnabled,
  PLUGIN_NAMES,
  type PluginWire,
  WIRES,
} from "./surfaces.ts"

const wires: ReadonlyArray<PluginWire> = WIRES

test("the built-in default is the plugins that did not opt out", () => {
  expect(DEFAULT_PLUGIN_NAMES.length).toBeGreaterThan(0)
  for (const wire of wires) {
    if (wire.defaultOn === false) {
      expect(DEFAULT_PLUGIN_NAMES).not.toContain(wire.name)
      expect(isEnabled(null, wire.name)).toBe(false)
    } else {
      expect(DEFAULT_PLUGIN_NAMES).toContain(wire.name)
      expect(isEnabled(null, wire.name)).toBe(true)
    }
  }
})

test("a named pin runs only those plugins, even ones that opt out of the default", () => {
  const optedOut = wires.filter((wire) => wire.defaultOn === false).map((wire) => wire.name)
  expect(optedOut.length).toBeGreaterThan(0)
  const name = optedOut[0] as string
  expect(enabled(wires, [name]).map((p) => p.name)).toEqual([name])
  expect(enabled(wires, []).map((p) => p.name)).toEqual([])
  expect(enabled(wires, [...PLUGIN_NAMES]).map((p) => p.name)).toEqual([...PLUGIN_NAMES])
})
