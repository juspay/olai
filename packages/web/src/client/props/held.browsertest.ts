/**
 * THE FLEET A TAB HOLDS — the fold, and the two things that can go wrong in it.
 *
 * `.browsertest.ts` for `../settled.browsertest.ts`'s reason, which applies to
 * the second half of this file: `bun test` resolves SolidJS's SERVER build,
 * where a memo never re-runs — so the reactivity case would pass having
 * computed nothing.
 *
 * The claims:
 *
 *   1. A SNAPSHOT REPLACES. A terminal killed while the socket was down must
 *      not survive the reconnect: nothing will ever send a remove for it, so if
 *      the re-seed does not drop it, it sits on the page wearing its last face
 *      forever.
 *   2. A BARE REMOVE IS LEGAL. The server's tick coalescer turns an
 *      upsert-then-remove within one tick into a remove with no upsert before
 *      it, so the fold has to be total over keys it has never seen.
 *   3. A CHIP RE-READS WITHOUT RE-SUBSCRIBING — the economy of rung 1. One
 *      fold, one map, N readers; a record moving re-runs the readers' memos and
 *      allocates nothing.
 */

import { expect, test } from "bun:test"
import { createMemo, createRoot, createSignal } from "solid-js"

import type { FleetTerminal } from "@olai/surface"

import { after, type Held, holdingNothing, seeded } from "./held.ts"

const row = (id: string, bucket = "working"): FleetTerminal => ({
  id,
  pip: {
    variant: "working",
    glyph: "claude",
    motion: "pulse",
    active: true,
    asking: false,
    bytesLive: true,
    shellLive: false,
    sleeping: false,
    alert: false,
    alertLabel: "",
  },
  bucket,
  agentState: "thinking",
  label: "",
  labelColor: "",
  subline: { text: "", fromAgent: false },
  pr: null,
  recencyAt: null,
  repo: null,
  owner: { kind: "unowned" },
})

const entries = (...rows: FleetTerminal[]) =>
  rows.map((one) => [one.id, one] as const)

test("a snapshot REPLACES — a row dropped while the link was down does not survive", () => {
  const before = seeded(entries(row("t1"), row("t2")))
  expect([...before.rows.keys()]).toEqual(["t1", "t2"])
  // The link flaps; padi killed t2 in the meantime. The reconnect's snapshot
  // names only t1, and no remove for t2 will ever arrive.
  const reconnected = seeded(entries(row("t1")))
  expect([...reconnected.rows.keys()]).toEqual(["t1"])
})

test("a bare remove of a key never seen is legal, not a throw", () => {
  // The server's coalescer resolves an upsert-then-remove within one tick to a
  // BARE remove, so this frame is what a terminal opened and closed between two
  // ticks actually looks like on the wire.
  const held = after(holdingNothing(), [], ["never-existed"])
  expect(held.rows.size).toBe(0)
  expect(held.at).toBe(1)
})

test("the counter moves on every frame, so a reader has something to depend on", () => {
  const first = seeded(entries(row("t1")))
  const second = after(first, entries(row("t1", "awaiting")), [])
  // SAME MAP — the copy is what this fold exists to avoid.
  expect(second.rows).toBe(first.rows)
  // ...and a different wrapper, which is what a memo compares.
  expect(second.at).toBe(first.at + 1)
  expect(second).not.toBe(first)
})

test("a chip re-reads when its terminal moves, and not when another one does", () => {
  createRoot((dispose) => {
    const [held, setHeld] = createSignal<Held>(seeded(entries(row("t1"), row("t2"))))
    let reads = 0
    // What a chip is: a memo over the map, keyed by ITS id. One per property
    // chip on the page, all of them over one fold.
    const bucket = createMemo(() => {
      reads += 1
      return held().rows.get("t1")?.bucket
    })
    expect(bucket()).toBe("working")
    expect(reads).toBe(1)

    // t1 moves — the chip re-reads.
    setHeld((previous) => after(previous, entries(row("t1", "awaiting")), []))
    expect(bucket()).toBe("awaiting")
    expect(reads).toBe(2)

    // t2 moves. The memo re-runs (the counter moved, which is the whole of
    // what it depends on) and the ANSWER does not — so what a chip actually
    // costs a busy fleet is one map lookup, not a rebuild.
    setHeld((previous) => after(previous, entries(row("t2", "parked")), []))
    expect(bucket()).toBe("awaiting")
    expect(reads).toBe(3)
    dispose()
  })
})
