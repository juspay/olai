/**
 * WHAT A LEDGER FILE SAYS — an hledger journal read as the transactions it
 * holds, the balances those postings come to, and the lines that are neither
 * kept as the raw text they are.
 *
 * A `.journal` (or `.hledger`, or `.ledger`) is one of the kinds olai claims,
 * and the whole of what this app does with one is SHOW it: a list of
 * transactions, the account tree their postings add up to, and the file itself.
 * So the reading is one function over a string and it produces a value, not a
 * component — the page that draws it is the client's.
 *
 * THE READING IS A PIPELINE, and each stage is a module that answers one
 * question in one shape: lines are CLASSIFIED by their own shape
 * ({@link ./line.ts}), the fold remembers the three things that need memory
 * ({@link ./group.ts}), a header and a posting are read context-free
 * ({@link ./header.ts}, {@link ./posting.ts}), an omission is inferred
 * ({@link ./infer.ts}), the movements are summed ({@link ./balances.ts}), and
 * the bounds bound the split and cut each field where it is built
 * ({@link ./bounds.ts}). This file is only the composition: it is the one place
 * that knows the order.
 *
 * ## It is a READER and not an implementation of hledger
 *
 * hledger's journal format is large, and this reads the part a person opening
 * their file in their notes wants: transactions with their dates, marks, codes
 * and descriptions; postings with their accounts and amounts; directives and
 * comments kept as the text they are. What it deliberately does NOT do is
 * INTERPRET the parts that only a bookkeeping engine needs:
 *
 *   - COSTS (`@` and `@@`) are read as the annotation they are — the posting's
 *     own amount is what the account moved — and a transaction with one is
 *     never INFERRED from, because hledger balances such a transaction in the
 *     cost commodity and this reader does not convert.
 *   - AUTO POSTINGS (`=` rules) and PERIODIC TRANSACTIONS (`~`) are kept as the
 *     directives they are and never applied. A rule that fired today would make
 *     this reading depend on the clock, and a balance that changes while
 *     nobody edits the file is not a fact about the file.
 *   - `include` is not followed. A file's balances are the postings IN that
 *     file; following a path would make the answer depend on the rest of the
 *     disk, and the page is for the file somebody opened.
 *   - `alias`, `D`/`P`, `commodity` and `account` are not applied: they are
 *     kept, in order, as raw entries ({@link Entry}), and an indented line that
 *     continues one stays in it. A reader who wants them wants the words.
 *
 * ## Nothing is mis-read silently
 *
 * A posting that STATES something this reader cannot read is not a posting with
 * an amount it guesses at — it is a line the page keeps as raw text
 * ({@link Entry}), because "10 20" is not an amount and "1E3" is not a
 * commodity ({@link ./amount.ts} argues the three refusals). A line the reader
 * cannot make sense of is kept as the text it is, at its own line number, and
 * the rest of the file still reads.
 *
 * ## Balances are exact, and rolled up
 *
 * Money is never a float: a quantity is a `bigint` scaled by the number of
 * decimal places it was written with ({@link ./decimal.ts}). Postings are
 * summed per account per commodity and rolled up to every parent
 * ({@link ./balances.ts}).
 *
 * ## THE BOUND IS ON THE READING, not a slice taken afterwards
 *
 * The LINE bound bounds the SPLIT and the walk: `split` stops at the bound and
 * the lines past it are never classified, so a file of a hundred megabytes
 * costs a page of strings rather than a string per line. The TRANSACTION bound
 * keeps the first {@link HLEDGER_TRANSACTIONS} and remembers that there was
 * another header — and the postings of a dropped transaction are still read,
 * because a line that is not a posting is kept as raw text whatever the bound
 * says ({@link ./group.ts} is bound-free: the bound is a reading policy, and a
 * fold that knew it would be a second place deciding what "kept" means). What a
 * stopped read can say is that there WAS more, never how much: a total is a
 * number only a full read knows.
 *
 * ## It never throws
 *
 * A file being written while it is read, a hand-edit halfway through a posting,
 * a line from some other tool: none of those is an error a person can act on
 * from a notes app.
 */
