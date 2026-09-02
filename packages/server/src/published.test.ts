/**
 * The projection from one published revision to what the wire holds.
 *
 * Three properties are worth a test. Every file the set lists keeps a key of
 * its collection, whatever it holds and whether or not it parsed. The per-tick
 * change is the STORE's diff mapped onto the collection's verbs, never a
 * comparison of two sets — a key that was never held is not a remove. And a
 * document's TEXT is in that document's own entry and nowhere else: not on the
 * manifest, not in an outline's slice, so nothing carries the corpus.
 */

import {
  assemble,
  type Document,
  type OutlineSet,
  type Reading,
  type Verdict,
  verdictOf,
} from "@olai/format"
import { outlineOf, readingOf, recordsOf, setOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { publishedOf } from "./published.ts"

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}\n'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}\n'

/** A revision, moved however the caller says — by default everything, which is
 *  what a first probe reports. `changed` names documents too: the store is
 *  talking about a directory, not about outlines. */
const revision = (
  value: OutlineSet,
  moved: { changed?: ReadonlyArray<string>; removed?: ReadonlyArray<string> } = {},
  rev = 1,
): Snapshot<Reading> => ({
  rev,
  // The pair the store publishes: a snapshot carries the set AND the view the
  // validator judged it against, and this projection reads both halves.
  value: readingOf(value),
  changed: moved.changed ?? value.documents.map((document) => document.path),
  removed: moved.removed ?? [],
})

/** The first revision: the wire is holding nothing yet. */
const NOTHING_HELD = null

test("every file the set lists gets an entry, at the set's revision", () => {
  const { outlines } = publishedOf(
    revision(
      setOf({ "house.org": HOUSE, "empty.org": "" }, [["notes.md", "hello"]]),
      {},
      7,
    ),
    NOTHING_HELD,
  )

  expect([...outlines.entries.keys()]).toEqual(["empty.org", "house.org"])
  expect(outlines.entries.get("house.org")).toMatchObject({
    rev: 7,
    nodes: recordsOf(setOf({ "house.org": HOUSE })),
    broken: null,
  })
  // AND WHAT THE FILE IS, beside what it holds: the face the decode built,
  // cut from the same document the records were (`@olai/format`'s `Face`).
  expect(outlines.entries.get("house.org")?.face.title).toBe("house")
  // A file that holds nothing is still an outline somebody can open.
  expect(outlines.entries.get("empty.org")).toMatchObject({
    rev: 7,
    nodes: [],
    broken: null,
  })
  // A document is not an outline: it is a key of its own collection.
  expect(outlines.entries.has("notes.md")).toBe(false)
})

// The per-entity degrade, as data: the key stays and the errors are IN it, so
// the sidebar still lists the file and its own pane is what shows the trouble.
test("a file that did not parse keeps its key and carries its errors", () => {
  const { outlines } = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [], { "shed.org": "{" })),
    NOTHING_HELD,
  )

  const shed = outlines.entries.get("shed.org")
  expect(shed?.nodes).toEqual([])
  expect(shed?.broken?.file).toBe("shed.org")
  expect(shed?.broken?.errors.length).toBeGreaterThan(0)
  expect(outlines.entries.get("house.org")?.broken).toBeNull()
})

