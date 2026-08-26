/**
 * WHAT A DECLARED VALUE NAMES — the arm the vault answers, and the one place
 * the gate and the display are held against each other.
 *
 * The UNDECLARED arm's corpus lives where it always did (`@olai/web`'s
 * `props/door.ts`'s suite, which asks the whole seam over the very cases it
 * asked before the rule moved down here). What is asserted here is the half
 * that is new: a declaration is a stronger warrant than a shape, the basis is
 * a fact on the key's own row, and the two arms of the consult cannot answer
 * one value two ways.
 */

import { expect, test } from "bun:test"

import { addressOf } from "./address.ts"
import { readingOfVault } from "./scope.testlib.ts"
import { meaningOf, type Vault } from "./meaning.ts"
import { pageOf } from "./page.ts"
import { nodeNamed } from "./derive.ts"
import { declarationsOf, type Typed, wrongValue } from "./typing.ts"
import { markdownPaths } from "./rules.ts"
import type { Reading } from "./validate.ts"

/**
 * A vault with a vocabulary and something for every kind of value to name.
 *
 * The board's own shape, small: lane records in a SUBDIRECTORY (which is where
 * the dead-chip bug lives — a value written by a root convention, read beside
 * the writing file) and one at the root, so the same `brief briefs/tp.md` is
 * asked from both places.
 */
const VAULT = new Map<string, string>([
  ["_olai/Properties.olai", [
    // `base: root` — the amendment, on the key the live board writes from a
    // convention that stands at the root.
    `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc","base":"root"}}`,
    // ...and the same kind with no base, which is the default and is what
    // every declaration written before the amendment says.
    `{"id":"prop-note","ord":"a1","title":"note","custom":{"type":"doc"}}`,
    `{"id":"prop-agent","ord":"a2","title":"agent","custom":{"type":"ref","under":"agents"}}`,
    `{"id":"prop-merge","ord":"a3","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"merge-auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"merge-human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-worktree","ord":"a4","title":"worktree","custom":{"type":"path"}}`,
    `{"id":"prop-records","ord":"a5","title":"records","custom":{"type":"int"}}`,
    `{"id":"prop-dispatched","ord":"a6","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr-url","ord":"a7","title":"pr-url","custom":{"type":"text"}}`,
    `{"id":"prop-item","ord":"a8","title":"item","custom":{"type":"node"}}`,
  ].join("\n")],
  ["agents.olai", [
    `{"id":"agents","ord":"a0","title":"the agents"}`,
    `{"id":"grok","parent":"agents","ord":"a0","title":"Grok"}`,
  ].join("\n")],
  ["roadmap/lanes.olai", [
    `{"id":"lanes","ord":"a0","title":"the lanes"}`,
    `{"id":"lane","parent":"lanes","ord":"a0","title":"one lane","custom":{` +
      `"brief":"briefs/tp.md","note":"briefs/tp.md","agent":"grok","merge":"merge-auto",` +
      `"worktree":".worktrees/tp","records":"193","dispatched":"2026-08-25",` +
      `"pr-url":"https://github.com/juspay/olai/pull/402","item":"agents"}}`,
  ].join("\n")],
  ["board.olai", [
    `{"id":"board","ord":"a0","title":"the board"}`,
    `{"id":"root-lane","parent":"board","ord":"a0","title":"a lane at the root",` +
      `"custom":{"brief":"briefs/tp.md","note":"briefs/tp.md"}}`,
  ].join("\n")],
  ["briefs/tp.md", "# the brief\n"],
])

const READ: Reading = readingOfVault(VAULT)

/** The three facts the consult is asked of, built the way the page's own
 *  projection builds them — so what this suite asks is what a tab is served. */
const vault: Vault = {
  declarations: declarationsOf(READ.derived),
  declares: (id) => nodeNamed(READ.derived, id) !== undefined,
  serves: (file) => READ.set.documents.some((face) => face.path === file),
}

/** ...and the four the GATE is asked of, over the same reading. Two values
 *  built from one revision, which is the whole point of holding them against
 *  each other. */
const typed: Typed = {
  declarations: vault.declarations,
  derived: READ.derived,
  documents: markdownPaths(READ.set),
}

const IN_SUB = "roadmap/lanes.olai"
const AT_ROOT = "board.olai"

/** The lane board as a page — the outline the doors below are asked of. */
const lanes = () =>
  pageOf(READ, {
    kind: "at",
    address: addressOf(IN_SUB, null)!,
  })

// ── the basis, which is the amendment ──────────────────────────────────

