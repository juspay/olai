/**
 * `--commit`, on both faces, as a truth table and a fence.
 *
 * Two different claims are held here and they are worth telling apart.
 *
 * The TRUTH TABLE is about one function: what `--commit=X` and `--no-commit`
 * come to between them, including the case where a person typed both. That is
 * pure, so it is asserted as values rather than by starting a process.
 *
 * The FENCE is about the two faces, and it is the one this file exists for.
 * the agent face shipped without the flag at all — the tri-state was `olai web`'s
 * alone, so an MCP-driven session could not batch and put four commits into a
 * human's log in fifteen seconds. Nothing failed, because nothing compared the
 * two faces. These tests do: every mode and the default are asserted present on
 * both, and the sentence is asserted to differ in exactly the one clause that is
 * allowed to — which door asks for the commit. A face that quietly grew a fourth
 * mode, lost the default, or started describing a button a terminal has no way
 * to press fails here.
 */

import { expect, test } from "bun:test"

import { COMMIT_BUTTON, COMMIT_MODES, commitDoors, COMMIT_TOOL } from "@olai/ops"
import { commitMode, commitsSaid } from "./commits.ts"

// ── what the two flags come to between them ────────────────────────────

test("the default is manual: a write lands and waits to be asked about", () => {
  expect(commitMode("manual", false)).toBe("manual")
})

test("each mode passes through when it is the only thing said", () => {
  for (const mode of COMMIT_MODES) {
    expect(commitMode(mode, false)).toBe(mode)
  }
})

/**
 * The one case with a decision in it.
 *
 * A person who typed both said "off" once and something else once, and the
 * opt-out is the reading that cannot surprise them: honouring `--commit=auto`
 * would write to a history they had asked olai to stay out of, which is the one
 * mistake here that trying again does not undo.
 */
test("--no-commit wins over every mode, because it is the one that turns something off", () => {
  for (const mode of COMMIT_MODES) {
    expect(commitMode(mode, true)).toBe("off")
  }
})

test("the modes are exactly three, and `off` is what --no-commit means", () => {
  expect([...COMMIT_MODES]).toEqual(["off", "manual", "auto"])
})

// ── the two faces do not diverge ───────────────────────────────────────

test("both faces advertise every mode, so neither can quietly grow or lose one", () => {
  for (const face of ["web", "mcp"] as const) {
    const said = commitsSaid(face)
    for (const mode of COMMIT_MODES) expect(said).toContain(mode)
    // The default is stated, not left to be discovered by running it.
    expect(said).toContain("the default")
  }
})

/**
 * Each face names every door it actually has — no more, and NO FEWER.
 *
 * The "no fewer" half is the one that was got wrong. `olai web` hands its own
 * panel agent the same `commit` tool an outside agent gets, so a web serve
 * really does have both doors, and a help text naming only the button leaves out
 * something true. A terminal agent has no browser, so naming the button there sends a
 * person after a control they have not got. Both are the same mistake pointed
 * two ways, and only asserting the exact SET catches both — an earlier version
 * of this test compared the two sentences modulo one substitution, which could
 * never have noticed web under-describing itself.
 *
 * The phrases come from the one table rather than being spelled again here: a
 * test carrying its own copy of the thing under test is the drift it exists to
 * catch, one layer up.
 */
test("each face names every door it has, and no door it has not", () => {
  const named = (said: string) =>
    [COMMIT_BUTTON, COMMIT_TOOL].filter((door) => said.includes(door)).sort()

  // The browser: a button, and the tool its own panel agent is handed.
  expect(named(commitsSaid("web"))).toEqual([COMMIT_BUTTON, COMMIT_TOOL].sort())
  // A terminal: the tool, and nothing to press.
  expect(named(commitsSaid("mcp"))).toEqual([COMMIT_TOOL])
})

/** And the rest of the sentence is one rule described once — everything either
 *  face says apart from its doors is the same words, so a second divergence
 *  sneaking into the wording fails here. */
test("apart from the doors, both faces say the same thing", () => {
  const withoutDoors = (face: "web" | "mcp") =>
    commitsSaid(face).replace(commitDoors(face), "…")
  expect(withoutDoors("web")).toBe(withoutDoors("mcp"))
})
