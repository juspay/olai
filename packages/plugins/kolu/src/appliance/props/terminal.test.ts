import { describe, expect, it } from "bun:test"
import type { FleetTerminal, KoluLink } from "olai-plugin-kolu/appliance/wire"
import { isPipGlyphId, isPipVariant, rowRecency } from "@kolu/solid-dockrow/rowValues"

import { readingOf } from "./terminal.ts"

const link = (over: Partial<KoluLink> = {}): KoluLink => ({
  status: "connected",
  socket: "/run/user/1000/padi-abc/padi.sock",
  told: false,
  stateRoot: "/home/srid/.local/state/kolu",
  surfaceVersion: "5.4",
  speaks: "5.4",
  since: "2026-08-25T12:00:00-04:00",
  ...over,
})

const row = (over: Partial<FleetTerminal> = {}): FleetTerminal => ({
  id: "t1",
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
  bucket: "working",
  agentState: "thinking",
  label: "the terminal door",
  labelColor: "var(--color-fg-3)",
  subline: { text: "the terminal door", fromAgent: true },
  pr: null,
  recencyAt: null,
  repo: "olai",
  themeName: null,
  owner: { kind: "unowned" },
  ...over,
})

const fleetOf = (...rows: FleetTerminal[]): ReadonlyMap<string, FleetTerminal> =>
  new Map(rows.map((one) => [one.id, one]))
const empty: ReadonlyMap<string, FleetTerminal> = new Map()

describe("a terminal property", () => {
  it("hands the row over WHOLE, and folds nothing itself", () => {
    const reading = readingOf("t1", link(), fleetOf(row()))
    expect(reading.row).toEqual(row())
    expect(reading.says).toBe("")
  })

  it("says so IN WORDS when there is no padi — never an empty row", () => {
    const reading = readingOf("t1", link({ status: "absent" }), empty)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toContain("kolu isn't running")
    expect(reading.says).toContain("/run/user/1000/padi-abc/padi.sock")
  })

  it("asks the LINK before the fleet, so an empty fleet is not mistaken for a dead one", () => {
    const noPadi = readingOf("t1", link({ status: "absent" }), empty)
    const noTerminal = readingOf("t1", link(), empty)
    expect(noPadi.row).toBeUndefined()
    expect(noTerminal.row).toBeUndefined()
    expect(noPadi.says).not.toBe(noTerminal.says)
    expect(noTerminal.says).toBe("This terminal was closed.")
  })

  it("names both versions on a skew, because one of the two has to move", () => {
    const reading = readingOf("t1", link({ status: "skew", surfaceVersion: "6.0" }), empty)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toContain("6.0")
    expect(reading.says).toContain("5.4")
  })

  it("says $PADI_SOCKET when that is what pointed nowhere", () => {
    const reading = readingOf("t1", link({ status: "absent", told: true }), empty)
    expect(reading.says).toContain("$PADI_SOCKET")
  })

  it("RESOLVES an eight-character prefix, which is what the board actually writes", () => {
    const full = row({ id: "cb9dcd13-1111-4111-8111-111111111111" })
    expect(readingOf("cb9dcd13", link(), fleetOf(full)).row).toEqual(full)
  })

  it("refuses to guess when a value names more than one, and says how many", () => {
    const two = fleetOf(row({ id: "cb9dcd13-aaaa" }), row({ id: "cb9dcd13-bbbb" }))
    const reading = readingOf("cb9dcd13", link(), two)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toContain("2 terminals")
  })

  it("carries the row behind a drawn one and nothing behind a sentence", () => {
    expect(readingOf("t1", link(), fleetOf(row())).row).toBeDefined()
    expect(readingOf("t1", link({ status: "absent" }), empty).row).toBeUndefined()
  })
})

describe("the unwired reading", () => {
  it("does not say 'Looked at .' when there is no socket to name", () => {
    const reading = readingOf("t1", { ...link(), status: "absent", socket: "" }, empty)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toBe("kolu isn't set up.")
    expect(reading.says).not.toContain("Looked at .")
  })
})

describe("the fixture speaks kolu's vocabulary", () => {
  it("uses pip words that EXIST", () => {
    const { pip } = row()
    expect(isPipVariant(pip.variant)).toBe(true)
    expect(isPipGlyphId(pip.glyph)).toBe(true)
  })
})

describe("the assembled recency bag — the line a row actually renders", () => {
  const AT = 1_700_000_000_000
  const bag = (
    pip: { asking: boolean; active: boolean },
    recencyAt: number | null,
    now: number,
  ) =>
    rowRecency(pip, { window: recencyAt, own: recencyAt }, {
      counting: () => now,
      glancing: () => now,
    })

  it("SAYS HOW LONG AGO a quiet terminal finished", () => {
    const said = bag({ asking: false, active: false }, AT - 3 * 60 * 60 * 1000, AT)
    expect(said.mode).toBe("ago")
    expect(said.mode === "ago" && said.text).toBe("3h ago")
  })

  it("says `just now` for one that finished a moment ago", () => {
    const said = bag({ asking: false, active: false }, AT - 5_000, AT)
    expect(said.mode === "ago" && said.text).toBe("just now")
  })

  it("renders NOTHING for a terminal padi has never seen activity in", () => {
    const said = bag({ asking: false, active: false }, null, AT)
    expect(said.mode === "ago" && said.text).toBe("")
  })

  it("gives an ASKING row the compact capsule off its OWN wait", () => {
    const said = bag({ asking: true, active: false }, AT - 7 * 60 * 1000, AT)
    expect(said.mode).toBe("wait-chip")
    expect(said.mode === "wait-chip" && said.text).toBe("7m")
  })

  it("...and a DASH when that row has no honest duration", () => {
    const said = bag({ asking: true, active: false }, null, AT)
    expect(said.mode === "wait-chip" && said.text).toBe("—")
  })

  it("hides the cell entirely for a working row, with no text at all", () => {
    const said = bag({ asking: false, active: true }, AT - 60_000, AT)
    expect(said).toEqual({ mode: "hidden" })
  })
})
