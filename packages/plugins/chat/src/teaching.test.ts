/**
 * WHAT AN AGENT-ASSOCIATED SESSION IS TOLD.
 *
 * The words themselves are asserted rather than merely their shape, because the
 * words ARE the feature: the whole of node agents rests on the agent writing a
 * durable fact into its subtree and nothing else, and a line that stopped
 * saying so would break nothing anywhere else in this repo.
 */

import { expect, test } from "bun:test"

import { annotated } from "./prompt.ts"
import { HARNESS_MEMORY_OFF, REMINDER, REMINDING, teachingFor } from "./teaching.ts"

const SPACES = {
  id: "spaces",
  title: "Xyne Spaces — the org OS",
  file: "lanes.olai",
  engine: "grok",
  session: "sess-1",
  memory: 14,
}

const ARRIVALS = ["opened", "assigned"] as const

test("it names the node, by title and by the id a read would take", () => {
  const [who] = teachingFor(SPACES)
  expect(who).toContain("Xyne Spaces — the org OS")
  expect(who).toContain("spaces")
  expect(who).toContain("lanes.olai")
})

test("the node's own note is the charter, and it overrides the defaults, under both arrivals", () => {
  for (const how of ARRIVALS) {
    const [who] = teachingFor(SPACES, how)
    expect(who).toContain("own note is your charter")
    expect(who).toContain("overrides everything below")
  }
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
  for (const how of ARRIVALS) {
    const [, trigger] = teachingFor({ ...SPACES, memory: 0 }, how)
    expect(trigger).toContain("nothing under it yet")
    expect(trigger).not.toContain("0 rows")
  }
})

test("one row is `1 row`", () => {
  expect(teachingFor({ ...SPACES, memory: 1 })[1]).toContain("(1 row)")
})

test("\"memory\" is said only where it means the engine's own — never as the subtree's job", () => {
  // The word the old contract leaned on five times, and the reason an agent
  // filed a node per message: told its subtree was its memory, it remembered
  // everything.
  for (const how of ARRIVALS) {
    const lines = teachingFor(SPACES, how)
    const saying = lines.filter((line) => /memory/i.test(line))
    expect(saying).toEqual([`[olai] ${HARNESS_MEMORY_OFF}`])
  }
  expect(REMINDER).not.toMatch(/memory/i)
})

test("every line is an `[olai] ` line, and the contract ends on the engine's memory being off", () => {
  for (const how of ARRIVALS) {
    const lines = teachingFor(SPACES, how)
    for (const line of lines) expect(line.startsWith("[olai] ")).toBe(true)
    expect(lines.at(-1)).toBe(`[olai] ${HARNESS_MEMORY_OFF}`)
  }
})

test("the LAW is the same lines word for word under both arrivals, and under every node", () => {
  // Two spellings of the law is two contracts — between arrivals, and between
  // two agents a reader compares.
  const opened = teachingFor(SPACES, "opened")
  const assigned = teachingFor(SPACES, "assigned")
  expect(assigned.slice(1, 3)).toEqual(opened.slice(1, 3))
  const other = teachingFor({ id: "odu", title: "Odu", file: "ci.olai", engine: "opus", session: null, memory: 14 })
  expect(other[0]).not.toBe(opened[0])
  expect(other.slice(1)).toEqual(opened.slice(1))
})

// ── the migration variant ─────────────────────────────────────────────

test("an ASSIGNED session is told it was moved here, and what it was before", () => {
  const [who] = teachingFor(SPACES, "assigned")
  expect(who).toContain("ASSIGNED")
  expect(who).toContain("Xyne Spaces — the org OS")
  expect(who).toContain("ordinary chat until now")
})

test("... and is told to reconcile what it already knows into the subtree, which an opened one is not", () => {
  const assigned = teachingFor(SPACES, "assigned")
  const opened = teachingFor(SPACES, "opened")
  expect(assigned).toHaveLength(opened.length + 1)
  const reconcile = assigned.find((line) => !opened.includes(line) && line !== assigned[0])
  expect(reconcile).toContain("Reconcile first")
  expect(reconcile).toContain("still relevant from this conversation")
  expect(reconcile).toContain("updating the entries that already hold it")
  // ... after the law, and before the last line.
  expect(assigned.indexOf(reconcile as string)).toBe(assigned.length - 2)
})

test("`opened` is the default, so every existing caller teaches what it taught", () => {
  expect(teachingFor(SPACES, "opened")).toEqual(teachingFor(SPACES))
})

// ── the reminder ──────────────────────────────────────────────────────

test("the reminder is ONE sentence, carrying the trigger and the shape", () => {
  expect(REMINDER.includes("\n")).toBe(false)
  expect(REMINDER).toContain("only when a durable fact changed")
  expect(REMINDER).toContain("update the node that holds it")
  expect(REMINDER).toContain("never record messages")
})

test("... and it rides as ONE `[olai] ` line, the shape every teaching line has", () => {
  expect(REMINDING).toEqual([`[olai] ${REMINDER}`])
  // The same builder, so the same prefix: what the line is made of is the
  // sentence, exactly as the contract's last line is `HARNESS_MEMORY_OFF`.
  expect(teachingFor(SPACES).at(-1)).toBe(`[olai] ${HARNESS_MEMORY_OFF}`)
})

test("under a message it rides the seam every other annotation rides", () => {
  // A blank line between what a person wrote and what olai added, which is
  // `./prompt.ts`'s one rule — so the message stays the message.
  const said = annotated("what is blocking the connector?", teachingFor(SPACES))
  expect(said.startsWith("what is blocking the connector?\n\n[olai] ")).toBe(true)
  expect(annotated("and now?", REMINDING)).toBe(`and now?\n\n[olai] ${REMINDER}`)
})
