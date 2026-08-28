/**
 * @olai/index — the maintained search index, and NOTHING that decides.
 *
 * Every door that searches the directory used to read every record and every
 * body in it, once per query: `search_nodes`, the ⌘K palette, the header's box
 * and the chat composer's `@` list are one procedure (`@olai/ops`' `Query`),
 * and that procedure was a walk of the corpus per settled keystroke. This
 * package is what it walks INSTEAD — a table of the same folded text, kept up
 * to date from what a revision actually moved, asked for the small set of
 * records and documents a query COULD select. The design, with the libraries
 * that were surveyed and why none of them can be used, is
 * https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/search-index.md.
 *
 * ## The one thing to understand
 *
 * WHAT THIS ANSWERS IS NOT AN ANSWER. It is a superset — candidates — and the
 * matcher one layer down is what says which of them the query selects, in which
 * order, with which field carrying the hit. That is not a division of labour
 * chosen for tidiness; it is the entire correctness argument. An index that
 * over-includes costs a comparison per extra candidate and cannot change what
 * search finds; an index that decides would be a second reading of a grammar
 * with five doors on it, and the day it disagreed with `filter.ts` is the day
 * `is:done` means two things (docs/search.md). So:
 *
 *   - the TEXT held here is the matcher's own fold, run together — `hayOf` and
 *     `documentHayOf`, exported by `@olai/format` for exactly this;
 *   - WHICH of a query's words may narrow it is the grammar's answer too
 *     (`narrowableBy`), because getting `OR` wrong is the one way a narrowing
 *     is wrong rather than wide;
 *   - what comes back is fed to that same `matching` / `matchingDocuments` the
 *     corpus walk goes through, which resolves the ids, applies the scope, the
 *     archive rule and the mirror rule, and puts the answer in the set's order.
 *
 * The property this leaves is pinned rather than argued: `./index.test.ts`
 * compares the two answers over a fixture vault, over a generated one and over
 * a soak of random writes, and fails on the first pair that differs.
 *
 * ## Why trigrams, and why SQLite
 *
 * olai's matcher finds a case-folded SUBSTRING, anywhere — `remo` finds
 * "Remodel", `chen remo` matches across a word boundary. Every word-based
 * search library there is would change that, which the brainstorm surveys at
 * length; what does not is a trigram index (Google Code Search's design, and
 * Zoekt's and pg_trgm's): index every three characters in a row, intersect the
 * query's, verify the shortlist. Bun ships SQLite with FTS5 and the trigram
 * tokenizer compiled in, so the trigram table is a library and not something
 * this repository maintains — which was the instruction, and is the difference
 * between this file and a postings map on the JS heap.
 *
 * Its one limit is the tokenizer's: a needle shorter than three characters
 * makes no trigram and can be looked up in nothing. Those queries walk the
 * corpus exactly as they always did ({@link FLOOR}) — no regression, and the
 * first two keystrokes of a search are precisely that case.
 *
 * ## Where it lives, and how it stays true
 *
 * IN MEMORY, in the process that holds the store, opened once per served
 * directory (`@olai/ops`' `make`). Not on disk: an index file beside somebody's
 * vault is a file to invalidate, to version, to garbage-collect and to explain,
 * for a table that is rebuilt from a directory already in RAM.
 *
 * IT FOLLOWS THE READING AT THE DOOR rather than being pushed at from a
 * publisher, and that is the whole of why staleness is not a thing this file
 * has to reason about. {@link Index.narrow} is handed the very `Reading` the
 * answer is about, brings the table level with it, and only then looks
 * anything up — so there is no window in which a search can be answered from a
 * revision behind the one it was asked of. What "level with it" costs is what
 * MOVED: the reading's `byFile` names each file's records by identity, a
 * patched view hands back the same array for every file an edit did not touch
 * ({@link ../../format/src/patch.ts}), and the files whose arrays are new are
 * exactly the files a write rewrote. A keystroke pays a walk of the file table;
 * a write pays its own records.
 */