test("only the files the probe re-decoded are upserted", () => {
  const before = publishedOf(
    revision(setOf({ "house.org": HOUSE, "garden.org": GARDEN })),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(
      setOf({
        "house.org": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
      }, [["notes.md", "changed too"]]),
      { changed: ["house.org", "notes.md"], removed: ["garden.org"] },
      2,
    ),
    before,
  )

  expect(published.outlines.upserts.map(([path]) => path)).toEqual(["house.org"])
  expect(published.outlines.upserts[0]?.[1].rev).toBe(2)
  expect(published.outlines.removes).toEqual(["garden.org"])
  // The document that moved in the same tick is the OTHER collection's upsert,
  // and each one names only its own keys.
  expect(published.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
  // ...AND THE MAP AGREES WITH THE DELTA, which is the assertion this fixture
  // was one line short of and the whole of grok's MUST on `bcc15008`. The
  // revision drops an outline and adds a `.md`, so the DIRECTORY holds two files
  // before and two after and the outlines birth nothing — and a rule that read
  // membership off that count would carry a map still holding `garden.org`,
  // telling an open subscriber to drop a key every fresh one would go on
  // reading. What a collection HOLDS and what it SAID have to be the same thing
  // in both directions.
  expect(published.outlines.entries.has("garden.org")).toBe(false)
  expect([...published.outlines.entries.keys()]).toEqual(["house.org"])
  expect([...published.heads.entries.keys()]).toEqual(["house.org", "notes.md"])
})

// ...AND THE INVERSE, because the two collections are two readings of one rule
// and a fix that only reached the outlines would look exactly like this test
// passing. A `.md` leaves as an outline arrives: the documents collection is
// the one that must not keep the key, and the file count is still still.
test("a key that leaves as another kind arrives is dropped from its own map", () => {
  const before = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(
      setOf({ "house.org": HOUSE, "garden.org": GARDEN }),
      { changed: ["garden.org"], removed: ["notes.md"] },
      2,
    ),
    before,
  )

  expect(published.documents.removes).toEqual(["notes.md"])
  expect(published.documents.entries.has("notes.md")).toBe(false)
  expect([...published.documents.entries.keys()]).toEqual([])
  expect([...published.outlines.entries.keys()]).toEqual(["garden.org", "house.org"])
  // ...and the file the revision did not touch keeps the entry it was published
  // with, rebuilt map or not.
  expect(published.outlines.entries.get("house.org")?.rev).toBe(1)
})

// `rev` IS THE CHANGE TOKEN, which is the half of the sentence above two
// readers rest on: a phase-4 write names the revision it edited as its base,
// and `Head.rev` is how a page WATCHES one file it does not draw — a preview
// waiting for its `.html` to move — without asking for the body. So the
// promise is two-sided and both sides are asserted here: the file that moved
// carries the new revision, and the file that did not carries the very entry it
// was published with, at the old one. A neighbour rebuilt at the new revision
// would cost a reader a needless patch; a changed file republished at the old
// one would leave every tab silently stale.
test("a revision moves for the files that moved and for no others", () => {
  const first = publishedOf(
    revision(setOf({ "house.org": HOUSE, "garden.org": GARDEN })),
    NOTHING_HELD,
  )
  const held = first.outlines.entries.get("garden.org")
  const next = publishedOf(
    revision(
      setOf({
        "house.org": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.org": GARDEN,
      }, []),
      { changed: ["house.org"], removed: [] },
      2,
    ),
    first,
  )

  expect(next.outlines.entries.get("house.org")?.rev).toBe(2)
  expect(next.outlines.entries.get("garden.org")?.rev).toBe(1)
  // The entry itself, not merely a number equal to it: an unchanged file is the
  // value the wire already sent, so a fold keyed on identity would see nothing
  // move either.
  expect(next.outlines.entries.get("garden.org")).toBe(held as never)
})

// A collection may not be told to drop a key it never had — the store talks
// about a directory, and a `.md` leaving it is not an outline leaving this.
test("a removed path that was never an entry is not a remove", () => {
  const held = publishedOf(revision(setOf({ "house.org": HOUSE })), NOTHING_HELD)
  const published = publishedOf(
    revision(setOf({ "house.org": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held,
  )

  expect(published.outlines.removes).toEqual([])
  expect(published.documents.removes).toEqual([])
})

// The whole of snapshot-scale, as one assertion: a document's body is in that
// document's ENTRY, keyed by its path, and it is the only place a projection
// puts one. The other half — that the value every subscription reads on its
// first frame carries no documents — is the `manifest` cell, which this
// projection no longer has anything to say about at all.
test("a document's text is in its own entry, keyed by its path", () => {
  const { outlines, documents } = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]]), {}, 3),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md"])
  expect(documents.entries.get("notes.md")).toEqual({
    rev: 3,
    text: "# hello",
    refused: false,
  })
  // Not smuggled into the outline's slice either: an outline entry is nodes.
  expect(JSON.stringify([...outlines.entries.values()])).not.toContain("# hello")
})

