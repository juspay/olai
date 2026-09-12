import { expect, test } from "bun:test"
import { byActivity } from "./activity-order.ts"
import { needing } from "./attention-order.ts"
import type { Row } from "./roster.ts"
const row = (id: string, over: Partial<Row> = {}): Row => ({ id, file: "a.olai", title: id, engine: "one", session: id, memory: 0, waiting: 0, standing: "asleep", said: null, ...over })

test("activity keeps every standing; speech leads vault edits and only the sidebar caps it", () => {
  const rows = [row("unbound", { session: null, standing: "unbound", changed: "2026-03-01" }),
    row("sleep", { changed: "2026-02-01" }), row("idle", { standing: "idle", said: { text: "old", at: "2026-01-01" } }),
    row("working", { standing: "working", said: { text: "new", at: "2026-01-02" } }),
    row("waiting", { standing: "needs-you" }), row("gone", { standing: "gone" })]
  expect(byActivity(rows).map(one => one.id)).toEqual(["working", "idle", "unbound", "sleep", "waiting", "gone"])
  expect(byActivity(Array.from({ length: 12 }, (_, i) => row(String(i)))).length).toBe(12)
  expect(rows[0]?.id).toBe("unbound")
})
test("waiting agents lead gone ones, each group newest speech first", () => {
  expect(needing([row("gone", { standing: "gone", said: { text: "", at: "2026-03-01" } }),
    row("old", { standing: "needs-you", said: { text: "", at: "2026-01-01" } }),
    row("new", { standing: "needs-you", said: { text: "", at: "2026-02-01" } }), row("asleep")]).map(one => one.id)).toEqual(["new", "old", "gone"])
})

test("activity compares instants across vault time zones and keeps equal instants stable", () => {
  const older = "2026-09-12T12:00:00+05:00"
  const newer = "2026-09-12T08:00:00Z"
  const same = "2026-09-12T04:00:00-04:00"
  expect(byActivity([row("older", { changed: older }), row("newer", { changed: newer }), row("same", { changed: same })]).map(one => one.id)).toEqual(["newer", "same", "older"])
  expect(needing([row("older", { standing: "needs-you", said: { text: "", at: older } }), row("newer", { standing: "needs-you", said: { text: "", at: newer } })]).map(one => one.id)).toEqual(["newer", "older"])
})
