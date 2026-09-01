/**
 * WHICH KINDS OF FILE ODU'S DOORBELL MAY BE POINTED AT — the one thing in
 * `./wake.ts` that is not prose, and the one thing there worth pinning.
 *
 * `olai-plugin-kolu`'s `./wake.test.ts` argues the whole law and rehearses
 * the failure this suite exists to catch, so this file rehearses none of it:
 * the words are deliberately unpinned (prose somebody improves must not fail
 * a test), the KINDS are data spent at both ends of the picker, and the pin
 * reads THE PRODUCTION SLOT — `typeof wake.kinds` — and never a union
 * restated here, because a union restated here compiles identically with
 * `./wake.ts` deleted.
 */

import { FILE_KINDS } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { wake } from "./wake.ts"

/**
 * THE SLOT ITSELF — what `./wake.ts` declares its list as, read off the
 * shipped value.
 */
type Declared = typeof wake.kinds

describe("the kinds this doorbell declares", () => {
  /**
   * THE PIN, and it is a TYPECHECK: `@ts-expect-error` is an error itself
   * when the line under it stops being one, so this fails `bun run typecheck`
   * the day a bodied kind becomes spellable in the slot — whether the union
   * widens or the annotation on `KINDS` does.
   */
  test("a bodied kind cannot be spelled in the slot odu declares its kinds in", () => {
    // @ts-expect-error — a document holds no nodes, so nothing in one can
    // ever claim a run.
    const DOCUMENT: Declared = ["document"]
    // @ts-expect-error — hypertext is drawn in a frame, never walked.
    const HYPERTEXT: Declared = ["hypertext"]
    // @ts-expect-error — a table is rows of text, and none of them is a node.
    const CSV: Declared = ["csv"]
    // @ts-expect-error — and a picture is bytes this process cannot read at all.
    const IMAGE: Declared = ["image"]
    // @ts-expect-error — as is a printed document.
    const PDF: Declared = ["pdf"]
    // ... and one word the registry never had, which is the case the
    // annotation caught first and still catches.
    // @ts-expect-error — no kind of served file is called this.
    const NOTHING: Declared = ["hologram"]
    expect([DOCUMENT, HYPERTEXT, CSV, IMAGE, PDF, NOTHING].length).toBe(6)
  })

  /**
   * ...AND THE SAME CLAIM AT RUNTIME, over the registry's own table — the
   * third hand: a value can be wrong under a type that is right.
   */
  test("and every kind it did declare holds records", () => {
    expect(wake.kinds.length).toBeGreaterThan(0)
    for (const kind of wake.kinds) {
      expect(FILE_KINDS[kind].holds).toBe("nodes")
    }
  })

  /** Which is the outline, and today that is the whole of the set. */
  test("which is the outline, and today that is the whole of the set", () => {
    const walkable = Object.entries(FILE_KINDS)
      .filter(([, claim]) => claim.holds === "nodes")
      .map(([kind]) => kind)
    expect(walkable).toEqual(["outline"])
    expect([...wake.kinds]).toEqual(["outline"])
  })
})
