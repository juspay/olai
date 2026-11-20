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

/** The shortest needle a trigram table can look up, in CHARACTERS: a shorter
 *  one makes no trigram and FTS5 answers it with nothing rather than an error. */
const FLOOR = 3

/**
 * Whether SQLite's FTS5 can be asked about this word at all — three facts about
 * the engine, not about olai's grammar:
 *
 *   - under three CODE POINTS there is no trigram, and FTS5 answers with
 *     nothing rather than with an error;
 *   - FTS5's query parser reads the expression as a C string, so a `\0` inside
 *     a phrase ends it early and raises `unterminated string`. Stored text is
 *     handed a length and is unaffected;
 *   - half a surrogate pair does not survive the trip to UTF-8, and needle and
 *     text are not mangled into the same thing, so such a needle finds no rows.
 *
 * A refused word drops its group; a query with nothing left walks the corpus.
 */
export const lookupable = (word: string): boolean =>
  longEnough(word) && !word.includes("\0") && word.isWellFormed()

const longEnough = (word: string): boolean => {
  if (word.length >= FLOOR * 2) return true
  let seen = 0
  for (const _ of word) {
    seen += 1
    if (seen >= FLOOR) return true
  }
  return false
}

export const CROWD = 4
export const CROWD_FLOOR = 1024

type Kind = "node" | "document"

export interface Candidates {
  readonly nodes: ReadonlySet<string>
  readonly documents: ReadonlySet<string>
}

export interface Index {
  /** `null` and an empty {@link Candidates} are opposite answers and must not be
   *  confused: `null` is "nothing to say about that query", an empty pair is
   *  "looked, and nothing can match". */
  readonly narrow: (at: Reading, filter: Filter) => Candidates | null
  readonly rows: () => number
  readonly bytes: () => number
  readonly close: () => void
}

/**
 * Open one. It throws rather than degrades: this needs FTS5 with the `trigram`
 * tokenizer and `contentless_delete` (SQLite 3.43+; Bun 1.4 ships 3.53), and a
 * build without them would otherwise serve a silently slower vault.
 */
export const open = (): Index => {
  const db = new Database(":memory:")
  db.run(
    `create table rec(
       rowid integer primary key,
       kind text not null,
       key text not null,
       file text not null
     )`,
  )
  db.run(`create index rec_file on rec(file)`)
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
  const pages = db.prepare<{ page_count: number }, []>(`pragma page_count`)
  const pageSize = db.prepare<{ page_size: number }, []>(`pragma page_size`)
  const looked = db.prepare<{ kind: Kind; key: string }, [string, number]>(
    `select rec.kind as kind, rec.key as key
       from hay join rec on rec.rowid = hay.rowid
      where hay.text match ?
      limit ?`,
  )

  const files = new Map<string, ReadonlyArray<Located>>()
  const documents = new Map<string, Bodied>()

  let next = 1

  let held = 0

  let followed: Reading | null = null

  const drop = (file: string): number => {
    let gone = 0
    for (const row of rowsOfFile.all(file)) {
      dropHay.run(row.rowid)
      gone += 1
    }
    dropRec.run(file)
    return gone
  }

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
 * The query, in FTS5's own language. Each word is double-quoted as a PHRASE:
 * under the trigram tokenizer that matches an adjacent run of trigrams — these
 * characters in this order, anywhere, spaces included — where the same text
 * unquoted would be read by FTS5's boolean parser as operators. The only
 * character to escape inside those quotes is the quote, doubled.
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