import { Database } from "bun:sqlite"

import {
  type Bodied,
  bodiedIn,
  documentHayOf,
  type Filter,
  hayOf,
  isMirror,
  type Located,
  narrowableBy,
  type Reading,
  type RegularNode,
} from "@olai/format"

/**
 * The shortest needle a trigram table can look up, in CHARACTERS.
 *
 * Three, because a trigram is three characters and a shorter needle produces
 * none — FTS5 answers such a query with nothing at all rather than with an
 * error, which is the failure mode {@link lookupable} exists to keep out of the
 * search path.
 */
const FLOOR = 3

/**
 * WHETHER THIS ENGINE CAN BE ASKED ABOUT THIS WORD AT ALL — the predicate
 * {@link narrowableBy} narrows a query by, and the whole of what this package
 * knows that the grammar does not.
 *
 * Three reasons a word is refused, and each one was measured rather than
 * assumed. Every one of them is a fact about SQLite's FTS5 and not about olai's
 * query language, which is why the grammar takes a predicate and not a number.
 *
 *   - IT IS TOO SHORT. Under three characters there is no trigram to look up
 *     and FTS5 answers with nothing rather than with an error, which would be a
 *     hit silently missing. Counted in CODE POINTS: an engine that indexes
 *     characters sees two in `a😀` where `String.length` sees three, so a word
 *     let through on the wrong count is a word the table finds nothing for.
 *     The count stops at three rather than walking the word, because a needle
 *     may be a whole quoted paragraph;
 *   - IT CARRIES A `NUL`. FTS5's query parser reads the expression as a C
 *     string, so a `\0` inside a phrase ends the phrase early and the call
 *     raises `unterminated string`. Stored text is unaffected — that side is
 *     handed a length — so this is a rule about needles alone;
 *   - IT IS NOT WELL FORMED. Half a surrogate pair survives in a JavaScript
 *     string and does not survive the trip to UTF-8, and the two sides of the
 *     comparison do not mangle it into the same thing: a needle carrying one
 *     comes back with NO rows for text that plainly holds it. A word without
 *     one is unharmed by a lone surrogate sitting in the TEXT, since a needle
 *     that does not contain it is still a contiguous run of characters the
 *     mangling never touched.
 *
 * All three fail the same safe way: the group is dropped, the rest of the query
 * still narrows, and a query with nothing left walks the corpus.
 *
 * EXPORTED, though nothing outside this package narrows anything: the bench
 * needs to tell the two reasons a query walked apart — the grammar had no word
 * to look up, or the table looked and declined a crowd — and it was doing that
 * with `word.length >= 3` written out again, which is a third spelling of the
 * rule this package says must have one, in UTF-16 units rather than in the code
 * points it is actually counted in (pi's review of `cca1b21`). One spelling,
 * reachable by whoever has to ask the same question.
 */
export const lookupable = (word: string): boolean =>
  longEnough(word) && !word.includes("\0") && word.isWellFormed()

/** At least {@link FLOOR} code points, counted no further than it needs to be.
 *  A code point is at most two UTF-16 units, so anything twice the floor long
 *  is long enough without looking; below that, the iterator counts and stops. */
const longEnough = (word: string): boolean => {
  if (word.length >= FLOOR * 2) return true
  let seen = 0
  for (const _ of word) {
    seen += 1
    if (seen >= FLOOR) return true
  }
  return false
}

