/**
 * WHAT A NODE AGENT IS ASKED TO DO ON ITS OWN TURN, as a value.
 *
 * The instruction is prose an agent reads, so the tests here are about the
 * things that must SURVIVE an edit: the three verbs in order, the verbatim
 * rule, the two things never to do, the fifth cap, the one teaching line
 * restated in front of it, and the ask that hands the whole brief to ONE
 * subagent between two rules. Everything else about the wording is a person's
 * to change.
 */
import { expect, test } from "bun:test"

import type { NodeAgent } from "@olai/format"

import { DELEGATE, SLEEP, briefFor, sleepFor } from "./sleep.ts"
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
  // ... and olai's own bookkeeping is not the agent's to write — named by its
  // ROLE and never by a key: a vault may keep either under a column of its own
  // name (`docs/format.md`), so a literal here would name nothing in exactly the
  // vaults that renamed them, while the ticket refuses the real key whatever it
  // is called.
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
  // THE INSTRUCTION IS IN THE MESSAGE, after the ask: the message now ends on the
  // closing rule line, and the words it hands over are held below.
  expect(said).toContain(SLEEP)
})

test("the turn asks for one subagent before it says what the subagent is to do", () => {
  const said = sleepFor(AGENT)
  const ask = said.indexOf(DELEGATE)
  const opens = said.indexOf("\n----\n")
  // THE ASK IS THE TURN'S OWN PARAGRAPH, and it comes before the brief: the
  // fallback sentence ("do the brief yourself") is the node agent's, not the
  // subagent's, and a subagent that read the rules first would be reading an
  // instruction addressed to somebody else.
  expect(ask).toBeGreaterThan(-1)
  expect(opens).toBeGreaterThan(ask)
})

test("the brief is fenced, whole, and addressed to the subagent", () => {
  const said = sleepFor(AGENT)
  const opens = said.indexOf("\n----\n")
  const closes = said.lastIndexOf("\n----")
  expect(opens).toBeGreaterThan(-1)
  expect(closes).toBeGreaterThan(opens)
  // WHAT IS BETWEEN THE RULES IS THE BRIEF EXACTLY, which is the one part of the
  // wording the ask tells the agent to hand over word for word.
  expect(said.slice(opens + 6, closes)).toBe(briefFor(AGENT))
  const brief = briefFor(AGENT)
  // THE SUBAGENT'S OWN SECOND PERSON, carrying the pointer the node agent's own
  // opening line carries: it has not been taught this node and it sees none of
  // the conversation it was started from.
  expect(brief).toStartWith("You are tidying the memory of the node agent for “Health” — the node `health` in `house.olai`")
  expect(brief).toContain(HARNESS_MEMORY_OFF)
  // ...AND THE INSTRUCTION IS THE SAME WORDS rather than a second version of
  // them: the steps, the verbatim rule, the prohibitions and the silent ending
  // are `SLEEP`'s and are asserted there.
  expect(brief).toEndWith(SLEEP)
})

test("the brief names the rows that moved, and says when the list was cut", () => {
  const moved = Array.from({ length: 44 }, (_, index) => ({ id: `note${index}`, title: `a note ${index}` }))
  const brief = briefFor(AGENT, moved)
  // THE PARAGRAPH IS IN THE BRIEF AND BEFORE THE STEPS: the subagent is the one
  // doing the work, and a list that came after the instructions would be read
  // after the agent had decided what to do.
  const paragraph = brief.indexOf("These are the rows that moved")
  expect(paragraph).toBeGreaterThan(brief.indexOf(HARNESS_MEMORY_OFF))
  expect(paragraph).toBeLessThan(brief.indexOf("1. TIDY"))
  // ...AND IT NAMES ROWS A SUBAGENT CAN POINT AT, with the titles a reader
  // recognises their own memory by.
  expect(brief).toContain("- `note0` — a note 0")
  expect(brief).toContain("- `note39` — a note 39")
  // THE CAP IS FORTY, and what it cut is a COUNT rather than a silence: a memory
  // that moved a hundred rows would otherwise be a brief nobody reads.
  expect(brief).not.toContain("note40")
  expect(brief).toContain("...and 4 more.")
  // ...AND THE REST OF THE SUBTREE IS STILL THEIRS, which is the half that keeps
  // the pass from being an errand: a standing fact is rewritten where the rows
  // that bear on it are.
  expect(brief).toContain("The rest of the subtree is yours to touch only where a standing fact these rows bear on lives.")
  expect(brief).toEndWith(SLEEP)
})

test("a pass nobody had to be due for names no rows at all", () => {
  // `Sleep now` on a memory nothing has happened in: the whole subtree is the
  // person's ask, and a list of nothing would be a paragraph saying nothing.
  const brief = briefFor(AGENT)
  expect(brief).not.toContain("These are the rows that moved")
  expect(brief).toContain(HARNESS_MEMORY_OFF)
  expect(brief).toEndWith(SLEEP)
})
