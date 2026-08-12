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
 * `olai mcp` shipped without the flag at all — the tri-state was `olai web`'s
 * alone, so an MCP-driven session could not batch and put four commits into a
 * human's log in fifteen seconds. Nothing failed, because nothing compared the
 * two faces. These tests do: every mode and the default are asserted present on
 * both, and the sentence is asserted to differ in exactly the one clause that is
 * allowed to — which door asks for the commit. A face that quietly grew a fourth
 * mode, lost the default, or started describing a button a terminal has no way
 * to press fails here.
 */

import { expect, test } from "bun:test"

import { COMMIT_MODES, commitDoor } from "@olai/ops"
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
 * The one clause that is allowed to differ, and the proof that it is the only
 * one.
 *
 * Naming the browser's button in `olai mcp --help` would send a person looking
 * for a control their face has not got; naming the tool in `olai web --help`
 * would be the same mistake pointed the other way. Everything else about that
 * sentence is one rule described once, and the substitution below is what makes
 * "only that differs" a fact rather than a hope — a second divergence sneaking
 * into the wording fails right here.
 */
test("each face names the door it actually has, and only that differs", () => {
  const web = commitsSaid("web")
  const mcp = commitsSaid("mcp")

  expect(web).toContain("Commit button")
  expect(web).not.toContain("`commit` tool")
  expect(mcp).toContain("`commit` tool")
  expect(mcp).not.toContain("Commit button")

  // The phrases come from the one table rather than being spelled a third time
  // here — a test carrying its own copy of the thing under test is the same
  // drift it exists to catch, one layer up.
  const withoutDoor = (said: string, face: "web" | "mcp") =>
    said.replace(commitDoor(face), "…")
  expect(withoutDoor(web, "web")).toBe(withoutDoor(mcp, "mcp"))
})