import { type Amount } from "./amount.ts"
import { compareAccounts, type Movement, rollup } from "./balances.ts"
import { boundedBy, type Bounds, clip } from "./bounds.ts"
import { type EntryKind, group } from "./group.ts"
import { type Header } from "./header.ts"
import { infer } from "./infer.ts"
import { classify, type Line } from "./line.ts"
import { type Posting } from "./posting.ts"
import { type Tag, tagsIn } from "./tags.ts"

/**
 * One transaction: the header the fold finished (its comment and tags already
 * joined by whatever indented under it), and its postings.
 *
 * A HEADER AND ITS POSTINGS, rather than a record that re-declares every field
 * a header has: the two were the same eight fields twice, and a field added to
 * one would have had to be added to the other by whoever remembered. `date` is
 * the header's own spelling normalized to `YYYY-MM-DD` — a header whose spelling
 * named no real day, or whose secondary date did not, is not a transaction at
 * all and is kept as a raw entry.
 */
export type Transaction = Header & {
  /** The header comment's own words, with its tags taken out. */
  readonly prose: string
  readonly postings: ReadonlyArray<Posting>
}

/**
 * A line that is not a transaction header or a posting — a directive, a
 * comment, or a line this reader could not make sense of — kept whole (up to
 * {@link HLEDGER_CELL}) at its own source line, in file order. The KIND is the
 * one thing typed about it ({@link EntryKind}).
 */
export interface Entry {
  readonly line: number
  /** How many source lines it covers ({@link ./group.ts}), which is what the
   *  Raw view marks — not the line count of `text`, which the cell cut can
   *  shorten. */
  readonly span: number
  readonly text: string
  readonly kind: EntryKind
}

/**
 * What the postings add up to. `accounts` is every account named plus every
 * parent prefix, sorted by `:` segment — the rows an account tree draws. `of`
 * is each of those accounts' totals, per commodity, already rolled up, holding
 * only the accounts whose total is not zero (a parent that nets to nothing has
 * no amount to draw). A `null` style on one of those amounts is this reader's
 * own: the total was computed here, and it is the display that spells it.
 */
export interface Balances {
  readonly accounts: ReadonlyArray<string>
  readonly of: ReadonlyMap<string, ReadonlyArray<Amount>>
}

/** A journal read, as far as the bounds allowed. */
export interface Journal {
  readonly transactions: ReadonlyArray<Transaction>
  readonly entries: ReadonlyArray<Entry>
  readonly balances: Balances
  /** A transaction header was seen past {@link HLEDGER_TRANSACTIONS}. */
  readonly moreTransactions: boolean
  /** The line bound cut the reading — there was more file than was read. */
  readonly truncated: boolean
  /** A field was longer than {@link HLEDGER_CELL} and was cut. */
  readonly longCells: boolean
  /** How many lines were read. */
  readonly lines: number
}

