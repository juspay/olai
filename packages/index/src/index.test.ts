/**
 * THE ONE CLAIM THIS PACKAGE MAKES, tested the only way it can be: the same
 * question, asked twice.
 *
 * A search answered off the index and the same search answered off the corpus
 * must be the SAME ANSWER — the same records, the same documents, the same
 * order, the same reason each is there. Every other property of an index is
 * negotiable and this one is not, so the shape of this file is one helper
 * ({@link same}) and a great many callers of it: a vault written by hand for
 * the corners of the grammar, a generated one for size, and a SOAK that keeps
 * writing to a directory and re-asking after every write.
 *
 * WHY THE SOAK IS THE INTERESTING HALF. A fresh index over a fixed corpus is
 * the easy case and it is not the case that breaks: what breaks an incremental
 * index is the edit — a row for a record that is gone, a record whose text
 * moved and whose row did not, a file the patcher rebuilt rather than patched,
 * a document swapped under a path. Those are states you arrive at, not states
 * you can write down, so the soak arrives at them: random writes against a
 * living reading, with the two answers compared after each one and the row
 * count checked against what the reading holds.
 *
 * IT IS `./patch.test.ts`'s ARGUMENT one layer up, and deliberately so. The
 * patcher holds itself to `derive` with a property test over generated corpora
 * and generated deltas; this holds the index to the corpus walk the same way,
 * over the same generator, because the two are the same kind of claim — a fast
 * answer that is exactly the slow one.
 */

import { expect, test } from "bun:test"
import {
  assemble,
  bodiedIn,
  bodyKind,
  type Bodied,
  bodiedDocument,
  type Document,
  isMirror,
  type Located,
  matching,
  matchingDocuments,
  nodesIn,
  type OutlineError,
  parseFilter,
  parseOutline,
  reading,
  type Reading,
  type Scope,
} from "@olai/format"
import { seeded, vaultOf } from "@olai/format/testlib"
import { Result } from "effect"

import { type Index, open } from "./index.ts"

/** The day the grammar's relative words count from. A constant, so a `date:`
 *  case says the same thing in January. */
const TODAY = "2026-08-13"
const NOW = `${TODAY}T11:00:00-04:00`

/**
 * THE COMPARISON, and the whole of what this file asserts.
 *
 * Three claims in one call, because they fail in different ways and a test that
 * made only the first would pass for the wrong reason on the day the index
 * started answering `null` to everything:
 *
 *   1. the two answers are EQUAL — the records, the documents, their order and
 *      the match on each. This is the claim;
 *   2. the candidates were a SUPERSET of what matched, which is what makes (1)
 *      structural rather than lucky: if the index ever hands back less than the
 *      answer, this says so at the candidate rather than at the hit;
 *   3. whether it narrowed AT ALL is handed back, so a caller can insist that
 *      some of its cases actually went through the index.
 */
const same = (
  at: Reading,
  index: Index,
  text: string,
  scope: Scope = {},
): { readonly narrowed: boolean; readonly hits: number } => {
  const filter = parseFilter(text, NOW)
  const walked = matching(at.derived, filter, scope)
  const walkedDocuments = matchingDocuments(bodiedIn(at.set), filter, scope)

  const candidates = index.narrow(at, filter)
  const indexed = matching(at.derived, filter, scope, candidates?.nodes)
  const indexedDocuments = matchingDocuments(
    bodiedIn(at.set),
    filter,
    scope,
    candidates?.documents,
  )

  if (candidates !== null) {
    for (const one of walked) expect(candidates.nodes).toContain(one.at.node.id)
    for (const one of walkedDocuments) expect(candidates.documents).toContain(one.at.path)
  }
  expect(indexed).toEqual(walked)
  expect(indexedDocuments).toEqual(walkedDocuments)
  return {
    narrowed: candidates !== null,
    hits: walked.length + walkedDocuments.length,
  }
}

/** Opened per test and closed after it, so a failing case leaves no table
 *  behind and no case can be answered out of another's rows. A runtime that
 *  cannot give us one fails every case in this file rather than skipping them,
 *  which is {@link open}'s own decision read from the other side: a green run
 *  that tested nothing is the outcome this file exists to prevent. */
