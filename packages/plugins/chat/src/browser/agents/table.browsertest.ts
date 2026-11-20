import { expect, test } from "bun:test"
import { createEffect, createRoot, createSignal } from "solid-js"

import type { NodeAgentRow } from "../../wire.ts"
import type { Row } from "./roster.ts"
import { createRosterTable } from "./table.ts"

const row = (id: string, standing: NodeAgentRow["standing"]): Row =>
  ({
    id, title: id, file: "lanes.olai", engine: "claude", session: `${id}-session`,
    standing, waiting: 0, said: null, seen: null, sleeps: false, sleep: null, unread: false,
  } as unknown as Row)

test("a roster frame that moves one agent wakes that agent's readers alone", () => {
  const woke = { a: 0, b: 0, missing: 0 }
  const owner = createRoot(dispose => {
    const [rows, setRows] = createSignal<ReadonlyArray<Row>>([row("a", "idle"), row("b", "idle")])
    const table = createRosterTable(rows)
    createEffect(() => { table.at("a")?.standing; woke.a++ })
    createEffect(() => { table.at("b")?.standing; woke.b++ })
    createEffect(() => { table.at("c"); woke.missing++ })
    return { dispose, table, setRows }
  })
  try {
    expect(owner.table.at("a")?.standing).toBe("idle")
    expect(woke).toEqual({ a: 1, b: 1, missing: 1 })

    owner.setRows([row("a", "idle"), row("b", "working")])
    expect(owner.table.at("b")?.standing).toBe("working")
    expect(woke).toEqual({ a: 1, b: 2, missing: 1 })

    owner.setRows([row("a", "idle"), row("b", "working")])
    expect(woke).toEqual({ a: 1, b: 2, missing: 1 })

    owner.setRows([row("a", "idle")])
    expect(owner.table.at("b")).toBeUndefined()
    expect(woke).toEqual({ a: 1, b: 3, missing: 1 })

    owner.setRows([row("a", "idle"), row("c", "asleep")])
    expect(woke).toEqual({ a: 1, b: 3, missing: 2 })

    owner.setRows([{ ...row("a", "idle"), unopened: true } as Row, row("c", "asleep")])
    expect(owner.table.at("a")?.unopened).toBe(true)
    owner.setRows([row("a", "idle"), row("c", "asleep")])
    expect(owner.table.at("a")?.unopened).toBeUndefined()
  } finally { owner.dispose() }
})