test("a document that left the directory is a remove of its key", () => {
  const held = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(setOf({ "house.org": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held,
  )

  expect(published.documents.removes).toEqual(["notes.md"])
  expect(published.documents.entries.has("notes.md")).toBe(false)
})

// What a collection HOLDS is what it SAID: an untouched file keeps the entry
// it was published with, so the snapshot a fresh subscriber reads and the
// deltas an open one received cannot name different revisions for it. True of
// both collections, because it is one rule read twice.
test("a file that did not move keeps the entry it was published with", () => {
  const first = publishedOf(
    revision(
      setOf({ "house.org": HOUSE, "garden.org": GARDEN }, [["notes.md", "# hello"]]),
    ),
    NOTHING_HELD,
  )
  // TAKEN BEFORE THE NEXT REVISION, and that is not a formality: the map the
  // first revision hands out is the map the second one carries forward
  // ({@link publishedOf} — the revision passed in is consumed), so a `toBe`
  // read off `first` AFTERWARDS would be reading `second`'s own map and would
  // hold whatever it holds. What is being asserted is about the ENTRY, so the
  // entry is what is kept.
  const garden = first.outlines.entries.get("garden.org")
  const notes = first.documents.entries.get("notes.md")
  const second = publishedOf(
    revision(
      setOf({
        "house.org": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.org": GARDEN,
      }, [["notes.md", "# hello"]]),
      { changed: ["house.org"] },
      2,
    ),
    first,
  )

  expect(second.outlines.entries.get("garden.org")).toBe(garden!)
  expect(second.outlines.entries.get("garden.org")?.rev).toBe(1)
  expect(second.outlines.entries.get("house.org")?.rev).toBe(2)
  // An untouched document is not re-published either — which is what keeps an
  // open reader's body from arriving again every time a neighbour is saved.
  expect(second.documents.entries.get("notes.md")).toBe(notes!)
  expect(second.documents.upserts).toEqual([])
})

// A FILE THAT ARRIVES LANDS WHERE THE SET PUTS IT, which is the one thing a
// carried map cannot do for itself: `Map` appends, so a new key written into
// the map the wire already holds would sit at the END of a list every other key
// of which is in path order — and that order is the order a FRESH subscriber's
// snapshot arrives in. So a birth rebuilds its collection's map, and this is
// what says so, with the born file drawn to sort FIRST (where appending is most
// obviously wrong) and into the MIDDLE (where it is least obviously wrong).
//
// The equivalence harness holds the same claim over corpora
// (`./published.equivalence.test.ts`, and its `misplacing` mutant is exactly
// this failure); this is the fixture small enough to write the answer down.
test("a file that arrives takes its place in the listing, not the end of it", () => {
  const before = publishedOf(
    revision(setOf({ "house.org": HOUSE, "wing.org": GARDEN }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  expect([...before.heads.entries.keys()]).toEqual(["house.org", "notes.md", "wing.org"])

  const born = publishedOf(
    revision(
      setOf({ "aaa.org": GARDEN, "house.org": HOUSE, "mid.org": GARDEN, "wing.org": GARDEN }, [[
        "notes.md",
        "# hello",
      ]]),
      { changed: ["aaa.org", "mid.org"] },
      2,
    ),
    before,
  )

  expect([...born.heads.entries.keys()]).toEqual([
    "aaa.org",
    "house.org",
    "mid.org",
    "notes.md",
    "wing.org",
  ])
  expect([...born.outlines.entries.keys()]).toEqual([
    "aaa.org",
    "house.org",
    "mid.org",
    "wing.org",
  ])
  // ...and the files that did NOT arrive keep the entries they were published
  // with, rebuilt map or not: what is rebuilt is the map, never the entries in
  // it.
  expect(born.heads.entries.get("house.org")?.rev).toBe(1)
  expect(born.outlines.entries.get("wing.org")?.rev).toBe(1)
})

// The other kind of bodied file, and the whole memory claim as a projection:
// what the set holds for a `.html` is a path and a `null`, so what the wire
// holds is a key and a `null`. The bytes are not here, they are not in the
// entry the next revision builds, and they are not in the map a fresh
// subscriber is snapshotted from — they are read when a reader opens the key
// (`./bodies.ts`).
test("a `.html` is a key of the collection with no body in it", () => {
  const { documents } = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      {},
      4,
    ),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md", "report.html"])
  expect(documents.entries.get("report.html")).toEqual({
    rev: 4,
    text: null,
    refused: false,
  })
  // The `.md` beside it is untouched by any of this: its text is the set's and
  // travels the same way it always did.
  expect(documents.entries.get("notes.md")).toEqual({
    rev: 4,
    text: "# hello",
    refused: false,
  })
})

// TWO FAILURE CLASSES, and they must not share a face. `set.broken` holds
// every decode Result.fail — a frontmatter typo and an EACCES look the same
// there, only the error code differs. `DocumentEntry.refused` is the READ
// failure (`unreadable-file`). A parse-broken `.md` keeps master's blank
// body, and still carries Head.broken so the sidebar ⚠ has somewhere to
// hang. Folding the two into one sentence is how a typo'd file started
// saying it could not be read.
test("a parse-broken document is not refused, and an unreadable one is", () => {
  const parsed = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]], {
        "torn.md": "whatever the bytes were",
      }),
      {},
      5,
    ),
    NOTHING_HELD,
  )
  expect(parsed.documents.entries.get("torn.md")).toEqual({
    rev: 5,
    text: "",
    refused: false,
  })
  expect(parsed.heads.entries.get("torn.md")?.broken).not.toBeNull()
  expect(parsed.documents.entries.get("notes.md")?.refused).toBe(false)

  const unread = publishedOf(
    revision(
      assemble(
        new Map<string, Result.Result<Document, Verdict>>([
          ["house.org", Result.succeed(outlineOf(HOUSE, "house.org"))],
          [
            "locked.md",
            Result.fail(verdictOf([
              {
                file: "locked.md",
                line: 0,
                code: "unreadable-file",
                message:
                  "EACCES — this file is in the directory and will not open.",
              },
            ])),
          ],
        ]),
      ),
      {},
      6,
    ),
    NOTHING_HELD,
  )
  expect(unread.documents.entries.get("locked.md")).toEqual({
    rev: 6,
    text: "",
    refused: true,
  })
  expect(unread.heads.entries.get("locked.md")?.broken).not.toBeNull()
})

