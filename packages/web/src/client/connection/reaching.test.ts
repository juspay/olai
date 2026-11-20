import { expect, test } from "bun:test"

import { reachable } from "./reaching.ts"
import type { SurfaceReadout, SurfaceReadoutStatus } from "./status.ts"

const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false, presentingDown: false }
    : { status, needsReload: status === "retired", presentingDown: false }

test("a wire that cannot carry a question freezes the app", () => {
  for (const status of ["connecting", "reconnecting", "retired"] as const) {
    expect(reachable(readoutOf(status))).toBe(false)
  }
})

test("a live socket carries a question, degraded or not", () => {
  expect(reachable(readoutOf("live"))).toBe(true)
  expect(reachable(readoutOf("degraded"))).toBe(true)
})
