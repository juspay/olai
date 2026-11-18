/**
 * THE ONE-TIME MOVE, as a rule — what it says about a reading, and the two
 * promises a migration has to keep: NOTHING IS LOST, and the SECOND RUN DOES
 * NOTHING.
 *
 * Both are asserted over a model of the application rather than over a serve:
 * the moves are applied to the reading's own text here — the tie written into
 * the note's front matter, the row's property taken off — and the reading is
 * built again from the result, so a second pass is asked about the vault the
 * first one actually produced.
 */
import { expect, test } from "bun:test"

import { Effect } from "effect"
import { claims, declarationsOf, frontmatterIn, matterWith, type Reading } from "@olai/format"
import { readingOf, setOf, TEST_CLAIMS } from "@olai/format/testlib"

import { OPENS_TYPE, ownKinds, SESSION_TYPE } from "../kinds.ts"
import { applyMoves, movesIn } from "./move.ts"

/** One board: a row titled for a note, the note, and whatever else a case
 *  needs. `documents` are `[path, text]` pairs the set serves. */
const reading = (
  rows: ReadonlyArray<Record<string, unknown>>,
  documents: ReadonlyArray<readonly [string, string]> = [],
) =>
  readingOf(setOf(
    { "lanes.olai": rows.map((row) => JSON.stringify(row)).join("\n") },
    documents,
  ))

const moves = (at: Pick<Reading, "set" | "claims" | "derived">) =>
  movesIn(at, declarationsOf(at.derived, ownKinds))

const CHAT_ROW = {
  id: "chat-plan",
  ord: "a0",
  title: "[plan](/notes/plan.md)",
  custom: { "chat-agent-session": "claude:sess-1" },
}

test("a row titled for a note hands its chat to the note, and keeps its own title", () => {
  const at = reading([CHAT_ROW], [["notes/plan.md", "# Plan\n\nthe kitchen\n"]])
  expect(moves(at)).toEqual([
    { row: "chat-plan", path: "notes/plan.md", value: "claude:sess-1", untieOnly: false },
  ])
})

test("a note that already holds the same tie is a half-done move: only the row is untied", () => {
  const at = reading([CHAT_ROW], [[
    "notes/plan.md",
    "---\nchat-agent-session: claude:sess-1\nchat-opens: alone\n---\n\n# Plan\n",
  ]])
  expect(moves(at)).toEqual([
    { row: "chat-plan", path: "notes/plan.md", value: "claude:sess-1", untieOnly: true },
  ])
})

test("a note with a chat of its own is left alone, and so is the row", () => {
  const at = reading([CHAT_ROW], [[
    "notes/plan.md",
    "---\nchat-agent-session: grok:sess-9\n---\n\n# Plan\n",
  ]])
  expect(moves(at)).toEqual([])
})

test("rows for an outline, a picture, a plugin page and an ordinary chat are not candidates", () => {
  const at = reading([
    { id: "whole", ord: "a0", title: "[house](/house.olai)", custom: { "chat-agent-session": "claude:a" } },
    { id: "picture", ord: "a1", title: "[handle](/art/handle.png)", custom: { "chat-agent-session": "claude:b" } },
    { id: "page", ord: "a2", title: "[swatch](/plugins/swatch)", custom: { "chat-agent-session": "claude:c" } },
    { id: "plain", ord: "a3", title: "kitchen remodel", custom: { "chat-agent-session": "claude:d" } },
  ], [["art/handle.png", ""]])
  expect(moves(at)).toEqual([])
})

test("a note the directory no longer holds — deleted since the row was written — is not a candidate", () => {
  expect(moves(reading([CHAT_ROW]))).toEqual([])
})

test("a chat row somebody put away carries its tie into the trash and is not moved", () => {
  const at = readingOf(setOf(
    { "_olai/Trash.olai": JSON.stringify(CHAT_ROW) },
    [["notes/plan.md", "# Plan\n"]],
  ))
  expect(movesIn(at, declarationsOf(at.derived, ownKinds))).toEqual([])
})

