import { expect, test } from "bun:test"
import type { Cause } from "@olai/log/link"
import { causeOf, type DropFacts } from "./cause.ts"

const none: DropFacts = { pageClosed: true, overCap: false, stale: false, intent: undefined }

const table: ReadonlyArray<readonly [string, Partial<DropFacts>, Cause]> = [
  ["the peer closed it", { pageClosed: false }, "peer-closed"],
  ["a frame over the cap", { overCap: true }, "frame-over-cap"],
  ["the heartbeat gave up", { stale: true }, "half-open"],
  ["olai refreshed it for a roster change", { intent: "roster-refresh" }, "roster-refresh"],
  ["olai redialled", { intent: "redial" }, "redial"],
  ["the page went away", { intent: "unload" }, "unload"],
  ["nothing the page saw", {}, "severed"],
  // The precedence pairs: the stronger evidence wins.
  ["a peer's close over everything the page saw", { pageClosed: false, overCap: true, stale: true, intent: "redial" }, "peer-closed"],
  ["a frame over the cap over a heartbeat", { overCap: true, stale: true }, "frame-over-cap"],
  ["the heartbeat over a declared close", { stale: true, intent: "roster-refresh" }, "half-open"],
]

test.each(table)("%s", (_, facts, cause) => {
  expect(causeOf({ ...none, ...facts })).toBe(cause)
})
