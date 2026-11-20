import { expect, test } from "bun:test"
import { createMemo, createRoot, createSignal } from "solid-js"

import type { FleetTerminal } from "olai-plugin-kolu/appliance/wire"

import { after, type Held, holdingNothing, seeded } from "./held.ts"

const row = (id: string, bucket = "working"): FleetTerminal => ({
  id,
  pip: {
    variant: "working",
    glyph: "claude-code",
    active: true,
    asking: false,
    bytesLive: true,
    hasAgent: true,
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
  themeName: null,
  owner: { kind: "unowned" },
})

const entries = (...rows: FleetTerminal[]) =>
  rows.map((one) => [one.id, one] as const)

test("a snapshot REPLACES — a row dropped while the link was down does not survive", () => {
  const before = seeded(entries(row("t1"), row("t2")))
  expect([...before.rows.keys()]).toEqual(["t1", "t2"])
  const reconnected = seeded(entries(row("t1")))
  expect([...reconnected.rows.keys()]).toEqual(["t1"])
})

test("a bare remove of a key never seen is legal, not a throw", () => {
  const held = after(holdingNothing(), [], ["never-existed"])
  expect(held.rows.size).toBe(0)
  expect(held.at).toBe(1)
})

test("the counter moves on every frame, so a reader has something to depend on", () => {
  const first = seeded(entries(row("t1")))
  const second = after(first, entries(row("t1", "awaiting")), [])
  expect(second.rows).toBe(first.rows)
  expect(second.at).toBe(first.at + 1)
  expect(second).not.toBe(first)
})

test("a chip re-reads when its terminal moves, and not when another one does", () => {
  createRoot((dispose) => {
    const [held, setHeld] = createSignal<Held>(seeded(entries(row("t1"), row("t2"))))
    let reads = 0
    const bucket = createMemo(() => {
      reads += 1
      return held().rows.get("t1")?.bucket
    })
    expect(bucket()).toBe("working")
    expect(reads).toBe(1)

    setHeld((previous) => after(previous, entries(row("t1", "awaiting")), []))
    expect(bucket()).toBe("awaiting")
    expect(reads).toBe(2)

    setHeld((previous) => after(previous, entries(row("t2", "parked")), []))
    expect(bucket()).toBe("awaiting")
    expect(reads).toBe(3)
    dispose()
  })
})