const opened = (): Index => open()

// ── a vault written by hand, for the corners of the grammar ────────────

/** A `NUL` and half a surrogate pair, written the way a JSON line can carry
 *  them — which is how they reach a vault at all, and why they are in the
 *  fixture rather than in a note about theoretical inputs. Both are refused as
 *  NEEDLES by the engine's own predicate; neither may change what a query about
 *  the text AROUND them finds. */
const NUL = String.fromCharCode(0)
const LONE = String.fromCharCode(0xd83d)

const HAND = {
  "house.olai": [
    `{"id":"house","ord":"a0","title":"House #home"}`,
    `{"id":"kitchen","parent":"house","ord":"a1","title":"Remodel the kitchen","desc":"walnut cabinets and a new sink","todo":true,"date":"2026-08-14","custom":{"pr":"#258","agent":"claude-opus"}}`,
    `{"id":"chen","parent":"house","ord":"a2","title":"Ask chen remodelling costs","done":"2026-08-10T09:00:00-04:00"}`,
    `{"id":"cafe","parent":"house","ord":"a3","title":"Café ÉCOLE naïve straße","desc":"日本語 の ノート"}`,
    `{"id":"emoji","parent":"house","ord":"a4","title":"a😀b party @alice","created":"2026-08-01T08:00:00-04:00"}`,
    `{"id":"tiny","parent":"house","ord":"a5","title":"ab","desc":"xy"}`,
    `{"id":"quoted","parent":"house","ord":"a6","title":"one two three","after":["kitchen"]}`,
    JSON.stringify({
      id: "hostile",
      parent: "house",
      ord: "a7",
      title: `before${NUL}afterword and ab${LONE}cd`,
      desc: `tail${NUL}prose about lacquer`,
    }),
  ].join("\n"),
  "work.olai": [
    `{"id":"work","ord":"a0","title":"Work #office"}`,
    `{"id":"invoice","parent":"work","ord":"a1","title":"Send the invoice","todo":true,"changed":"2026-08-13T10:30:00-04:00"}`,
    `{"id":"mirror-kitchen","parent":"work","ord":"a2","mirror":"kitchen"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"gone","ord":"a0","title":"Old kitchen plan","desc":"walnut, once"}`,
  ].join("\n"),
} as const

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  [
    "notes/cabinets.md",
    "---\nagent: claude-opus\ntags: [\"#home\"]\n---\n\nThe walnut cabinets, and what the kitchen costs.\n",
  ],
  ["notes/Café.md", "École and a naïve note about straße.\n"],
  ["notes/empty.md", "nothing much here\n"],
]

/** The `.html` the set holds the PATH of and not the bytes — findable by name
 *  and by nothing else, which is a case the index has to hold a row for or the
 *  palette stops finding saved pages. */
const UNKEPT = "pages/kitchen-inspiration.html"

const handVault = (): Reading =>
  reading(
    assemble(
      new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>([
        ...Object.entries(HAND).map(
          ([file, text]) =>
            [file, parseOutline(file, text)] as [
              string,
              Result.Result<Document, ReadonlyArray<OutlineError>>,
            ],
        ),
        ...DOCUMENTS.map(
          ([path, text]) =>
            [path, Result.succeed<Document>(bodiedDocument(path, text))] as const,
        ),
        [UNKEPT, Result.succeed<Document>(bodiedDocument(UNKEPT, null))],
      ]),
    ),
  )

/**
 * The grammar, corner by corner. Every entry is a query the two paths must
 * agree about; what each is HERE for is in the comment beside it, because a
 * table of strings with no reasons in it is a table nobody dares delete from.
 */
