/**
 * THE TERMINAL PROPERTY'S READING — and the one confusion it exists to prevent.
 *
 * The claim under test is not "the row is green when an agent is working": the
 * row is kolu's and kolu's tests own it. It is that OLAI CANNOT SEE and OLAI
 * LOOKED AND IT IS QUIET never draw the same thing. A row drawn for an
 * unreachable padi would be a lie told once per lane, on a page somebody is
 * using to decide what to do next — so every arm without a row carries a
 * sentence, and no two of those sentences are the same.
 */

import { describe, expect, it } from "bun:test"
import type { FleetTerminal, KoluLink } from "@olai/surface"
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
    shellLive: false,
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
    // The wire carries what kolu's row asks for; nothing here re-derives any
    // of it. A browser that folded kolu's states for itself would be the
    // second switch kolu's own vocabulary exists to prevent, one wire further
    // out — which is what the deleted `DotFace` was.
    const reading = readingOf("t1", link(), fleetOf(row()))
    expect(reading.row).toEqual(row())
    expect(reading.says).toBe("")
  })

  it("says so IN WORDS when there is no padi — never an empty row", () => {
    const reading = readingOf("t1", link({ status: "absent" }), empty)
    expect(reading.row).toBeUndefined()
    // The whole point: a reader must not be able to mistake this for "quiet".
    expect(reading.says).toContain("no padi is running")
    expect(reading.says).toContain("/run/user/1000/padi-abc/padi.sock")
  })

  it("asks the LINK before the fleet, so an empty fleet is not mistaken for a dead one", () => {
    // A healthy kolu with nothing open has an empty fleet too. A reading that
    // looked the terminal up first would say "retired" for every lane on a
    // laptop that simply is not running kolu — the same silence, a completely
    // different fact.
    const noPadi = readingOf("t1", link({ status: "absent" }), empty)
    const noTerminal = readingOf("t1", link(), empty)
    expect(noPadi.row).toBeUndefined()
    expect(noTerminal.row).toBeUndefined()
    // Same shape, different sentence — which is the distinction that decides
    // what a reader does next.
    expect(noPadi.says).not.toBe(noTerminal.says)
    expect(noTerminal.says).toContain("no longer in the fleet")
  })

  it("names both versions on a skew, because one of the two has to move", () => {
    const reading = readingOf("t1", link({ status: "skew", surfaceVersion: "6.0" }), empty)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toContain("6.0")
    expect(reading.says).toContain("5.4")
  })

  it("says $PADI_SOCKET when that is what pointed nowhere", () => {
    // "your variable points nowhere" and "no padi is running" are two different
    // things to go and fix, and `told` is the only thing that can tell them
    // apart.
    const reading = readingOf("t1", link({ status: "absent", told: true }), empty)
    expect(reading.says).toContain("$PADI_SOCKET")
  })

  it("RESOLVES an eight-character prefix, which is what the board actually writes", () => {
    // The vault's own convention writes a bare id — eight characters — far more
    // often than a whole uuid, and an exact lookup answered nothing for every
    // one of them: a working terminal drawn as retired, which is what the human
    // found in production.
    const full = row({ id: "cb9dcd13-1111-4111-8111-111111111111" })
    expect(readingOf("cb9dcd13", link(), fleetOf(full)).row).toEqual(full)
  })

  it("refuses to guess when a value names more than one, and says how many", () => {
    const two = fleetOf(row({ id: "cb9dcd13-aaaa" }), row({ id: "cb9dcd13-bbbb" }))
    const reading = readingOf("cb9dcd13", link(), two)
    expect(reading.row).toBeUndefined()
    // The count is what makes the next move obvious: write more of the id.
    expect(reading.says).toContain("2 terminals")
  })

  it("carries the row behind a drawn one and nothing behind a sentence", () => {
    expect(readingOf("t1", link(), fleetOf(row())).row).toBeDefined()
    expect(readingOf("t1", link({ status: "absent" }), empty).row).toBeUndefined()
  })
})