// ── who publishes a body ───────────────────────────────────────────────

// The split, and the two things it has to get right at once. A body the set
// does not keep is NOT written to a key somebody may be showing — that would
// blank the page and re-fill it a moment later, where the body reader replaces
// it in one frame — and a key this revision INTRODUCES is written anyway,
// because an upsert is also how the collection learns its membership changed.
// A `.html` dropped into the directory that never reached the sidebar is what
// the second half of this is written against.
test("a bodyless entry is upserted only when its key is new", () => {
  const first = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"])),
    NOTHING_HELD,
  )
  // Born: the key is announced, `null` and all, which is how the sidebar learns
  // there is a file — and the body is owed to whoever opens it.
  expect(first.documents.upserts.map(([path]) => path)).toEqual([
    "notes.md",
    "report.html",
  ])
  expect(first.unread).toEqual(["report.html"])

  // The same file, changed under a reader who has it open: the body reader
  // publishes it, and the collection is told nothing in the meantime.
  const second = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      { changed: ["report.html"] },
      2,
    ),
    first,
  )
  expect(second.documents.upserts).toEqual([])
  expect(second.unread).toEqual(["report.html"])
  // The ENTRY is still there whichever half publishes it: `readAll` is what a
  // fresh subscription reads, and a key missing from it is a file the sidebar
  // stopped showing.
  expect(second.documents.entries.get("report.html")).toEqual({
    rev: 2,
    text: null,
    refused: false,
  })

  // A file that LEAVES is a remove like any other — nothing about a body the
  // set does not keep changes what a departure is.
  const gone = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]]),
      { changed: [], removed: ["report.html"] },
      3,
    ),
    second,
  )
  expect(gone.documents.removes).toEqual(["report.html"])
  expect(gone.unread).toEqual([])
})

