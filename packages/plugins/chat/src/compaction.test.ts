import { expect, test } from "bun:test"
import { compactionTrace, type CompactionObservation } from "./compaction.ts"
import { Transcript } from "./transcript.ts"

test("compaction diagnostics follow continuation once, ignoring steering and repeated updates", () => {
  const events: CompactionObservation[] = []
  const trace = compactionTrace((event) => events.push(event))
  const transcript = new Transcript()
  const take = (change: ReturnType<Transcript["say"]>) => {
    for (const [, row] of change.upserts) trace.row(row)
  }
  take(transcript.tool("compact", { title: "Compact conversation", status: "in_progress" }))
  take(transcript.tool("compact", { status: "completed" }))
  take(transcript.tool("compact", { status: "completed" }))
  take(transcript.userSaid("private steering text"))
  expect(events.map((event) => event.phase)).toEqual(["started", "completed"])
  take(transcript.say("private continuation text"))
  take(transcript.say(" more"))
  take(transcript.settle())
  expect(events.map((event) => event.phase)).toEqual(["started", "completed", "continued"])
  expect(JSON.stringify(events)).not.toContain("private")
  trace.reset()
  take(transcript.say("another session"))
  expect(events).toHaveLength(3)
})

test("a reconnect snapshot includes compaction and continuation without requiring its start event", () => {
  const transcript = new Transcript()
  transcript.tool("compact", { title: "Compact conversation", status: "completed" })
  transcript.say("continued")
  transcript.settle()
  const events: CompactionObservation[] = []
  const trace = compactionTrace((event) => events.push(event))
  for (const row of transcript.entries().values()) trace.row(row)
  expect(events.map((event) => event.phase)).toEqual(["started", "completed", "continued"])
})
