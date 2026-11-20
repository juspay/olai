import { BROWSER_MODULES, REGISTRY } from "@olai/plugin-build/shared"
import { expect, test } from "bun:test"

import { installSharedModules, sharedModules } from "./shared.ts"

test("this app binds every module the compiler says a browser half may name", () => {
  const held = (globalThis as Record<string, unknown>)[REGISTRY]
  try {
    installSharedModules()
    const table = sharedModules() as unknown as Record<string, unknown>
    expect(Object.keys(table).sort()).toEqual([...BROWSER_MODULES].sort())
    for (const name of BROWSER_MODULES) expect(table[name]).toBeDefined()
  } finally {
    ;(globalThis as Record<string, unknown>)[REGISTRY] = held
  }
})