// …AND A BODY IS OWED ONLY WHERE THERE IS ONE TO READ. A picture and a `.pdf`
// are bodied files the set keeps nothing of, exactly like a saved page, and
// there is no text in either for this process to hand anybody: their pages
// fetch the bytes themselves off `/media/`. So the KEY is announced — that is
// what puts the file in the sidebar — and the path is not in `unread`, where
// it would promise a body that, if a raw client ever held the key, would be
// read off the disk and decoded as UTF-8. Which files those are is the
// registry's `holds` column (`@olai/format`'s `textKind`), not a list here.
test("a body is owed for the kinds this process can read, and no others", () => {
  const born = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [
        ["notes.md", "# hello"],
        "report.html",
        "data/sales.csv",
        "art/handle.png",
        "reports/q3.pdf",
      ]),
    ),
    NOTHING_HELD,
  )
  // Every one of them is announced, so the sidebar lists all five.
  expect(born.documents.upserts.map(([path]) => path)).toEqual([
    "art/handle.png",
    "data/sales.csv",
    "notes.md",
    "report.html",
    "reports/q3.pdf",
  ])
  // …and exactly the ones whose body is TEXT are owed a read.
  expect(born.unread).toEqual(["data/sales.csv", "report.html"])
})

// ── the heads ──────────────────────────────────────────────────────────

// EVERY SERVED FILE has a head, and the property the wire promises about it: a
// reader takes its FILE LIST from here, so a head missing for a file the
// directory holds is a file the sidebar stops listing — and a bodied file's
// head is always here to open its body against. It is a SUPERSET of the
// documents' keys since `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10, where
// it was the same list: the browser stopped reading the outlines collection, so
// this is where it learns an outline exists at all.
test("every served file has a head, and it is that file's revision alone", () => {
  const { documents, heads } = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      {},
      4,
    ),
    NOTHING_HELD,
  )

  for (const path of documents.entries.keys()) expect(heads.entries.has(path)).toBe(true)
  expect([...heads.entries.keys()]).toEqual(["house.org", "notes.md", "report.html"])
  expect(heads.entries.get("notes.md")).toMatchObject({ rev: 4 })
  expect(heads.entries.get("report.html")).toMatchObject({ rev: 4 })
  expect(heads.entries.get("house.org")).toMatchObject({ rev: 4 })
  // The head carries the face, which is the whole of what a browser knows about
  // a file it has not opened — and, for an outline, whether it parsed at all.
  expect(heads.entries.get("notes.md")?.face.title).toBe("hello")
  expect(heads.entries.get("house.org")?.broken).toBe(null)
  // …and no content of any kind, which is the whole point of the member.
  expect(heads.entries.get("house.org")).not.toHaveProperty("nodes")
  expect(heads.entries.get("notes.md")).not.toHaveProperty("text")
})

// The half `documents` cannot do, and the reason this member exists. A `.html`
// that changed is withheld from the documents collection — the body reader
// replaces that entry in one frame, and writing a `null` over an open key would
// blank the page — so a reader watching for "this file moved" heard nothing
// there unless somebody read the file. The head has no body to withhold.
test("a `.html` that changed is upserted here even though its body is not", () => {
  const first = publishedOf(
    revision(setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"])),
    NOTHING_HELD,
  )
  expect(first.heads.upserts.map(([path]) => path)).toEqual([
    "house.org",
    "notes.md",
    "report.html",
  ])

  const second = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      { changed: ["report.html"] },
      2,
    ),
    first,
  )
  expect(second.documents.upserts).toEqual([])
  expect(second.heads.upserts.map(([path, head]) => [path, head.rev]))
    .toEqual([["report.html", 2]])
  // …and the file NOBODY touched keeps the number it was published with, so a
  // reader watching it is not woken by the directory's clock.
  expect(second.heads.entries.get("notes.md")?.rev).toBe(1)

  const gone = publishedOf(
    revision(
      setOf({ "house.org": HOUSE }, [["notes.md", "# hello"]]),
      { changed: [], removed: ["report.html"] },
      3,
    ),
    second,
  )
  expect(gone.heads.removes).toEqual(["report.html"])
  expect(gone.heads.entries.has("report.html")).toBe(false)
})
