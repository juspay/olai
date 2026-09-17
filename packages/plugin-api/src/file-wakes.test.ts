import { expect, test } from "bun:test"
import { Effect } from "effect"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { fileFault, fileWakeFaults, type FileFault } from "./file-wakes.ts"
import type { Deliveries, LocalState } from "./services.ts"

test("file owners distinguish missing files, empty outlines and prose", () => {
  expect(fileFault(TEST_CLAIMS, ["empty.olai", "notes.md"], "empty.olai")).toBeNull()
  expect(fileFault(TEST_CLAIMS, ["notes.md"], "empty.olai")).toBe("gone")
  expect(fileFault(TEST_CLAIMS, ["notes.md"], "notes.md")).toBe("unwatchable")
})
test("file fault announcements persist across restart, heal quietly, and re-check at delivery", async () => {
  let saved: Record<string, unknown> | null = null
  let fault: FileFault | null = null
  let current = true
  let fail = false
  const bodies: Array<() => string | null> = []
  const local: LocalState = { load: Effect.sync(() => saved), save: next => fail ? Effect.fail({ _tag: "read-only" }) : Effect.sync(() => { saved = next }) }
  const deliveries: Deliveries = { scopes: () => [{ agent: "a", session: "s", pick: "work.olai", current: () => current }],
    deliver: (_to, say) => Effect.sync(() => { bodies.push(say) }), notify: () => Effect.void }
  const open = () => Effect.runPromise(fileWakeFaults(local, deliveries, () => fault, { gone: "missing", unwatchable: "wrong kind" }))
  let check = await open()
  await Effect.runPromise(check)
  expect(bodies).toHaveLength(0)
  fault = "gone"
  fail = true
  await Effect.runPromise(check)
  expect(bodies).toHaveLength(0)
  fail = false
  await Effect.runPromise(check)
  expect(bodies[0]!()).toBe("missing")
  check = await open()
  await Effect.runPromise(check)
  expect(bodies).toHaveLength(1)
  fault = "unwatchable"
  await Effect.runPromise(check)
  expect(bodies).toHaveLength(1)
  fault = null
  await Effect.runPromise(check)
  expect(bodies[0]!()).toBeNull()
  fault = "gone"
  await Effect.runPromise(check)
  expect(bodies).toHaveLength(2)
  current = false
  expect(bodies[1]!()).toBeNull()
})