test("a `doc` key declared `base: root` resolves from the served root, wherever it is written", () => {
  // THE RESURRECTION, as a unit: the board writes `briefs/tp.md` on a record
  // one directory in, and means the file at the root. ~101 chips on the live
  // vault read exactly this way and every one of them was dead.
  expect(meaningOf(vault, IN_SUB, "brief", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
  // ...and it is the same answer from the root, which is what "from the root"
  // means: where the value was written stops mattering.
  expect(meaningOf(vault, AT_ROOT, "brief", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

test("...and a key that declares no base keeps resolving beside the writing file", () => {
  // THE DEFAULT IS UNCHANGED BEHAVIOUR, which is the whole compatibility
  // argument: `note` is declared exactly as every key in every vault was
  // declared before this field existed.
  expect(meaningOf(vault, IN_SUB, "note", "briefs/tp.md")).toBeNull()
  expect(meaningOf(vault, AT_ROOT, "note", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
  // ...and the way to reach it from one directory in is to say so, which is
  // what a relative markdown link has always meant.
  expect(meaningOf(vault, IN_SUB, "note", "../briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

/**
 * THE GATE ARM AND THE DISPLAY ARM, over every declared value in the corpus.
 *
 * The divergence the whole bug family lives on, turned into a test: a `doc`
 * value the validator ACCEPTS is a value the display draws a live door for, and
 * one it REFUSES is one the display draws no door for. Before the basis was a
 * declared fact those two were separately-computed opinions, and on the live
 * board they disagreed about a hundred values.
 *
 * Asked over `doc` alone because `doc` is the one kind whose gate resolves
 * anything — the other six check a shape or a membership, and the arms below
 * assert those one by one.
 */
test("what the gate accepts is what the display opens, over every `doc` value", () => {
  const values = [
    "briefs/tp.md",
    "../briefs/tp.md",
    "briefs/missing.md",
    "not a path",
    "https://example.com/x.md",
    "",
  ]
  for (const from of [IN_SUB, AT_ROOT]) {
    for (const key of ["brief", "note"]) {
      for (const value of values) {
        const refused = wrongValue(typed, from, key, value) !== undefined
        const opens = meaningOf(vault, from, key, value)
        expect([from, key, value, refused]).toEqual([from, key, value, opens === null])
      }
    }
  }
})

// ── the declaration is a stronger warrant than a shape ─────────────────

test("a `ref` value opens its target, and the face is told to draw the title", () => {
  expect(meaningOf(vault, IN_SUB, "agent", "grok"))
    .toEqual({ kind: "node", id: "grok", titled: true })
  expect(meaningOf(vault, IN_SUB, "merge", "merge-auto"))
    .toEqual({ kind: "node", id: "merge-auto", titled: true })
  // A `node` key is a reference too — any node in the set rather than one
  // parent's children, and the same sentence about names and ids.
  expect(meaningOf(vault, IN_SUB, "item", "agents"))
    .toEqual({ kind: "node", id: "agents", titled: true })
})

test("...where a value that merely turned out to be an id is NOT titled", () => {
  // The same string under a key nobody declared. It opens the same node — the
  // guess was right — and the chip goes on drawing what the record holds,
  // because nothing said this key was a reference.
  expect(meaningOf(vault, IN_SUB, "sighted", "grok"))
    .toEqual({ kind: "node", id: "grok", titled: false })
})

test("a `path` opens only what the directory actually serves — `worktree` is not a door", () => {
  // The declaration says this may point ANYWHERE, so the display asks the one
  // question that settles it. A worktree on somebody's machine is not in this
  // directory, and a chip that pretended otherwise would be the wrong door
  // this module is built to refuse.
  expect(meaningOf(vault, IN_SUB, "worktree", ".worktrees/tp")).toBeNull()
  // ...and a `path` that IS served opens, which is what makes this one rule
  // rather than a refusal per kind.
  expect(meaningOf(vault, AT_ROOT, "worktree", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

test("a declared `int` names nothing, however id-shaped it looks", () => {
  expect(meaningOf(vault, IN_SUB, "records", "193")).toBeNull()
  // The guess would have opened this one: `agents` IS a node of this set. The
  // declaration is what refuses it — a number names no record.
  expect(meaningOf(vault, IN_SUB, "records", "agents")).toBeNull()
  expect(meaningOf(vault, IN_SUB, "sighted", "agents")?.kind).toBe("node")
})

test("a declared `date` opens its day, and refuses everything that is not one", () => {
  expect(meaningOf(vault, IN_SUB, "dispatched", "2026-08-25"))
    .toEqual({ kind: "day", date: "2026-08-25" })
  expect(meaningOf(vault, IN_SUB, "dispatched", "grok")).toBeNull()
})

test("a declared `text` reads exactly as an undeclared key does — which is why `pr-url` still opens", () => {
  // The board declares `pr-url` `text` on purpose ("this prose is deliberate"),
  // and it holds a whole URL. A switch that answered `null` for `text` would
  // have taken the away door off every PR chip on the board.
  const url = "https://github.com/juspay/olai/pull/402"
  expect(meaningOf(vault, IN_SUB, "pr-url", url)).toEqual({ kind: "away", href: url })
  expect(meaningOf(vault, IN_SUB, "undeclared", url)).toEqual({ kind: "away", href: url })
  // ...and prose under either is prose.
  expect(meaningOf(vault, IN_SUB, "pr-url", "#402 merged at 12:45")).toBeNull()
})

test("a `ref` value naming nothing this set declares stays text", () => {
  // Which the gate reports as a finding against the file; the display's answer
  // is the honest one either way, and a dead chip is what a reader should see
  // while the validator is saying so.
  expect(meaningOf(vault, IN_SUB, "agent", "nobody")).toBeNull()
})

// ── the projection, and what it does NOT put on the wire ───────────────

test("the page ships a door per value that names something, and nothing that names nothing", () => {
  const page = lanes()
  const doors = new Map(page.doors.map((one) => [`${one.prop}=${one.value}`, one.opens]))
  expect(doors.get("brief=briefs/tp.md")).toEqual({ kind: "document", file: "briefs/tp.md" })
  expect(doors.get("agent=grok")).toEqual({ kind: "node", id: "grok", titled: true })
  expect(doors.get("merge=merge-auto")).toEqual({ kind: "node", id: "merge-auto", titled: true })
  expect(doors.get("dispatched=2026-08-25")).toEqual({ kind: "day", date: "2026-08-25" })
  // The two that name nothing are ABSENT rather than carried as a null: a
  // value the display draws as text is a value the wire has nothing to say
  // about.
  expect(doors.has("worktree=.worktrees/tp")).toBe(false)
  expect(doors.has("records=193")).toBe(false)
  expect(doors.has("note=briefs/tp.md")).toBe(false)
  // ...and every door carries the FILE the value was written in, which is what
  // makes the same words on two rows two answers.
  expect(page.doors.every((one) => one.from === IN_SUB)).toBe(true)
})

test("a door onto a node is named in the same page's names table — the titled face's other half", () => {
  const page = lanes()
  const named = new Map(page.names.map((one) => [one.id, one.title]))
  for (const door of page.doors) {
    if (door.opens.kind !== "node") continue
    expect([door.value, named.get(door.opens.id)])
      .toEqual([door.value, named.get(door.opens.id) ?? "MISSING"])
    expect(named.has(door.opens.id)).toBe(true)
  }
  expect(named.get("grok")).toBe("Grok")
  expect(named.get("merge-auto")).toBe("automatic")
})

/**
 * THE WIRE CARRIES ANSWERS, NEVER THE VOCABULARY — #395's exclusion, asserted
 * rather than believed.
 *
 * The refused alternative to this whole design was a declarations cell beside
 * the page, and the argument against it was that a browser holding the rules
 * would re-derive answers and be free to disagree. So: no shape a declaration
 * has may appear anywhere in a page payload — not a `type`, not an `under`,
 * not a `base`, not a kind word under any of them.
 *
 * Asked of the SERIALISED reading rather than of its fields, because "no
 * declarations on the wire" is a claim about the bytes: a field added inside
 * some arm three levels down would pass any test that walked the arms this
 * suite happens to know about.
 */
test("no declaration shape rides the page — the tab receives answers, not the vocabulary", () => {
  const page = lanes()
  // The DOORS half alone, since the rest of a page is rows and a row carries a
  // record's own `custom` verbatim — where a vault that declared `type` on an
  // ordinary node is entitled to have the word on screen.
  const wire = JSON.stringify(page.doors)
  for (const word of ["\"type\"", "\"under\"", "\"base\"", "prop-brief", "prop-agent"]) {
    expect([word, wire.includes(word)]).toEqual([word, false])
  }
  // ...and the answers ARE there, which is what makes the line above a fence
  // rather than a test of an empty array.
  expect(page.doors.length).toBeGreaterThan(0)
})
