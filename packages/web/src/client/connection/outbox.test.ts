import { expect, test } from "bun:test"
import type { Entry } from "@olai/log/link"
import { createOutbox, RING_LIMIT } from "./outbox.ts"

const entry = (seq: number): Entry => ({ seq, at: 1_000_000, dial: 1, streak: 0, event: { _tag: "Roster", restarting: [] } })

test("the ring keeps what the server has not taken, and counts what it had to drop", () => {
  const outbox = createOutbox()
  for (let seq = 1; seq <= RING_LIMIT + 5; seq += 1) outbox.put(entry(seq))
  const { entries, lost } = outbox.pending()
  expect(entries).toHaveLength(RING_LIMIT)
  expect(lost).toBe(5)
  expect(entries[0]!.seq).toBe(6)
  outbox.acknowledge(entries[99]!.seq, lost)
  expect(outbox.pending()).toEqual({ entries: entries.slice(100), lost: 0 })
})