const CORNERS: ReadonlyArray<string> = [
  // The plain substring, which is the whole reason a word index would not do.
  "remo",
  "kitchen",
  // ...and the one that crosses a word boundary, which is why the trigrams
  // include the spaces.
  "chen remo",
  // A phrase is a word with spaces in it, quoted.
  `"the kitchen"`,
  `"remodel the"`,
  // Two words: every group must hold.
  "walnut cabinets",
  // ...and one that holds in two different fields of one record.
  "kitchen walnut",
  // `OR`: a group holds when ANY alternative does — the case a flattened needle
  // list would answer with the intersection and get wrong.
  "kitchen OR invoice",
  "kitchen OR zzzzz",
  "zzzzz OR qqqqq",
  // A group with a word AND an OR group beside it.
  "walnut kitchen OR invoice",
  // Under the trigram floor, either way round: these must reach the corpus.
  "ab",
  "a",
  "xy",
  // ...and the same words as part of something longer.
  "cab",
  // A negation narrows nothing and is not asked of the index.
  "-walnut",
  "kitchen -walnut",
  "kitchen -zzzzz",
  // Operators alone — no word to look up at all.
  "is:done",
  "is:todo",
  "is:marked",
  "is:blocked",
  "is:mirrored",
  "has:desc",
  "has:date",
  "date:2026-08-14",
  "date:2026-08-01..2026-08-20",
  "created:2026-08",
  "changed:2026-08-13",
  "prop:pr",
  "prop:agent=claude-opus",
  "prop:agent=nobody",
  // ...and each with a word, which is the shape the index narrows and the
  // clauses then cut down further.
  "kitchen is:todo",
  "kitchen is:done",
  "remodelling is:done",
  "walnut has:desc",
  "cabinets prop:agent=claude-opus",
  // The archive: out of every reading unless the query names it.
  "walnut is:trashed",
  "plan is:trashed",
  "plan",
  "-is:trashed walnut",
  // Case, which the fold settles and the index must fold identically.
  "REMODEL",
  "KiTcHeN",
  // Non-ASCII, which is where a second folding rule would show up first: an
  // engine that folds differently from `toLowerCase` finds one of these and not
  // the other.
  "café",
  "CAFÉ",
  "école",
  "ÉCOLE",
  "naïve",
  "straße",
  "日本語",
  "ノート",
  // An emoji is two UTF-16 units and one character — a needle the floor has to
  // count in code points or hand to an engine that finds nothing for it.
  "a😀b",
  "😀b",
  "😀",
  // A tag, bare and as written.
  "#home",
  "home",
  "alice",
  "@alice",
  // The other arm of the set: a document by prose, by title, by path, by its
  // name alone, by frontmatter, and the `.html` whose bytes nobody read.
  "cabinets",
  "notes/",
  "inspiration",
  "kitchen-inspiration",
  "nothing much",
  // The two characters the engine cannot be ASKED about, in a needle and in the
  // text around one. A word beside a `NUL` is found normally, because stored
  // text is handed over with a length; a needle carrying one — or carrying half
  // a surrogate pair — is refused by the engine's predicate and walks the
  // corpus, which has to be the SAME answer and not merely a safe one.
  "afterword",
  "lacquer",
  `before${NUL}after`,
  `tail${NUL}prose`,
  `ab${LONE}cd`,
  `b${LONE}c`,
  // A query that finds nothing at all, which is the answer an empty candidate
  // set has to be distinguishable from `null` by.
  "zzzzzzzz",
  // The empty box and a refused query select nothing and ask nothing.
  "",
  "is:open",
  "date:soon",
]

test("index and corpus answer the grammar's corners identically", () => {
  const index = opened()
  const at = handVault()
  let narrowed = 0
  let found = 0
  try {
    for (const text of CORNERS) {
      const answer = same(at, index, text)
      if (answer.narrowed) narrowed += 1
      found += answer.hits
    }
  } finally {
    index.close()
  }
  // The table is not all fallbacks, and it is not all misses: a run where the
  // index never narrowed, or where nothing ever matched, would satisfy every
  // `toEqual` above and prove nothing.
  expect(narrowed).toBeGreaterThan(30)
  expect(found).toBeGreaterThan(40)
})