/**
 * WHEN AN INDEX IS NOT WORTH ASKING: a lookup that would hand back more than
 * this share of the directory declines, and the corpus is walked instead.
 *
 * An index is worth exactly what it THROWS AWAY. A word in one record turns a
 * walk of the vault into a walk of one; a word in nine records out of ten turns
 * it into a walk of nine tenths of the vault plus the cost of finding out which
 * nine tenths — which is slower than simply walking, and measurably so
 * (`./index.bench.ts` prints the band where it crosses over). The third
 * keystroke of a common prefix is exactly that query, so this is not a corner.
 *
 * IT IS CHEAP TO FIND OUT, which is the only reason it can be asked at all: the
 * lookup takes one more row than the share allows, and FTS5 stops reading
 * postings when the limit is met. So a query that declines costs a bounded
 * fraction of the walk it then falls back to, rather than the whole lookup it
 * was going to throw away.
 *
 * THE FLOOR IS THERE FOR SMALL DIRECTORIES, where a quarter is a handful of
 * rows and both paths are under a millisecond: declining there would be a
 * heuristic firing constantly to save nothing, and the answer would be the same
 * either way.
 *
 * BOTH ARE EXPORTED so the soak can STEER ACROSS the line rather than guess at
 * where it is. That is not a knob a caller turns — nothing outside this package
 * reads them at runtime — but a test whose whole subject is "the same
 * incrementally maintained table, above the threshold and then below it" has to
 * size its corpus off the real number, and a `1024` written out in the test
 * would be a second spelling that goes on passing after this one moves
 * (`./index.test.ts`, on both reviewers' finding about `cca1b21`).
 */
export const CROWD = 4
export const CROWD_FLOOR = 1024

/** Which arm of the set a candidate is from. The two travel in one table and
 *  one query — a directory search asks both halves the same question at the
 *  same moment — and are told apart on the way out, because the two are
 *  resolved differently by the matcher: an id names a record, a path names a
 *  document. */
type Kind = "node" | "document"

/**
 * WHAT MIGHT MATCH — ids of records and paths of documents, unordered, with
 * anything extra in them.
 *
 * Two sets rather than one list of pairs, because the two are handed to two
 * different functions and neither wants to filter the other's entries out of a
 * list first. Both may be empty, which is a real answer: a query whose words
 * are in nothing selects nothing, and the matcher is then run over no
 * candidates at all rather than over the corpus.
 */
export interface Candidates {
  readonly nodes: ReadonlySet<string>
  readonly documents: ReadonlySet<string>
}

/**
 * The index, as the one thing a caller does with it.
 *
 * ONE DOOR AND NOT TWO, deliberately: "catch up with this reading" and "answer
 * this query" are one call, so there is no order to get wrong and no way to
 * ask a table about a revision it has not seen. The cost of the catching up is
 * what moved since the last call, and a caller asking twice at one revision
 * pays for it once.
 */
export interface Index {
  /**
   * The candidates for this query at this reading — or `null` when the grammar
   * gives nothing to narrow by, which means ASK THE CORPUS and is what every
   * query did before this package existed.
   *
   * `null` and an empty {@link Candidates} are opposite answers and must not be
   * confused: `null` is "this index has nothing to say about that query", and
   * an empty pair is "it has looked, and nothing can match".
   */
  readonly narrow: (at: Reading, filter: Filter) => Candidates | null
  /** How many rows the table holds — one per indexed record and document. A
   *  reading for a test and a bench rather than for the search path: what it
   *  catches is the maintenance bug that has no other symptom, an index that
   *  answers correctly while growing a row per edit forever. */
  readonly rows: () => number
  /**
   * What the table WEIGHS, in bytes — the pages SQLite holds for it.
   *
   * A reading for the bench, and it exists because of where these postings
   * live. The design priced the engine on DISK ("index ≈ 3× the text",
   * https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/search-index.md) and this implementation put it in
   * memory instead, for the life of the process, which is a different bill
   * nobody had been shown: a figure the leg prints is the difference between
   * that trade being made and being assumed (pi's review of `cca1b21`).
   *
   * `page_count × page_size`, which is core SQLite rather than the `dbstat`
   * extension a build may lack — the whole database, which is this table and
   * its keys and nothing else. It is the postings ALONE: the fold they were
   * built from is not stored (`content=''`), and the JavaScript beside them is
   * two maps of pointers at arrays the reading already holds.
   */
  readonly bytes: () => number
  readonly close: () => void
}

