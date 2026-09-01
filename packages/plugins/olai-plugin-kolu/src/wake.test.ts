/**
 * WHICH KINDS OF FILE KOLU'S DOORBELL MAY BE POINTED AT — the one thing in
 * `./wake.ts` that is not prose, and the one thing there worth pinning.
 *
 * The words on that member are deliberately unpinned: they are sentences a
 * person reads, and a test asserting their spelling is a test that fails when
 * somebody improves them. `kinds` is the opposite kind of thing. It is DATA that
 * decides which files a picker offers and which stored picks the serve faults
 * (`@olai/surface`'s `watchable`, spent at both ends), and getting it wrong is
 * silent everywhere a person can see: the control draws, the list opens, a file
 * is picked, and the conversation watches an empty set for ever while the
 * heartbeat reports a live watcher. That is the human's screenshot of
 * 2026-09-01, and it is what this lane exists to make unreachable.
 *
 * ## THE PIN READS THE SLOT, and the first version of this file did not
 *
 * Everything below that is a type test is annotated `typeof wake.kinds` —
 * THE PRODUCTION SLOT, read off the shipped value — and never a union restated
 * here. That is not a style preference; it is the whole difference between a pin
 * and a decoration, and this file has already been on the wrong side of it.
 *
 * It first wrote `readonly [NodeKind, ...Array<NodeKind>]` at each directive,
 * importing the union and spelling it again. Those lines are true of `NodeKind`
 * and say NOTHING about `./wake.ts`: the file would compile identically if
 * `wake.ts` did not exist. So the one hand that mattered walked straight
 * through — widen the annotation at `wake.ts`'s `KINDS` back to `FileKind` and
 * leave the value `["outline"]`, and `"document"` is spellable again in the very
 * slot this lane exists to close, with every test here still green. That is a
 * one-line revert of the finding this suite was written to hold. UNTIL IT READS
 * THE SLOT, THE PIN IS THE OLD `FileKind` STORY ONE FLOOR DOWN: true of a type
 * nearby, false of the door (grok, on `93681120`).
 *
 * ## Three hands, and each one has to fail something
 *
 * A guard on a declaration can go wrong in three independent ways, and a suite
 * that catches two of them reads as if it catches all three:
 *
 *   1. **the UNION widens** — `NodeKind` stops being the record-holding kinds;
 *   2. **the ANNOTATION widens** — `wake.ts` names a laxer type in the slot,
 *      with the shipped value untouched and every runtime assertion still true;
 *   3. **the VALUE goes wrong** — a bodied kind is added to what ships.
 *
 * `typeof wake.kinds` is the whole of what catches (1) AND (2), because it IS
 * the slot: widen either the union or the annotation and `["document"]` becomes
 * assignable, which makes every `@ts-expect-error` below an unused directive and
 * fails `bun run typecheck`. The runtime sweeps catch (3), which no type test
 * can — a value can be wrong under a type that is right.
 */

import { FILE_KINDS } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { wake } from "./wake.ts"

/**
 * THE SLOT ITSELF, named once — what `./wake.ts` actually declares its list as,
 * read off the shipped value rather than restated.
 *
 * Every directive below is annotated with this and nothing else. A reader
 * changing that annotation to a union spelled here would be reverting this
 * file's whole point, which is why the header spends a section on it.
 */
type Declared = typeof wake.kinds

describe("the kinds this doorbell declares", () => {
  /**
   * THE PIN, and it is a TYPECHECK rather than an assertion: `@ts-expect-error`
   * is an error itself when the line under it stops being one, so this fails
   * `bun run typecheck` the day a bodied kind becomes spellable in the slot
   * `./wake.ts` declares its list in — whether that is the union widening or
   * the annotation on `KINDS` widening.
   *
   * The five bodied kinds are written out rather than swept, because a sweep
   * would have to be typed to be written and the thing under test is exactly
   * what that type admits. Each line is one word of the registry that must stay
   * unsayable in this position.
   */
  test("a bodied kind cannot be spelled in the slot kolu declares its kinds in", () => {
    // @ts-expect-error — a document holds no nodes, so nothing in one can ever
    // claim a terminal. This is the human's 2026-09-01 screenshot as a type.
    const DOCUMENT: Declared = ["document"]
    // @ts-expect-error — hypertext is drawn in a frame, never walked.
    const HYPERTEXT: Declared = ["hypertext"]
    // @ts-expect-error — a table is rows of text, and none of them is a node.
    const CSV: Declared = ["csv"]
    // @ts-expect-error — and a picture is bytes this process cannot read at all.
    const IMAGE: Declared = ["image"]
    // @ts-expect-error — as is a printed document.
    const PDF: Declared = ["pdf"]
    // ... and one word the registry never had, which is the case the annotation
    // caught before any of the above did and still catches.
    // @ts-expect-error — no kind of served file is called this.
    const NOTHING: Declared = ["hologram"]
    // The values are unreachable by construction — the point is made above, by
    // the compiler. Reading them keeps the bindings from being unused, which is
    // its own build error.
    expect([DOCUMENT, HYPERTEXT, CSV, IMAGE, PDF, NOTHING].length).toBe(6)
  })

  /**
   * ...AND THE SAME CLAIM AT RUNTIME, over the registry's own table.
   *
   * The type test says a bodied kind is unspellable in the slot; this says the
   * words kolu actually SHIPPED are record-holding ones. It is the third hand
   * and no type test reaches it: a value can be wrong under a type that is
   * right, if the type is wide enough to admit it or the value is cast into it.
   */
  test("and every kind it did declare holds records", () => {
    expect(wake.kinds.length).toBeGreaterThan(0)
    for (const kind of wake.kinds) {
      expect(FILE_KINDS[kind].holds).toBe("nodes")
    }
  })

  /** The claim behind the claim: an outline is the one kind that holds records
   *  today, so kolu's list is that kind and no other. A second record-holding
   *  kind arriving is a real decision — it would widen what the picker offers —
   *  and this is where it comes up rather than sliding through. */
  test("which is the outline, and today that is the whole of the set", () => {
    const walkable = Object.entries(FILE_KINDS)
      .filter(([, claim]) => claim.holds === "nodes")
      .map(([kind]) => kind)
    expect(walkable).toEqual(["outline"])
    expect([...wake.kinds]).toEqual(["outline"])
  })
})