test("two rows titled for one note: the FIRST in corpus order wins, the second is untouched", () => {
  const at = reading([
    { id: "first", ord: "a0", title: "[plan](/notes/plan.md)", custom: { "chat-agent-session": "claude:one" } },
    { id: "second", ord: "a1", title: "[plan](/notes/plan.md)", custom: { "chat-agent-session": "claude:two" } },
  ], [["notes/plan.md", "# Plan\n"]])
  expect(moves(at)).toEqual([
    { row: "first", path: "notes/plan.md", value: "claude:one", untieOnly: false },
  ])
})

test("a row whose tie names no engine is not a candidate at all", () => {
  const at = reading(
    [{ ...CHAT_ROW, custom: { "chat-agent-session": ":sess-1" } }],
    [["notes/plan.md", "# Plan\n"]],
  )
  expect(moves(at)).toEqual([])
})

test("a heading address counts as its document, which is what a chat about a place meant", () => {
  const at = reading(
    [{ ...CHAT_ROW, title: "[plan](/notes/plan.md#dates)" }],
    [["notes/plan.md", "# Plan\n\n## dates\n"]],
  )
  expect(moves(at).map((move) => move.path)).toEqual(["notes/plan.md"])
})

// ── the two promises ───────────────────────────────────────────────────

/** THE APPLICATION, MODELLED: the note's front matter rewritten exactly as the
 *  applier writes it, and the row's tie removed. */
const applied = (
  rows: ReadonlyArray<Record<string, unknown>>,
  documents: ReadonlyArray<readonly [string, string]>,
) => {
  const at = reading(rows, documents)
  const made = moves(at)
  const texts = new Map(documents.map(([path, text]) => [path, text] as const))
  const left = rows.map((row) => ({ ...row }))
  for (const move of made) {
    if (!move.untieOnly) {
      texts.set(
        move.path,
        matterWith(texts.get(move.path) ?? "", [
          [SESSION_TYPE, move.value],
          [OPENS_TYPE, "alone"],
        ]),
      )
    }
    const row = left.find((one) => one.id === move.row)
    if (row !== undefined) {
      const custom = { ...(row["custom"] as Record<string, string>) }
      delete custom[SESSION_TYPE]
      row["custom"] = custom
    }
  }
  return { moves: made, rows: left, documents: [...texts].map(([path, text]) => [path, text] as const) }
}

test("nothing is lost: every row and every conversation id is still there afterwards", () => {
  const rows = [
    { id: "chat-plan", ord: "a0", title: "[plan](/notes/plan.md)", custom: { "chat-agent-session": "claude:sess-1" } },
    { id: "kitchen", ord: "a1", title: "kitchen remodel", custom: { "chat-agent-session": "opus:sess-2" } },
    { id: "plain", ord: "a2", title: "hinges" },
  ]
  const after = applied(rows, [["notes/plan.md", "# Plan\n\nthe kitchen\n"]])
  // EVERY ROW IS STILL A ROW, with the title it was written with: the move
  // never retitles, moves or deletes one.
  expect(after.rows.map((row) => [row["id"], row["title"]]))
    .toEqual(rows.map((row) => [row["id"], row["title"]]))
  // ...AND EVERY CONVERSATION IS STILL NAMED SOMEWHERE — by the row that had
  // it, or by the note it moved to.
  const before = rows.flatMap((row) => Object.values((row["custom"] ?? {}) as Record<string, string>))
  const now = [
    ...after.rows.flatMap((row) => Object.values((row["custom"] ?? {}) as Record<string, string>)),
    ...after.documents.flatMap(([, text]) => {
      const held = frontmatterIn(text)[SESSION_TYPE]
      return typeof held === "string" ? [held] : []
    }),
  ]
  expect([...now].sort()).toEqual([...before].sort())
  // The prose is byte-for-byte what it was, under the block that was added.
  expect(after.documents[0]?.[1]).toContain("# Plan\n\nthe kitchen\n")
  expect(frontmatterIn(after.documents[0]?.[1] ?? "")[OPENS_TYPE]).toBe("alone")
})

test("a second run over the vault the first one made asks for nothing", () => {
  const first = applied(
    [{ id: "chat-plan", ord: "a0", title: "[plan](/notes/plan.md)", custom: { "chat-agent-session": "claude:sess-1" } }],
    [["notes/plan.md", "# Plan\n"]],
  )
  expect(first.moves).toHaveLength(1)
  const again = reading(first.rows, first.documents)
  expect(moves(again)).toEqual([])
})