describe("the unwired reading", () => {
  it("does not say 'olai looked at .' when there is no socket to name", () => {
    // A run drawn outside the fleet provider gets `KOLU_UNDIALED`, whose socket
    // is the empty string — a document's frontmatter, a test that mounts a
    // chip, and the first instant of a server's life. The naming sentence would
    // send a reader hunting for a path that is not there.
    const reading = readingOf("t1", { ...link(), status: "absent", socket: "" }, empty)
    expect(reading.row).toBeUndefined()
    expect(reading.says).toBe("olai is not watching a padi here.")
    expect(reading.says).not.toContain("looked at .")
  })
})

describe("the fixture speaks kolu's vocabulary", () => {
  it("uses pip words that EXIST", () => {
    // THE DRIFT THIS EXISTS TO CATCH, which was live and green: the fixture
    // said glyph `"claude"` and motion `"pulse"`. Neither is a kolu word —
    // the glyph set is the agent kinds plus `"shell"` (olai's own roster
    // spells the agent `claude`, kolu's is `claude-code`, so it was a
    // namespace collision rather than a typo) and the motions are
    // `spin | glow | none`. It compiled because olai's wire types these as
    // plain strings and narrows at the render site — which is the right wire
    // decision and exactly why a FIXTURE has to be checked against the guards
    // instead of trusted to the compiler.
    const { pip } = row()
    expect(isPipVariant(pip.variant)).toBe(true)
    expect(isPipGlyphId(pip.glyph)).toBe(true)
  })
})

describe("the assembled recency bag — the line a row actually renders", () => {
  // THE GAP THIS CLOSES, and it is why the assertion is on the assembled bag
  // rather than on a formatter: the round's regression was a wrong ARGUMENT at
  // one call site, not a wrong function. Every unit under it was correct, the
  // types were satisfied, and an idle terminal silently stopped saying how long
  // ago it finished. Nothing in the tree asserted an `ago` string anywhere.
  const AT = 1_700_000_000_000
  const bag = (
    pip: { asking: boolean; active: boolean },
    recencyAt: number | null,
    now: number,
  ) => rowRecency(pip, recencyAt, recencyAt, { tick: () => now, stable: () => now })

  it("SAYS HOW LONG AGO a quiet terminal finished", () => {
    // The regression, exactly: this rendered "" while `null` went down the
    // window channel, because `displayRecencyAt` routes every non-chip mode
    // there. Three hours of silence is the case a reader most wants the row to
    // answer, and it was the case that went blank.
    const said = bag({ asking: false, active: false }, AT - 3 * 60 * 60 * 1000, AT)
    expect(said.mode).toBe("ago")
    expect(said.mode === "ago" && said.text).toBe("3h ago")
  })

  it("says `just now` for one that finished a moment ago", () => {
    const said = bag({ asking: false, active: false }, AT - 5_000, AT)
    expect(said.mode === "ago" && said.text).toBe("just now")
  })

  it("renders NOTHING for a terminal padi has never seen activity in", () => {
    // Empty is right HERE — on a line, absence reads as absence. It is only
    // the violet capsule that may not be empty, which is the next case.
    const said = bag({ asking: false, active: false }, null, AT)
    expect(said.mode === "ago" && said.text).toBe("")
  })

  it("gives an ASKING row the compact capsule off its OWN wait", () => {
    const said = bag({ asking: true, active: false }, AT - 7 * 60 * 1000, AT)
    expect(said.mode).toBe("wait-chip")
    expect(said.mode === "wait-chip" && said.text).toBe("7m")
  })

  it("...and a DASH when that row has no honest duration", () => {
    // kolu's rule: a violet pill with no glyph reads as a rendering bug rather
    // than as "unknown".
    const said = bag({ asking: true, active: false }, null, AT)
    expect(said.mode === "wait-chip" && said.text).toBe("—")
  })

  it("hides the cell entirely for a working row, with no text at all", () => {
    // The `hidden` arm carries no `text` key — a type-level rule the old
    // hand-written assembly had to restate and could have got wrong.
    const said = bag({ asking: false, active: true }, AT - 60_000, AT)
    expect(said).toEqual({ mode: "hidden" })
  })
})
