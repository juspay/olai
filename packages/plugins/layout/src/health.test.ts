/**
 * The health dot's fold: worst tone wins, `quiet` never colours it, and the
 * name quotes each readout's own label, alarms first.
 */
import { expect, test } from "bun:test"

import type { SurfaceReadout } from "@olai/web/client/connection/status.ts"

import { connectionStatus, nameOf, tipOf, worstOf } from "./health.ts"
import type { BarStatus } from "./slots.ts"

const live: SurfaceReadout = { status: "live", needsReload: false }
const reconnecting: SurfaceReadout = { status: "reconnecting", needsReload: false }

test("nothing standing, and nothing but quiet rows, is healthy", () => {
  expect(worstOf([])).toBe("healthy")
  expect(worstOf([{ tone: "quiet", label: "Not a git folder" }, { tone: "quiet", label: "No kolu" }])).toBe("healthy")
  expect(nameOf([{ tone: "quiet", label: "Not a git folder" }])).toBe("Status: all good")
})

test("the worst tone wins, whatever order the rows stand in", () => {
  const notice: BarStatus = { tone: "notice", label: "3 uncommitted" }
  const alarm: BarStatus = { tone: "alarm", label: "kolu skew" }
  expect(worstOf([notice, { tone: "healthy", label: "Connected" }])).toBe("notice")
  expect(worstOf([notice, alarm])).toBe("alarm")
  expect(worstOf([alarm, notice])).toBe("alarm")
})

test("the name quotes the news in the readouts' own words, alarms first", () => {
  const statuses: ReadonlyArray<BarStatus> = [
    { tone: "notice", label: "3 uncommitted" },
    { tone: "healthy", label: "kolu" },
    connectionStatus(reconnecting),
  ]
  expect(nameOf(statuses)).toBe("Status: Reconnecting… · 3 uncommitted")
  expect(tipOf(statuses).split("\n")[1]).toBe("Reconnecting… — Connection lost. What you see may be out of date.")
})

test("the connection is healthy only while live", () => {
  expect(connectionStatus(live).tone).toBe("healthy")
  expect(connectionStatus({ status: "connecting", needsReload: false }).tone).toBe("notice")
  expect(connectionStatus(reconnecting).tone).toBe("alarm")
  expect(connectionStatus({ status: "retired", needsReload: true }).tone).toBe("alarm")
  expect(connectionStatus({ status: "degraded", stopped: ["documents.keys"], needsReload: false }).tone).toBe("alarm")
})