test("a scope narrows the same records whichever way the candidates came", () => {
  const index = opened()
  const at = handVault()
  try {
    for (const text of ["kitchen", "remo", "walnut", "cabinets", "house"]) {
      same(at, index, text, { file: "house.olai" })
      same(at, index, text, { file: "work.olai" })
      same(at, index, text, { under: "house" })
      same(at, index, text, { under: "work" })
      same(at, index, text, { under: "kitchen" })
      same(at, index, text, { trashed: true })
    }
  } finally {
    index.close()
  }
})

test("a needle under the trigram floor is not asked of the index at all", () => {
  const index = opened()
  const at = handVault()
  try {
    // Two characters, one character, and two characters that happen to be one
    // emoji: none of them makes a trigram, so all three are the corpus walk.
    // `ab OR kitchen` is one GROUP and goes the same way — a group narrows by
    // all of its alternatives or by none of them, since a record matching the
    // arm that cannot be looked up is a record the other arm would lose.
    for (const text of ["ab", "a", "😀", "ab OR kitchen"]) {
      expect(index.narrow(at, parseFilter(text, NOW))).toBeNull()
    }
    // ...and three characters is where it starts answering.
    expect(index.narrow(at, parseFilter("abc", NOW))).not.toBeNull()
    expect(index.narrow(at, parseFilter("a😀b", NOW))).not.toBeNull()
    // ...and the two the ENGINE cannot be asked about however long they are: a
    // needle carrying a `NUL` (which would end FTS5's phrase early and raise
    // `unterminated string`) and one carrying half a surrogate pair (which
    // comes back with no rows for text that plainly holds it). Both are refused
    // by the predicate rather than tried, so both walk the corpus — and the
    // table above proves the walk is the same answer.
    for (const text of [`before${NUL}after`, `ab${LONE}cd`, `b${LONE}c`]) {
      expect(index.narrow(at, parseFilter(text, NOW))).toBeNull()
    }
    // A word under the floor beside one over it narrows by the one over it and
    // leaves the rest to the matcher, which is the conjunction read the only
    // way it can be: dropping a group loses no record, dropping an alternative
    // would.
    expect(index.narrow(at, parseFilter("😀 kitchen", NOW))?.nodes).toEqual(
      index.narrow(at, parseFilter("kitchen", NOW))?.nodes as ReadonlySet<string>,
    )
  } finally {
    index.close()
  }
})

test("the index holds one row per record and document, and no more", () => {
  const index = opened()
  const at = handVault()
  try {
    index.narrow(at, parseFilter("kitchen", NOW))
    expect(index.rows()).toBe(recordCount(at) + bodiedIn(at.set).length)
  } finally {
    index.close()
  }
})

// ── the soak: random writes, and the same question after each one ──────

/** What a record's title and note are built out of. Short and repetitive on
 *  purpose: a vocabulary of a thousand words would make every query select one
 *  record, and the interesting comparisons are the ones with a crowd in them. */
const WORDS = [
  "kitchen",
  "garden",
  "invoice",
  "walnut",
  "budget",
  "remodel",
  "café",
  "straße",
  "日本語",
  "upkeep",
  "ab",
  "brass",
]

const TAGS = ["#home", "#office", "#later"]

/** One file's JSONL — a root and its children, marked, dated, tagged and noted
 *  by the seeded stream so the corpus has something for every operator in the
 *  query pool to select on. */
