import { expect, test } from "bun:test"

import { annotated } from "./prompt.ts"
import { HARNESS_MEMORY_OFF, NOTE_REMINDER, REMINDER, REMINDING, remindingFor, teachingFor } from "./teaching.ts"

const SPACES = {
  kind: "node" as const,
  beside: false,
  id: "spaces",
  title: "Xyne Spaces — the org OS",
  file: "lanes.olai",
  engine: "grok",
  session: "sess-1",
  memory: 14,
}

test("it names the node, by title and by the id a read would take", () => {
  const [who] = teachingFor(SPACES)
  expect(who).toContain("Xyne Spaces — the org OS")
  expect(who).toContain("spaces")
  expect(who).toContain("lanes.olai")
})

test("the node's own note is the charter, and it overrides the defaults", () => {
  const [who] = teachingFor(SPACES)
  expect(who).toContain("own note is your charter")
  expect(who).toContain("overrides everything below")
})

test("the trigger comes before the shape, and it is negative: answer, and write only on a durable fact", () => {
  const [, trigger, shape] = teachingFor(SPACES)
  expect(trigger).toContain("SUBTREE is your knowledge base, organized by topic (14 rows)")
  expect(trigger).toContain("Answer first")
  expect(trigger).toContain("only when a durable fact changed")
  expect(trigger).toContain("Never record messages, questions, your own actions")
  expect(shape).toContain("One node per fact")
  expect(shape).toContain("update the node that already holds a fact")
  expect(shape).toContain("create a node only for a fact that is new")
})

test("a node agent with nothing under it yet is told so, not told it has zero", () => {
  const [, trigger] = teachingFor({ ...SPACES, memory: 0 })
  expect(trigger).toContain("nothing under it yet")
  expect(trigger).not.toContain("0 rows")
})

test("one row is `1 row`", () => {
  expect(teachingFor({ ...SPACES, memory: 1 })[1]).toContain("(1 row)")
})

test("\"memory\" is said only where it means the engine's own — never as the subtree's job", () => {
  const saying = teachingFor(SPACES).filter((line) => /memory/i.test(line))
  expect(saying).toEqual([`[olai] ${HARNESS_MEMORY_OFF}`])
  expect(REMINDER).not.toMatch(/memory/i)
})

test("every line is an `[olai] ` line, and the contract ends on the engine's memory being off", () => {
  const lines = teachingFor(SPACES)
  for (const line of lines) expect(line.startsWith("[olai] ")).toBe(true)
  expect(lines.at(-1)).toBe(`[olai] ${HARNESS_MEMORY_OFF}`)
})

test("the LAW is the same lines word for word under every node", () => {
  const opened = teachingFor(SPACES)
  const other = teachingFor({ id: "odu", kind: "node", beside: false, title: "Odu", file: "ci.olai", engine: "opus", session: null, memory: 14 })
  expect(other[0]).not.toBe(opened[0])
  expect(other.slice(1)).toEqual(opened.slice(1))
})

test("the reminder is ONE sentence, carrying the trigger and the shape", () => {
  expect(REMINDER.includes("\n")).toBe(false)
  expect(REMINDER).toContain("only when a durable fact changed")
  expect(REMINDER).toContain("update the node that holds it")
  expect(REMINDER).toContain("never record messages")
})

test("... and it rides as ONE `[olai] ` line, the shape every teaching line has", () => {
  expect(REMINDING).toEqual([`[olai] ${REMINDER}`])
  expect(teachingFor(SPACES).at(-1)).toBe(`[olai] ${HARNESS_MEMORY_OFF}`)
})

test("under a message it rides the seam every other annotation rides", () => {
  const said = annotated("what is blocking the connector?", teachingFor(SPACES))
  expect(said.startsWith("what is blocking the connector?\n\n[olai] ")).toBe(true)
  expect(annotated("and now?", REMINDING)).toBe(`and now?\n\n[olai] ${REMINDER}`)
})

const PLAN = {
  kind: "note" as const,
  id: "/notes/plan.md",
  title: "plan",
  file: "notes/plan.md",
  engine: "claude",
  session: "sess-2",
  memory: 0,
  beside: false,
}

test("a note's agent is told whose note it is, that it IS the memory, and to read it", () => {
  const lines = teachingFor(PLAN)
  expect(lines).toHaveLength(4)
  expect(lines[0]).toContain("notes/plan.md")
  expect(lines[0]).toContain("plan")
  expect(lines[1]).toContain("markdown_read")
  expect(lines[1]).toContain("notes/plan.md")
})

test("...and that it is the person's file: changed only when asked, front matter untouched", () => {
  const [, , theirs] = teachingFor(PLAN)
  expect(theirs).toContain("only when they ask")
  expect(theirs).toContain("front-matter")
})

test("a note is told nothing about a subtree, a write trigger or a shape", () => {
  const lines = teachingFor(PLAN).join("\n")
  expect(lines).not.toContain("SUBTREE")
  expect(lines).not.toContain("One node per fact")
  expect(lines).not.toContain("sleep")
})

test("the reminder a chat gets is the one its own contract is about", () => {
  expect(remindingFor(SPACES)).toEqual(REMINDING)
  expect(remindingFor(PLAN)).toEqual([`[olai] ${NOTE_REMINDER}`])
  expect(remindingFor(PLAN)[0]).toContain("read the note again")
})
