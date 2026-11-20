import { expect, test } from "bun:test"

import type { NodeAgent } from "@olai/format"

import { DELEGATE, SLEEP, briefFor, sleepFor } from "./sleep.ts"
import { HARNESS_MEMORY_OFF } from "./teaching.ts"

const AGENT: NodeAgent = {
  kind: "node",
  beside: false,
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
  expect(SLEEP).toContain("Copy every number, date, time, dose, measurement and name exactly as written")
  expect(SLEEP).toContain("never delete anything")
  expect(SLEEP).toContain("never trash anything")
  expect(SLEEP).toContain("Move only")
  expect(SLEEP).toContain("do not write the property olai seats a conversation on")
  expect(SLEEP).toContain("the one it records a sleep under")
  expect(SLEEP).not.toContain("chat-agent-slept")
})

test("the instruction keeps the cap, the archive shape and the silent ending", () => {
  expect(SLEEP).toContain("do not change more than about a fifth of the subtree in one sleep")
  expect(SLEEP).toContain("30 days")
  expect(SLEEP).toContain("`Archive`")
  expect(SLEEP).toContain("Do not reply in prose")
})

test("the instruction carries no naming clause, which is the split's whole point", () => {
  expect(SLEEP).not.toContain("You are the node agent for")
  expect(SLEEP).not.toContain("Health")
})

test("what one agent is sent names it, restates the memory line, and is the instruction", () => {
  const said = sleepFor(AGENT)
  expect(said).toStartWith("[olai] Sleep.")
  expect(said).toContain("“Health”")
  expect(said).toContain("`health`")
  expect(said).toContain("`house.olai`")
  expect(said).toContain(HARNESS_MEMORY_OFF)
  expect(said).toContain(SLEEP)
})

test("the sleep turn speaks the teaching's vocabulary: \"memory\" only where it means the engine's own", () => {
  const said = sleepFor(AGENT, [{ id: "note0", title: "a note 0" }])
  expect(said).toContain("its subtree is your knowledge base")
  expect(said.split(HARNESS_MEMORY_OFF).join("")).not.toMatch(/memory/i)
})

test("the turn asks for one subagent before it says what the subagent is to do", () => {
  const said = sleepFor(AGENT)
  const ask = said.indexOf(DELEGATE)
  const opens = said.indexOf("\n----\n")
  expect(ask).toBeGreaterThan(-1)
  expect(opens).toBeGreaterThan(ask)
})

test("the brief is fenced, whole, and addressed to the subagent", () => {
  const said = sleepFor(AGENT)
  const opens = said.indexOf("\n----\n")
  const closes = said.lastIndexOf("\n----")
  expect(opens).toBeGreaterThan(-1)
  expect(closes).toBeGreaterThan(opens)
  expect(said.slice(opens + 6, closes)).toBe(briefFor(AGENT))
  const brief = briefFor(AGENT)
  expect(brief).toStartWith("You are tidying the knowledge base of the node agent for “Health” — the node `health` in `house.olai`")
  expect(brief).toContain(HARNESS_MEMORY_OFF)
  expect(brief).toEndWith(SLEEP)
})

test("the brief names the rows that moved, and says when the list was cut", () => {
  const moved = Array.from({ length: 44 }, (_, index) => ({ id: `note${index}`, title: `a note ${index}` }))
  const brief = briefFor(AGENT, moved)
  const paragraph = brief.indexOf("These are the rows that moved")
  expect(paragraph).toBeGreaterThan(brief.indexOf(HARNESS_MEMORY_OFF))
  expect(paragraph).toBeLessThan(brief.indexOf("1. TIDY"))
  expect(brief).toContain("- `note0` — a note 0")
  expect(brief).toContain("- `note39` — a note 39")
  expect(brief).not.toContain("note40")
  expect(brief).toContain("...and 4 more.")
  expect(brief).toContain("The rest of the subtree is yours to touch only where a standing fact these rows bear on lives.")
  expect(brief).toEndWith(SLEEP)
})

test("a pass nobody had to be due for names no rows at all", () => {
  const brief = briefFor(AGENT)
  expect(brief).not.toContain("These are the rows that moved")
  expect(brief).toContain(HARNESS_MEMORY_OFF)
  expect(brief).toEndWith(SLEEP)
})