/** A journal, read — bounded, exact and total. */
export const readJournal = (text: string, bounds?: Partial<Bounds>): Journal => {
  const limits = boundedBy(bounds)
  // THE SPLIT IS BOUNDED TOO, so a file of a hundred megabytes costs a page of
  // strings rather than a string per line.
  const rawLines = text.split("\n", limits.lines + 1)
  // A trailing newline is the end of the last line, not a line of its own.
  const logical = text === "" ? 0 : text.endsWith("\n") ? rawLines.length - 1 : rawLines.length
  const read = Math.min(logical, limits.lines)
  // WAS THERE MORE IS A QUESTION ABOUT THE CHARACTERS, not about the entries the
  // limited split returned: a BLANK line just past the bound and the empty string
  // after a final newline are the same entry, and one means the file ran on while
  // the other means it ended. So the walk asks where the last line read ended.
  let consumed = 0
  for (let at = 0; at < read; at++) {
    const next = text.indexOf("\n", consumed)
    if (next < 0) {
      consumed = text.length
      break
    }
    consumed = next + 1
  }
  const truncated = consumed < text.length

  const lines: Array<Line> = []
  for (let at = 0; at < read; at++) {
    const raw = rawLines[at] as string
    lines.push(classify(raw.endsWith("\r") ? raw.slice(0, -1) : raw))
  }

  // THE CUT IS APPLIED WHERE A RECORD IS BUILT. The account a movement is summed
  // under is the SAME cut string the page draws, so the Balances tree and the
  // Transactions rows cannot disagree about how long an account is — and there
  // is no walk over a finished journal that would have had to remember every map
  // key as well as every field.
  const witness = { cut: false }
  const cut = (field: string): string => clip(field, limits.cell, witness)
  const cutTags = (ones: ReadonlyArray<Tag>): ReadonlyArray<Tag> =>
    ones.map((one) => ({ key: cut(one.key), value: one.value === null ? null : cut(one.value) }))
  /** An account as the tree will hold it: cut at the bound, and with a cut's
   *  trailing `:` taken off — `a:b:` is a segment with no name, and a node the
   *  Balances tree would draw as an empty row. Two accounts whose cut ends up
   *  the same merge into one row, which is the honest cost of the bound. */
  const cutAccount = (account: string): string => {
    const held = cut(account)
    const trimmed = held.replace(/:+$/, "")
    return trimmed === "" ? held : trimmed
  }
  const cutPosting = (one: Posting): Posting => ({
    ...one,
    account: cutAccount(one.account),
    cost: one.cost === null ? null : cut(one.cost),
    assertion: one.assertion === null ? null : cut(one.assertion),
    comment: one.comment === null ? null : cut(one.comment),
    // The prose is the comment's own words, and it is derived HERE rather than
    // carried through the fold: the fold joins comments (an indented one under
    // a posting is that posting's), and one place asking what is a tag is one
    // place a page and its tags can disagree from.
    prose: one.comment === null ? "" : cut(tagsIn(one.comment).prose),
    tags: cutTags(one.tags),
  })

  const transactions: Array<Transaction> = []
  const entries: Array<Entry> = []
  const movements: Array<Movement> = []
  let moreTransactions = false

  for (const block of group(lines)) {
    if (block.kind === "entry") {
      entries.push({ line: block.line, span: block.span, text: cut(block.text), kind: block.entry })
      continue
    }
    // A refused posting is a line the transaction does not hold, so it is kept
    // as raw text — even when the transaction itself is past the bound and is
    // dropped, because the line is still part of what was read.
    for (const bad of block.refused) entries.push({ line: bad.line, span: 1, text: cut(bad.text), kind: "unknown" })
    if (transactions.length >= limits.transactions) {
      moreTransactions = true
      continue
    }
    const header = block.header
    const postings = infer(block.postings, block.refused.length > 0).map(cutPosting)
    transactions.push({
      ...header,
      code: header.code === null ? null : cut(header.code),
      description: cut(header.description),
      payee: cut(header.payee),
      note: header.note === null ? null : cut(header.note),
      comment: header.comment === null ? null : cut(header.comment),
      prose: header.comment === null ? "" : cut(tagsIn(header.comment).prose),
      tags: cutTags(header.tags),
      postings,
    })
    for (const posting of postings) {
      const amount = posting.amount
      if (amount === null) continue
      movements.push({ account: posting.account, commodity: amount.commodity, value: amount.value })
    }
  }

  const rolled = rollup(movements)
  const of = new Map<string, ReadonlyArray<Amount>>()
  for (const [account, held] of rolled) {
    const amounts = [...held]
      .filter(([, value]) => value.value !== 0n)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([commodity, value]) => ({ commodity, value, style: null, written: null }))
    if (amounts.length > 0) of.set(account, amounts)
  }

  return {
    transactions,
    entries,
    balances: { accounts: [...rolled.keys()].sort(compareAccounts), of },
    moreTransactions,
    truncated,
    longCells: witness.cut,
    lines: read,
  }
}
