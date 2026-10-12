/**
 * WHAT A NODE AGENT IS ASKED TO DO ON ITS OWN TURN, as a value.
 *
 * The instruction is prose an agent reads, so the tests here are about the
 * things that must SURVIVE an edit: the three verbs in order, the verbatim
 * rule, the two things never to do, the fifth cap, and the one teaching line
 * restated in front of it. Everything else about the wording is a person's to
 * change.
 */
import { expect, test } from "bun:test"

import type { NodeAgent } from "@olai/format"

import { SLEEP, sleepFor } from "./sleep.ts"
import { HARNESS_MEMORY_OFF } from "./teaching.ts"

const AGENT: NodeAgent = {
  id: "health",
  file: "house.olai",
  title: "Health",
  engine: "claude",
  session: "sess-1",
  memory: 12,
}

test("the instruction keeps the three verbs, in order", () => {
  const tidy = SLEEP.indexOf("1. TIDY")
  const distill = SLEEP.indexOf("2. DISTILL")
  const tuck = SLEEP.indexOf("3. TUCK AWAY")
  expect(tidy).toBeGreaterThan(-1)
  expect(distill).toBeGreaterThan(tidy)
  expect(tuck).toBeGreaterThan(distill)
})

test("the instruction keeps the verbatim rule and the two prohibitions", () => {
  // The one line that restores most of what gist compression loses: numbers,
  // dates, times, doses, measurements and names are copied, never paraphrased.
  expect(SLEEP).toContain("Copy every number, date, time, dose, measurement and name exactly as written")
  // Reversible by construction, which is the whole undo story: one commit.
  expect(SLEEP).toContain("never delete anything")
  expect(SLEEP).toContain("never trash anything")
  expect(SLEEP).toContain("Move only")
  // ... and the keys olai writes are not the agent's to write, which is the
  // refusal its own ticket also carries.
  expect(SLEEP).toContain("`chat-agent-session`")
  expect(SLEEP).toContain("`chat-agent-slept`")
})

test("the instruction keeps the cap, the archive shape and the silent ending", () => {
  expect(SLEEP).toContain("do not change more than about a fifth of the subtree in one sleep")
  expect(SLEEP).toContain("30 days")
  expect(SLEEP).toContain("`Archive`")
  expect(SLEEP).toContain("Do not reply in prose")
})

test("the instruction carries no naming clause, which is the split's whole point", () => {
  // `SLEEP` is the same words for every node agent — the part a test can hold
  // constant — and the pointer is {@link sleepFor}'s. A clause that drifted back
  // into the constant would be a node's title in the words every agent is sent.
  expect(SLEEP).not.toContain("You are the node agent for")
  expect(SLEEP).not.toContain("Health")
})

test("what one agent is sent names it, restates the memory line, and is the instruction", () => {
  const said = sleepFor(AGENT)
  expect(said).toStartWith("[olai] Sleep.")
  expect(said).toContain("“Health”")
  expect(said).toContain("`health`")
  expect(said).toContain("`house.olai`")
  // THE SAME SENTENCE every first turn ends on, not a paraphrase of it: an
  // agent that has been told once is being reminded.
  expect(said).toContain(HARNESS_MEMORY_OFF)
  expect(said).toEndWith(SLEEP)
})
