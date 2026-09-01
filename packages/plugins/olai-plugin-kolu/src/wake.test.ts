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
 * ## The near miss, which is why the annotation alone was not enough
 *
 * `kinds` was first annotated `FileKind`, and the PR body offered that as the
 * catch. `FileKind` is EVERY kind the registry claims, so it catches
 * `"hologram"` — a word naming no file — and passes `"document"`, which names
 * exactly the files this doorbell cannot read. The type checker was happy and
 * the defect was one word away. It is bounded to `NodeKind` now — the registry's
 * record-holding kinds, the complement of `BodyKind`, derived from the same
 * `holds` column — and the first test below is what fails the BUILD if that
 * bound ever widens back.
 *
 * A TYPE TEST AND A VALUE TEST, because they catch different hands. The type
 * test catches the union going wrong under a declaration that never changed; the
 * value test catches the declaration going wrong under a union that never did —
 * a kind added to the registry as record-holding but useless to this walk, say.
 * Neither is the other's duplicate.
 */

import { FILE_KINDS, type NodeKind } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { wake } from "./wake.ts"

describe("the kinds this doorbell declares", () => {
  /**
   * THE PIN, and it is a TYPECHECK rather than an assertion: `@ts-expect-error`
   * is an error itself when the line under it stops being one, so this fails
   * `bun run typecheck` the day a bodied kind becomes spellable in the position
   * `./wake.ts` declares its list in.
   *
   * The four bodied kinds are written out rather than swept, because a sweep
   * would have to be typed to be written and the thing under test is exactly
   * what that type admits. Each line is one word of the registry that must stay
   * unsayable here.
   */
  test("a bodied kind cannot be declared where kolu declares its own", () => {
    // @ts-expect-error — a document holds no nodes, so nothing in one can ever
    // claim a terminal. This is the human's 2026-09-01 screenshot as a type.
    const DOCUMENT: readonly [NodeKind, ...Array<NodeKind>] = ["document"]
    // @ts-expect-error — hypertext is drawn in a frame, never walked.
    const HYPERTEXT: readonly [NodeKind, ...Array<NodeKind>] = ["hypertext"]
    // @ts-expect-error — a table is rows of text, and none of them is a node.
    const CSV: readonly [NodeKind, ...Array<NodeKind>] = ["csv"]
    // @ts-expect-error — and a picture is bytes this process cannot read at all.
    const IMAGE: readonly [NodeKind, ...Array<NodeKind>] = ["image"]
    // @ts-expect-error — as is a printed document.
    const PDF: readonly [NodeKind, ...Array<NodeKind>] = ["pdf"]
    // ... and one word the registry never had, which is the case the annotation
    // caught before this one did and still catches.
    // @ts-expect-error
    const NOTHING: readonly [NodeKind, ...Array<NodeKind>] = ["hologram"]
    // The values are unreachable by construction — the point is made above, by
    // the compiler. Reading them keeps the bindings from being unused, which is
    // its own build error.
    expect([DOCUMENT, HYPERTEXT, CSV, IMAGE, PDF, NOTHING].length).toBe(6)
  })

  /**
   * ...AND THE SAME CLAIM AT RUNTIME, over the registry's own table.
   *
   * The type test says a bodied kind is unspellable; this says the words kolu
   * actually shipped are record-holding ones, asked of `FILE_KINDS` rather than
   * of the union — so a kind admitted to `NodeKind` that this walk still could
   * not read would have to be argued about here rather than inherited.
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