test("...and so does a second run after a half-done one, which untied nothing", () => {
  // The note was written and the serve stopped before the row was untied: the
  // first run here is the UNTIE, and the one after it has nothing to do.
  const half = applied(
    [{ id: "chat-plan", ord: "a0", title: "[plan](/notes/plan.md)", custom: { "chat-agent-session": "claude:sess-1" } }],
    [["notes/plan.md", "---\nchat-agent-session: claude:sess-1\n---\n\n# Plan\n"]],
  )
  expect(half.moves[0]?.untieOnly).toBe(true)
  expect(moves(reading(half.rows, half.documents))).toEqual([])
})

// ── and the reading that is not the directory yet ──────────────────────

/** A serve coming up: the store has opened on the built-in vocabulary, so the
 *  only kind it claims is the outline and no `.md` is served at all. Taken off
 *  the test table rather than spelled, since a suffix is its row's to spell. */
const BOOTSTRAP = claims([...TEST_CLAIMS.byKind.values()].filter((claim) => claim.holds === "nodes"))

/** The applier, over a reading, recording what it would have written — and
 *  how many times it asked for the directory at all, which is the claim the
 *  gate below is about. */
const applier = (at: Reading & { readonly outlineRow: string }, served = true) => {
  const docs: Array<string> = []
  const removed: Array<string> = []
  const said: Array<string> = []
  let reads = 0
  const ran = Effect.runSync(applyMoves({
    served: () => served,
    read: Effect.sync(() => { reads += 1; return at }),
    text: () => Effect.succeed("# Plan\n"),
    doc: (path) => Effect.sync(() => void docs.push(path)),
    remove: (row) => Effect.sync(() => void removed.push(row)),
    key: () => SESSION_TYPE,
    opensKey: () => OPENS_TYPE,
    log: (line) => Effect.sync(() => void said.push(line)),
  }))
  return { ran, docs, removed, said, reads }
}

test("a build that serves no notes never reads the directory", () => {
  // THE OTHER HALF OF THE REGRESSION BELOW. With the markdown row switched
  // off nothing can ever be moved onto a note, and no reading can ever say so
  // — so a migration that found out by READING walked the whole vault on
  // every revision for the life of the process. The registry is asked first.
  const whole = readingOf(setOf(
    { "lanes.olai": JSON.stringify(CHAT_ROW) },
    [["notes/plan.md", "# Plan\n"]],
  ))
  const off = applier(whole, false)
  expect(off.ran).toBe(false)
  expect(off.reads).toBe(0)
  expect(off.docs).toEqual([])
  expect(off.removed).toEqual([])
})

test("a reading that cannot name a note is NOT a vault with nothing to move", () => {
  // THE REGRESSION. On a serve's first readings the markdown kind has not been
  // taught yet: `demo.md` is not served, its address names nothing, and every
  // candidate looks like a row titled for nowhere. A one-shot that ran there
  // would be spent against a directory it had not been shown, and the
  // link-titled rows would stay rows for good.
  const early = readingOf(
    setOf({ "lanes.olai": JSON.stringify(CHAT_ROW) }),
    BOOTSTRAP,
  )
  const first = applier(early)
  expect(first.ran).toBe(false)
  expect(first.docs).toEqual([])
  expect(first.removed).toEqual([])
  expect(first.said).toEqual([])
  // ...and the very next reading, with the directory whole, does the move and
  // says so — which is what the caller re-arms for.
  const whole = readingOf(setOf(
    { "lanes.olai": JSON.stringify(CHAT_ROW) },
    [["notes/plan.md", "# Plan\n"]],
  ))
  const second = applier(whole)
  expect(second.ran).toBe(true)
  expect(second.docs).toEqual(["notes/plan.md"])
  expect(second.removed).toEqual(["chat-plan"])
  expect(second.said).toHaveLength(1)
})

test("a whole reading with nothing to move still answers that it ran", () => {
  const whole = readingOf(setOf({ "lanes.olai": '{"id":"plain","ord":"a0","title":"hinges"}' }))
  const done = applier(whole)
  expect(done.ran).toBe(true)
  expect(done.docs).toEqual([])
  expect(done.said).toEqual([])
})