const fileOf = (random: () => number, at: number, records: number): string => {
  const root = `f${at}r`
  const lines = [JSON.stringify({ id: root, ord: "a0", title: `file ${at} ${pick(random)}` })]
  for (let which = 1; which < records; which++) {
    const record: Record<string, unknown> = {
      id: `f${at}n${which}`,
      parent: root,
      ord: `a${which}`,
      title: `${pick(random)} ${pick(random)} ${which} ${
        TAGS[Math.floor(random() * TAGS.length)] as string
      }`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.2) record["done"] = `2026-08-0${which % 9}T09:00:00-04:00`
    if (random() < 0.25) record["desc"] = `a note about ${pick(random)} and ${pick(random)}`
    if (random() < 0.2) record["date"] = `2026-08-${String((which % 28) + 1).padStart(2, "0")}`
    if (random() < 0.15) record["custom"] = { agent: pick(random), pr: `#${which}` }
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

const pick = (random: () => number): string =>
  WORDS[Math.floor(random() * WORDS.length)] as string

/** The queries the soak re-asks after every write. Mixed on purpose: words the
 *  index can narrow by, words it cannot, operators it never sees, and the
 *  combinations that make a group unusable. */
const POOL: ReadonlyArray<string> = [
  "kitchen",
  "garden",
  "walnut budget",
  "kitchen OR garden",
  "café",
  "straße",
  "日本語",
  "upkeep is:todo",
  "note about",
  `"a note about"`,
  "ab",
  "remodel -walnut",
  "is:done",
  "has:desc",
  "date:2026-08-14",
  "prop:agent",
  "brass prop:pr",
  "file 3",
  "zzzzzzzz",
  "#home",
  "office",
]

const recordCount = (at: Reading): number => {
  let count = 0
  for (const [, records] of at.derived.byFile) {
    for (const one of records) if (!isMirror(one.node)) count += 1
  }
  return count
}

test("index and corpus stay in step through a soak of random writes", () => {
  const index = opened()
  try {
    const random = seeded(20260824)
    const FILES = 24
    const RECORDS = 9
    const ROUNDS = 60

    const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>()
    for (let at = 0; at < FILES; at++) {
      const path = `note${at}.olai`
      decoded.set(path, parseOutline(path, fileOf(random, at, RECORDS)))
    }
    for (let at = 0; at < 6; at++) {
      const path = `doc${at}.md`
      decoded.set(
        path,
        Result.succeed<Document>(
          bodiedDocument(path, `---\nagent: ${pick(random)}\n---\n\nprose about ${pick(random)}\n`),
        ),
      )
    }

    let read = reading(assemble(decoded))
    let minted = FILES
    let narrowed = 0
    let found = 0

    for (let round = 0; round < ROUNDS; round++) {
      const changed: Array<string> = []
      const removed: Array<string> = []
      // Which arm a path is on is asked of the REGISTRY, never of its spelling:
      // `@olai/format`'s `kinds.ts` is the one place that says what a file of
      // the set is, and a `endsWith` here would be a second answer to it (the
      // sweep in `@olai/tests`' `kinds.test.ts` fails on one).
      const outlines = [...decoded.keys()].filter((path) => bodyKind(path) === null)
      const markdown = [...decoded.keys()].filter((path) => bodyKind(path) !== null)

      // One to three files move per round, which is the shape of a write: a
      // keystroke touches one, a bulk gesture a handful, a `git pull` more.
      const moves = 1 + Math.floor(random() * 3)
      for (let move = 0; move < moves; move++) {
        const roll = random()
        if (roll < 0.55 && outlines.length > 0) {
          // REWRITTEN — the common case, and the one where a row whose text
          // moved and whose index entry did not would show up.
          const path = outlines[Math.floor(random() * outlines.length)] as string
          decoded.set(path, parseOutline(path, fileOf(random, minted++, RECORDS)))
          changed.push(path)
        } else if (roll < 0.7 && outlines.length > 4) {
          // GONE — the case where a row outlives the file it came from, which
          // is invisible to a query that never happens to select it.
          const path = outlines[Math.floor(random() * outlines.length)] as string
          decoded.delete(path)
          removed.push(path)
        } else if (roll < 0.85) {
          // NEW.
          const path = `note${minted}.olai`
          decoded.set(path, parseOutline(path, fileOf(random, minted++, RECORDS)))
          changed.push(path)
        } else if (markdown.length > 0) {
          // A DOCUMENT swapped under its path — the other arm, whose identity
          // the index tracks the same way and whose body is the expensive text.
          const path = markdown[Math.floor(random() * markdown.length)] as string
          decoded.set(
            path,
            Result.succeed<Document>(
              bodiedDocument(
                path,
                `---\nagent: ${pick(random)}\n---\n\nprose about ${pick(random)} and ${
                  pick(random)
                }\n`,
              ),
            ),
          )
          changed.push(path)
        }
      }
      if (changed.length + removed.length === 0) continue

      const set = assemble(decoded)
      // EVERY SEVENTH ROUND IS A REBUILD, offered no previous reading at all —
      // which is what a first load is, and what the patcher falls back to when
      // it declines (a `git pull` that rewrote the directory). Every file's
      // records are then a new array, so the index re-indexes the whole corpus,
      // and the row count below is what says it did so without leaving the old
      // rows behind. A soak of patches alone would never reach that path.
      read = round % 7 === 6 ? reading(set) : reading(set, {
        read,
        delta: {
          upserts: changed.map(
            (file) =>
              [file, { nodes: nodesIn(decoded.get(file)) as ReadonlyArray<Located> }] as const,
          ),
          removes: removed,
        },
      })

      for (const text of POOL) {
        const answer = same(read, index, text)
        if (answer.narrowed) narrowed += 1
        found += answer.hits
      }
      // The maintenance invariant, checked every round rather than at the end:
      // an index that answers correctly while keeping a row per edit forever
      // has no other symptom, and by the last round the arithmetic would no
      // longer say which round it started in.
      expect(index.rows()).toBe(recordCount(read) + bodiedIn(read.set).length)
    }

    expect(narrowed).toBeGreaterThan(ROUNDS * 5)
    expect(found).toBeGreaterThan(ROUNDS * 5)
  } finally {
    index.close()
  }
})

test("index and corpus agree over a generated vault", () => {
  const index = opened()
  try {
    const corpus = vaultOf({ files: 120, records: 12 })
    const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>()
    for (const [path, text] of corpus) decoded.set(path, parseOutline(path, text))
    const at = reading(assemble(decoded))
    // IT REALLY NARROWS, which every `toEqual` in this file would go on passing
    // if it stopped: an index that handed back the whole corpus as candidates
    // is a correct index and a pointless one, and this is the only assertion
    // that can tell the two apart.
    const held = recordCount(at)
    const selective = index.narrow(at, parseFilter(`"of file 11"`, NOW))
    expect(selective?.nodes.size ?? held).toBeLessThan(held / 5)
    // ...and the other end of the same fact: a word in nearly every record is
    // a CROWD, and the table declines rather than spend a lookup to hand back
    // the corpus. `null` here is the corpus walk, which the comparisons below
    // then hold it to — declining may not change an answer, only a cost.
    expect(index.narrow(at, parseFilter("record", NOW))).toBeNull()
    let found = 0
    for (
      const text of [
        "record",
        "record 3",
        "file 1",
        "upkeep",
        "note about",
        `"a note about"`,
        "upkeep1 OR upkeep2",
        "record is:todo",
        "zzzzzzzz",
        "of file 11",
      ]
    ) {
      found += same(at, index, text).hits
    }
    expect(found).toBeGreaterThan(0)
  } finally {
    index.close()
  }
})

test("a document that leaves takes its row with it", () => {
  const index = opened()
  try {
    const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>([
      ["a.olai", parseOutline("a.olai", `{"id":"one","ord":"a0","title":"a kitchen row"}`)],
      ["note.md", Result.succeed<Document>(bodiedDocument("note.md", "kitchen prose"))],
    ])
    const before = reading(assemble(decoded))
    expect(same(before, index, "kitchen").hits).toBe(2)

    decoded.delete("note.md")
    const after = reading(assemble(decoded), {
      read: before,
      delta: { upserts: [], removes: ["note.md"] },
    })
    expect(same(after, index, "kitchen").hits).toBe(1)
    expect(index.rows()).toBe(1)
  } finally {
    index.close()
  }
})

/** The fold is the matcher's, and the point of asking for it here is that the
 *  index holds no second opinion about what a document IS: a `.html` the set
 *  keeps the path of has no prose, so a word only its neighbours say must not
 *  find it, and its NAME must. */
test("a file the set holds the path of is findable by name and not by prose", () => {
  const index = opened()
  const at = handVault()
  try {
    const named = same(at, index, "inspiration")
    expect(named.hits).toBe(1)
    const bodied: ReadonlyArray<Bodied> = bodiedIn(at.set)
    expect(bodied.map((one) => one.path as string)).toContain(UNKEPT)
  } finally {
    index.close()
  }
})