/**
 * Open one.
 *
 * IT THROWS RATHER THAN DEGRADES, and that is a decision rather than an
 * oversight. What this needs of the runtime's SQLite is two things a build
 * could in principle be without — the FTS5 extension with the `trigram`
 * tokenizer, and `contentless_delete`, which is what lets a row leave a table
 * that stores no copy of its own text (SQLite 3.43+; Bun 1.4 ships 3.53) — and
 * the tempting thing is to catch the schema failing and hand back a working
 * olai with a slower search. That would be an error nobody is ever told about
 * (HACKING.md's rule) hiding behind a table that quietly stopped existing:
 * every query would go on answering correctly and nothing on any screen would
 * say why the vault got slow. The engine is pinned by this repository's own
 * flake, every test in this package asserts the capability on every run, and a
 * build that cannot make the table is a broken build that should say so at the
 * door.
 */
export const open = (): Index => {
  const db = new Database(":memory:")
  // The KEYS, in a table of their own: what an fts5 table can hand back is a
  // rowid, and a contentless one cannot even hand back the unindexed columns
  // sitting beside its text (they read as null). So the rowid is the join,
  // and this side holds what a candidate IS — which arm of the set, which id
  // or path, and which FILE it came out of, since a file is the unit a
  // revision moves and therefore the unit this is maintained by.
  db.run(
    `create table rec(
       rowid integer primary key,
       kind text not null,
       key text not null,
       file text not null
     )`,
  )
  db.run(`create index rec_file on rec(file)`)
  // CONTENTLESS, which is the difference between an index and a second copy
  // of the vault: `content=''` stores the trigrams and not the text, so the
  // table is the postings alone. The text it was built from is in the records
  // the reading already holds, and the only reader who needs it — the matcher
  // — reads it from there.
  db.run(
    `create virtual table hay using fts5(
       text,
       tokenize = 'trigram',
       content = '',
       contentless_delete = 1
     )`,
  )

  const insertRec = db.prepare<void, [number, Kind, string, string]>(
    `insert into rec(rowid, kind, key, file) values (?, ?, ?, ?)`,
  )
  const insertHay = db.prepare<void, [number, string]>(
    `insert into hay(rowid, text) values (?, ?)`,
  )
  const rowsOfFile = db.prepare<{ rowid: number }, [string]>(
    `select rowid from rec where file = ?`,
  )
  const dropRec = db.prepare<void, [string]>(`delete from rec where file = ?`)
  const dropHay = db.prepare<void, [number]>(`delete from hay where rowid = ?`)
  /** The two halves of {@link Index.bytes}, prepared beside every other
   *  statement rather than composed as text when asked: a pragma is a query
   *  here like any other. */
  const pages = db.prepare<{ page_count: number }, []>(`pragma page_count`)
  const pageSize = db.prepare<{ page_size: number }, []>(`pragma page_size`)
  const looked = db.prepare<{ kind: Kind; key: string }, [string, number]>(
    `select rec.kind as kind, rec.key as key
       from hay join rec on rec.rowid = hay.rowid
      where hay.text match ?
      limit ?`,
  )

  /**
   * WHAT IS INDEXED, BY FILE, and by IDENTITY rather than by content — the
   * whole of how this table knows whether it is level with a reading.
   *
   * The value is the very array the view holds for that file, so the test is a
   * pointer comparison and the answer is exact: a patched view shares its array
   * with the view it patched wherever an edit did not touch the file
   * (`@olai/format`'s `patch.ts`), and hands back a new one where it did. What
   * this cannot do is be subtly wrong — a rebuilt view (a first load, a `git
   * pull` the patcher declined) has all-new arrays and re-indexes everything,
   * which is slow and right, and there is no third outcome where a file looks
   * unchanged and is not.
   */
  const files = new Map<string, ReadonlyArray<Located>>()
  /** The same for the other arm, keyed by path. A document is decoded once per
   *  change and cached against its stamp by the store's probe, so an unchanged
   *  `.md` is the same object revision after revision — which is the same
   *  guarantee the fold in `filter.ts` already stands on. */
  const documents = new Map<string, Bodied>()

  /** The next rowid. A counter and never a reuse: rowids are int64 and the
   *  cheapest correct thing a writer can do here is to keep counting. */
  let next = 1

  /** How many rows the table holds, kept as the writes go by rather than
   *  counted when asked. {@link CROWD} reads it once per query, and a
   *  `count(*)` per keystroke would be the index charging for the very walk it
   *  exists to avoid. */
  let held = 0

  /** The reading this table was last brought level with. A revision is one
   *  object and every door asks about the same one, so this turns a burst of
   *  keystrokes at one revision into a single walk of the file table. */
  let followed: Reading | null = null

  /** One file's rows, gone — the half of an upsert that has to happen even when
   *  the file is coming straight back, since a contentless fts5 row is deleted
   *  by rowid and nothing here can update one in place. */
  const drop = (file: string): number => {
    let gone = 0
    for (const row of rowsOfFile.all(file)) {
      dropHay.run(row.rowid)
      gone += 1
    }
    dropRec.run(file)
    return gone
  }

  /** ...and the half that puts them there. Mirrors are left out for the reason
   *  the matcher answers with none: a mirror is a second PLACEMENT of a record,
   *  so a candidate for one would be a candidate the matcher drops — a row per
   *  mirror in the directory, bought to be thrown away. */
  const put = (file: string, records: ReadonlyArray<Located>): number => {
    let added = 0
    for (const at of records) {
      if (isMirror(at.node)) continue
      insertRec.run(next, "node", at.node.id, file)
      insertHay.run(next, hayOf(at.node as RegularNode))
      next += 1
      added += 1
    }
    return added
  }

  const putDocument = (document: Bodied): number => {
    insertRec.run(next, "document", document.path, document.path)
    insertHay.run(next, documentHayOf(document))
    next += 1
    return 1
  }

  /**
   * Bring the table level with this reading.
   *
   * The diff is run BOTH WAYS over both arms, which is what keeps a row from
   * outliving the file it came from: what the reading holds and this does not
   * (or holds differently) is re-indexed, and what this holds and the reading
   * no longer does is dropped. Nothing is left to a compaction pass, because
   * the pass would need the same walk this one already does.
   *
   * IN ONE TRANSACTION, and only when there is something to write. An unchanged
   * revision — which is what every keystroke after the first is — costs the two
   * walks and no SQL at all; the walks are over the FILE table and the document
   * list, hundreds of entries where the corpus is tens of thousands of records,
   * and they are what the identity test buys.
   */
  const follow = (at: Reading): void => {
    if (followed === at) return
    const bodied = bodiedIn(at.set)

    const putting: Array<readonly [string, ReadonlyArray<Located>]> = []
    for (const [file, records] of at.derived.byFile) {
      if (files.get(file) !== records) putting.push([file, records])
    }
    const dropping: Array<string> = []
    for (const file of files.keys()) {
      if (!at.derived.byFile.has(file)) dropping.push(file)
    }

    const puttingDocuments: Array<Bodied> = []
    const present = new Set<string>()
    for (const document of bodied) {
      present.add(document.path)
      if (documents.get(document.path) !== document) puttingDocuments.push(document)
    }
    const droppingDocuments: Array<string> = []
    for (const path of documents.keys()) {
      if (!present.has(path)) droppingDocuments.push(path)
    }

    if (
      putting.length + dropping.length + puttingDocuments.length +
          droppingDocuments.length === 0
    ) {
      followed = at
      return
    }

    // THE SQL FIRST AND THE BOOKKEEPING AFTER, which is not a style choice: a
    // transaction that throws rolls the ROWS back and would not roll back a
    // `files.set` made inside it, leaving this side certain a file is indexed
    // whose rows are gone — the one failure that costs a hit rather than a
    // millisecond. Written this way, a throw leaves both sides exactly as they
    // were and the next call does the same work again.
    let moved = 0
    db.transaction(() => {
      for (const file of dropping) moved -= drop(file)
      for (const [file, records] of putting) {
        moved -= drop(file)
        moved += put(file, records)
      }
      for (const path of droppingDocuments) moved -= drop(path)
      for (const document of puttingDocuments) {
        moved -= drop(document.path)
        moved += putDocument(document)
      }
    })()
    held += moved
    for (const file of dropping) files.delete(file)
    for (const [file, records] of putting) files.set(file, records)
    for (const path of droppingDocuments) documents.delete(path)
    for (const document of puttingDocuments) documents.set(document.path, document)
    followed = at
  }

  return {
    narrow: (at, filter) => {
      const groups = narrowableBy(filter, lookupable)
      // Nothing to look up: a query of operators alone, a one-letter box, a
      // negation. The corpus walk is the answer and this table is not asked —
      // which is also why the catch-up below is on THIS side of the return: an
      // index nobody can use is an index nobody should be maintaining either,
      // and the work it skips is not lost, only deferred to the first query
      // that can spend it.
      if (groups === null) return null
      follow(at)
      const crowd = Math.max(CROWD_FLOOR, Math.floor(held / CROWD))
      const found = looked.all(expressionOf(groups), crowd + 1)
      // A CROWD, which is the one answer this table declines to give: the query
      // selects so much of the directory that finding out which part costs more
      // than reading all of it ({@link CROWD}). One row over the share is how
      // that is known, and the limit is why knowing it was cheap.
      //
      // THE LIMIT AND THIS LINE ARE ONE MECHANISM and neither survives without
      // the other: a `limit` with no decline behind it hands back a TRUNCATED
      // list, which is the one thing candidates may never be — over-inclusion
      // is free and under-inclusion is a hit nobody finds. Taking this line out
      // does not make the index slower, it makes it wrong, and the soak says so
      // at the superset assertion rather than at a missing row.
      if (found.length > crowd) return null
      const nodes = new Set<string>()
      const paths = new Set<string>()
      for (const row of found) (row.kind === "node" ? nodes : paths).add(row.key)
      return { nodes, documents: paths }
    },
    rows: () => held,
    bytes: () => (pages.get()?.page_count ?? 0) * (pageSize.get()?.page_size ?? 0),
    close: () => db.close(),
  }
}

/**
 * The query, in FTS5's own language: every group must hold, and a group holds
 * when any word in it does.
 *
 * ONE EXPRESSION rather than a lookup per word intersected in JavaScript, and
 * the reason is that the intersection is the expensive half: SQLite walks the
 * shortest posting list it can and stops, where this side would materialise
 * every word's whole list first and then throw most of both away.
 *
 * A WORD IS A PHRASE — double-quoted — and that is what makes this a substring
 * search rather than a word search. Under the trigram tokenizer a quoted string
 * is matched as an adjacent run of trigrams, which is exactly "these characters
 * in this order, anywhere", spaces included; the same query unquoted would ask
 * FTS5's own boolean parser to read the reader's text as operators. The one
 * character that has to be escaped inside those quotes is the quote, doubled,
 * which is SQL's own rule and not a scheme invented here.
 */
const expressionOf = (groups: ReadonlyArray<ReadonlyArray<string>>): string =>
  groups
    .map((words) =>
      words.length === 1
        ? phrase(words[0] as string)
        : `(${words.map(phrase).join(" OR ")})`
    )
    .join(" AND ")

const phrase = (word: string): string => `"${word.replaceAll(`"`, `""`)}"`
