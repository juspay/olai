/**
 * WHAT THE WAKE PICKER OFFERS, over a directory that holds one of everything.
 *
 * The case that matters is the one the human screenshotted: a `.md` sitting
 * between two outlines in a list of files a doorbell can be pointed at. A
 * document has no NODES, so a conversation scoped to one watches the empty set
 * for ever — no wake, no digest, and a heartbeat that goes on saying the
 * watcher is alive. Everything below is that, plus the two rulings around it:
 * what is put away is not offered, and neither are the files olai named for
 * itself.
 *
 * THE DIRECTORY IS THE WHOLE REGISTRY, one file per kind and one file no kind
 * claims, so a kind added to `@olai/format` without a thought about this picker
 * lands here as a row that has to be argued about rather than as a `.pdf`
 * quietly on offer.
 */

import { FILE_KINDS } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { scopable, watchable } from "./scopable.ts"

/** What kolu declares, and the only list any of this is asked with today. */
const OUTLINES: ReadonlyArray<string> = ["outline"]

/**
 * A served directory with one file of every kind the registry claims, one it
 * claims nothing about, the trash, a leftover archive and the three mints.
 *
 * The paths are what a directory really hands the browser (`../served.tsx`):
 * root-relative, `/`-spelled, archives included.
 */
const SERVED: ReadonlyArray<string> = [
  "lanes.olai",
  "work/board.olai",
  "2026-09-01.md",
  "notes/plan.md",
  "saved.html",
  "rows.csv",
  "shot.png",
  "paper.pdf",
  "README",
  "_olai/Trash.olai",
  "_olai/Pins.olai",
  "_olai/Properties.olai",
  "_olai/Kolu.olai",
  "_olai/Inbox.olai",
  "Archive.olai",
  "old/Archive.olai",
]

const offered = (kinds: ReadonlyArray<string> = OUTLINES): ReadonlyArray<string> =>
  SERVED.filter((path) => scopable(path, kinds))

describe("the picker offers only what the doorbell could watch", () => {
  test("the reader's own outlines, and nothing else in the directory", () => {
    expect(offered()).toEqual(["lanes.olai", "work/board.olai"])
  })

  test("and a document is not among them, which is the whole defect", () => {
    // The human's screenshot, 2026-09-01: `2026-09-01.md` between two outlines.
    // It has no nodes, so a conversation scoped to it watches nothing for ever
    // while the heartbeat reports a live watcher.
    expect(offered()).not.toContain("2026-09-01.md")
    expect(watchable("2026-09-01.md", OUTLINES)).toBe(false)
  })

  test("nor is any other bodied kind the registry claims", () => {
    for (const path of ["saved.html", "rows.csv", "shot.png", "paper.pdf"]) {
      expect(watchable(path, OUTLINES)).toBe(false)
    }
  })

  test("nor a file no kind claims at all", () => {
    // It is in no plugin's list because it is in no list: `fileKind` answers
    // `null` and there is no arm for it to fall through.
    expect(watchable("README", OUTLINES)).toBe(false)
  })

  test("the KIND decides and the suffix does not — every kind the registry has", () => {
    // A doorbell declaring some other kind is offered that kind's files, which
    // is what makes this the plugin's ruling rather than a hard-coded `.olai`.
    for (const [kind, claim] of Object.entries(FILE_KINDS)) {
      const path = `held/one${claim.exts[0]}`
      expect(watchable(path, [kind])).toBe(true)
      expect(watchable(path, OUTLINES)).toBe(kind === "outline")
    }
  })

  test("a doorbell declaring a kind this build does not know is offered nothing", () => {
    // The wire carries plain words, so a serve ahead of this browser can name a
    // kind it has never heard of. The list narrows to nothing, which is visible
    // and local; a decode that failed would take every plugin's mount with it.
    expect(offered(["hologram"])).toEqual([])
  })
})

describe("what is not offered, though it is an outline", () => {
  test("the trash, because a trashed lane's claim is history", () => {
    // It is in the screenshot and it passes a naive kind test: it is an outline
    // and it really does hold records. That is what makes it worth ruling on —
    // a doorbell scoped to it would ring about work somebody put away.
    expect(offered()).not.toContain("_olai/Trash.olai")
  })

  test("a leftover Archive.olai, wherever it sits, for the same reason", () => {
    expect(offered()).not.toContain("Archive.olai")
    expect(offered()).not.toContain("old/Archive.olai")
  })

  test("and the files olai named for itself, which will never carry a lane", () => {
    // A shelf of mirrors, the property declarations, the watcher's own knobs,
    // the inbox: outlines every one, and a list of five where two are
    // meaningful is nearly as bad as one that offers a `.md`.
    for (const path of SERVED.filter((one) => one.startsWith("_olai/"))) {
      expect(offered()).not.toContain(path)
    }
  })

  test("but none of them is UNWATCHABLE, which is a different question", () => {
    // Not offered is a curation of a list; the fault a stored pick is judged by
    // is the kind rule alone. A conversation already scoped to the trash goes
    // on deriving exactly what it always derived and is told nothing.
    expect(watchable("_olai/Trash.olai", OUTLINES)).toBe(true)
    expect(watchable("_olai/Pins.olai", OUTLINES)).toBe(true)
  })
})
