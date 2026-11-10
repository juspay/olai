import { expect, test } from "bun:test"
import { byActivity } from "./activity-order.ts"
import { needing } from "./attention-order.ts"
import type { Row } from "./roster.ts"
const row = (id: string, over: Partial<Row> = {}): Row => ({ id, file: "a.olai", title: id, engine: "one", session: id, memory: 0, waiting: 0, standing: "asleep", said: null, seen: null, unread: false, sleeps: false, sleep: null, ...over })

test("what is awake leads, in standing order, and everything else follows by recency", () => {
  const rows = [row("unbound", { session: null, standing: "unbound", changed: "2026-03-01" }),
    row("sleep", { changed: "2026-02-01" }), row("idle", { standing: "idle", said: { text: "old", at: "2026-01-01" } }),
    row("working", { standing: "working", said: { text: "new", at: "2026-01-02" } }),
    row("waiting", { standing: "needs-you" }), row("gone", { standing: "gone" })]
  // THE QUESTION THE COLUMN HAS TO ANSWER is which agents are awake, because
  // only eight may be at once. So the four awake standings lead in the order a
  // person cares about them — wants you, busy, starting, ready — and the
  // newest-speech rule they used to share with everything else now decides
  // only the order WITHIN a band. `idle` leads `unbound` here despite being
  // the older row, which under the old sort it did not.
  expect(byActivity(rows).map(one => one.id)).toEqual(["waiting", "working", "idle", "unbound", "sleep", "gone"])
  // SORTING NEVER FILTERS, and the cap is the sidebar's (`./Agents.tsx`): an
  // awake row older than ten sleeping ones still comes back, at the top.
  const crowded = [...Array.from({ length: 12 }, (_, i) => row(`sleep-${i}`, { changed: `2026-04-${String(i + 1).padStart(2, "0")}` })),
    row("old-but-awake", { standing: "idle", changed: "2020-01-01" })]
  expect(byActivity(crowded).length).toBe(13)
  expect(byActivity(crowded)[0]?.id).toBe("old-but-awake")
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
