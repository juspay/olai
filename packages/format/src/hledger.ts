/**
 * WHAT A LEDGER FILE SAYS — an hledger journal read as the transactions it
 * holds, the balances those postings come to, and the lines that are neither
 * kept as the raw text they are.
 *
 * A `.journal` (or `.hledger`, or `.ledger`) is one of the kinds olai claims,
 * and the whole of what this app does with one is SHOW it: a list of
 * transactions, the account tree their postings add up to, and the file itself.
 * So the reading is one function over a string and it produces a value, not a
 * component — the page that draws it is the client's, and this is the format's
 * for the reason every other reading in this package is here: what a served
 * file MEANS is one answer, and a second parser in the browser would be a
 * second answer nothing holds to the first.
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
 *     kept, in order, as raw entries (`{@link HledgerEntry}`), and an indented
 *     line that continues one stays in it. A reader who wants them wants the
 *     words.
 *
 * ## Nothing is mis-read silently
 *
 * A posting that STATES something this reader cannot read is not a posting with
 * an amount it guesses at — it is a line the page keeps as raw text
 * (`{@link HledgerEntry}`), because "10 20" is not an amount and "1E3" is not a
 * commodity. Three shapes are refused rather than guessed: an unquoted
 * commodity that holds a digit (`1E3 X`, and `AAPL2` — write the commodity
 * quoted, `"AAPL2"`, if that is what it is), a second number left over after
 * the first, and a number whose separators are not digit groups (`1.2.3`).
 * What IS supported is the grouping a person writes: `1,000,000.50`, `1.000,50`,
 * and a space between groups (`$1 000.00`), exactly as `./hledger.ts`'s
 * `parseDecimal` argues.
 *
 * ## Balances are exact, and rolled up
 *
 * Money is never a float. A quantity is a `bigint` scaled by the number of
 * decimal places it was written with, so `-1,000.50` is exactly `-100050/100`
 * and a sum of ten thousand of them is exact. Postings are summed per account
 * per commodity, and every account's total includes its children's: a posting
 * to `assets:bank:checking` is also a posting to `assets:bank` and `assets`,
 * which is what a person reading an account tree expects to see. Accounts sort
 * by `:` SEGMENT, so `expenses:food` is a child of `expenses` and not a
 * neighbour of `expenses-old`.
 *
 * ONE AMOUNT MAY BE OMITTED, and hledger's rule is that it is inferred to make
 * its group balance. This reads it the same way WHEN it can: the transaction's
 * ordinary postings are one group and its BALANCED virtuals (`[… ]`) are
 * another — a `(…)` unbalanced virtual never balances anything and is never
 * inferred into — and within a group, exactly one omission with every stated
 * amount in one commodity. Anything else is left unknown and the posting says
 * so (`{@link HledgerPosting.inferred}` is false and the amount is `null`).
 *
 * ## THE BOUND IS ON THE READING, not a slice taken afterwards
 *
 * The same correction `./csv.ts` argues, over the three axes a journal can be
 * enormous along: lines read ({@link HLEDGER_LINES}), transactions kept
 * ({@link HLEDGER_TRANSACTIONS}), and the length of any one field
 * ({@link HLEDGER_CELL}) — a description, a comment, an account, a tag or a raw
 * line. The scan STOPS paying for what it will not draw: past the transaction
 * bound, a transaction's postings are consumed and discarded and only the fact
 * that there was another header is remembered. What a stopped scan can say is
 * that there WAS more (`{@link HledgerJournal.moreTransactions}`,
 * `{@link HledgerJournal.truncated}`, `{@link HledgerJournal.longCells}`),
 * never how much — a total is a number only a full read knows.
 *
 * ## It never throws
 *
 * A file being written while it is read, a hand-edit halfway through a posting,
 * a line from some other tool: none of those is an error a person can act on
 * from a notes app. A line this reader cannot make sense of is kept as the text
 * it is, at its own line number, and the rest of the file still reads.
 */

/** How many lines of a journal are read at all — past this the file is a file,
 *  not a page. Ten thousand transactions fit in twenty thousand lines with
 *  their postings; a journal past it is a data dump somebody is not reading in
 *  a sidebar. */
export const HLEDGER_LINES = 20_000

/** How many transactions a page draws before it starts saying what it left
 *  out — and, since the bound is on the reading, how many it keeps. */
export const HLEDGER_TRANSACTIONS = 1_000

/** How long any one field may be before it is cut: a description, a comment, an
 *  account, a tag, or a raw line. The axis the other two cannot cover, since a
 *  file that is one enormous line is one line and one transaction. */
export const HLEDGER_CELL = 2_000

/** How a transaction is marked: `*` cleared, `!` pending, or neither. */
export type HledgerStatus = "cleared" | "pending" | "unmarked"

/**
 * One amount, as it was written: the commodity, the exact quantity as a decimal
 * string, which side of the number the commodity sat on, and where a minus sat
 * (`-$10` and `$-10` are the same money written two ways, and the page hands
 * back the one the file used).
 */
export interface HledgerAmount {
  readonly commodity: string
  readonly quantity: string
  readonly sign: "leading" | "number"
  readonly side: "prefix" | "suffix"
  readonly spaced: boolean
}

/** One `key:value` from a comment. A `key:` with nothing after it keeps a null
 *  value rather than an empty string, because the empty string is a value
 *  somebody could have written. */
export interface HledgerTag {
  readonly key: string
  readonly value: string | null
}

/** One posting under a transaction. `virtual` is the account's bracket pair:
 *  `(acct)` unbalanced, `[acct]` balanced, none for an ordinary posting. An
 *  amount is `null` when the line stated none and it could not be inferred. */
export interface HledgerPosting {
  readonly account: string
  readonly virtual: "no" | "unbalanced" | "balanced"
  readonly amount: HledgerAmount | null
  readonly inferred: boolean
  readonly comment: string | null
  readonly tags: ReadonlyArray<HledgerTag>
}

/** One transaction: the header's facts, its comment and tags, and its
 *  postings. `date` is the header's own spelling normalized to `YYYY-MM-DD` —
 *  a header whose spelling named no real day, or whose secondary date did not,
 *  is not a transaction at all and is kept as a raw entry. */
export interface HledgerTransaction {
  readonly date: string
  readonly secondaryDate: string | null
  readonly status: HledgerStatus
  readonly code: string | null
  readonly description: string
  /** The description up to `|`, or the whole description when the file wrote
   *  none — the part hledger calls the payee. */
  readonly payee: string
  readonly note: string | null
  readonly comment: string | null
  readonly tags: ReadonlyArray<HledgerTag>
  readonly postings: ReadonlyArray<HledgerPosting>
}

/**
 * A line that is not a transaction header or a posting — a directive, a
 * comment, or a line this reader could not make sense of — kept whole (up to
 * {@link HLEDGER_CELL}) at its own source line, in file order. The KIND is the
 * one thing typed about it: it is what the Raw view marks each line as, and
 * nothing else is interpreted.
 */
export interface HledgerEntry {
  readonly line: number
  readonly text: string
  readonly kind: "directive" | "comment" | "unknown"
}

/**
 * What the postings add up to. `accounts` is every account named plus every
 * parent prefix, sorted by `:` segment — the rows an account tree draws. `of`
 * is each of those accounts' totals, per commodity, already rolled up, holding
 * only the accounts whose total is not zero (a parent that nets to nothing has
 * no amount to draw). `total` is the whole file's sum, per commodity.
 */
export interface HledgerBalances {
  readonly accounts: ReadonlyArray<string>
  readonly total: ReadonlyArray<HledgerAmount>
  readonly of: ReadonlyMap<string, ReadonlyArray<HledgerAmount>>
}

/** A journal read, as far as the bounds allowed. */
export interface HledgerJournal {
  readonly transactions: ReadonlyArray<HledgerTransaction>
  readonly entries: ReadonlyArray<HledgerEntry>
  readonly balances: HledgerBalances
  /** A transaction header was seen past {@link HLEDGER_TRANSACTIONS}. */
  readonly moreTransactions: boolean
  /** The line bound cut the reading — there was more file than was read. */
  readonly truncated: boolean
  /** A field was longer than {@link HLEDGER_CELL} and was cut. */
  readonly longCells: boolean
  /** How many lines were read. */
  readonly lines: number
}

/** The numbers a read is bounded by, all present once the door has applied its
 *  defaults. */
export interface HledgerBounds {
  readonly lines: number
  readonly transactions: number
  readonly cell: number
}

const boundedBy = (asked?: Partial<HledgerBounds>): HledgerBounds => ({
  lines: asked?.lines ?? HLEDGER_LINES,
  transactions: asked?.transactions ?? HLEDGER_TRANSACTIONS,
  cell: asked?.cell ?? HLEDGER_CELL,
})

/** One exact decimal: `value` scaled by `10^-scale`. */
interface Decimal {
  readonly value: bigint
  readonly scale: number
}

/** A field's text, cut at the bound — remembering that it WAS cut, because a
 *  page that says nothing about a shortened description is a page lying about
 *  the file. */
const clip = (text: string, at: number, cut: { long: boolean }): string => {
  if (text.length <= at) return text
  cut.long = true
  return text.slice(0, at)
}

/** The exact digits of a decimal, as the text they were written as. */
const quantityOf = (one: Decimal): string => {
  const negative = one.value < 0n
  let digits = (negative ? -one.value : one.value).toString()
  if (one.scale > 0) {
    if (digits.length <= one.scale) digits = "0".repeat(one.scale - digits.length + 1) + digits
    digits = `${digits.slice(0, digits.length - one.scale)}.${digits.slice(digits.length - one.scale)}`
  }
  return `${negative ? "-" : ""}${digits}`
}

const add = (left: Decimal, right: Decimal): Decimal => {
  const scale = Math.max(left.scale, right.scale)
  return {
    value: left.value * 10n ** BigInt(scale - left.scale) + right.value * 10n ** BigInt(scale - right.scale),
    scale,
  }
}

const negated = (one: Decimal): Decimal => ({ value: -one.value, scale: one.scale })

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9"

/** A number's digit groups: digits, and separators that are exactly one
 *  thousand. `1,000,000`, `1.000.000` and `1000` are all numbers; `1.2.3` and
 *  `1,00,000` are not. */
const GROUPED = /^(?:[0-9]+|[0-9]{1,3}(?:[.,][0-9]{3})+)$/

/**
 * The digits at the head of some text, and what is left after them.
 *
 * A SPACE IS GROUPING ONLY WHEN IT SEPARATES A GROUP OF THREE — `1 000.00` is
 * a number and `10 20` is not, which is the difference between reading
 * somebody's amount and inventing one (`./hledger.ts`'s header argues why a
 * misread is the failure this reader refuses).
 */
const scanNumber = (text: string): { readonly written: string; readonly rest: string } | null => {
  let at = 0
  if (text.startsWith("-") || text.startsWith("+")) at++
  const head = at
  while (isDigit(text[at])) at++
  if (at === head) return null
  let written = text.slice(0, at)
  while (at < text.length) {
    const char = text[at] as string
    if (char === "." || char === ",") {
      written += char
      at++
      while (isDigit(text[at])) {
        written += text[at]
        at++
      }
      continue
    }
    if (char === " ") {
      const group = /^ {1}([0-9]{3})(?![0-9])/.exec(text.slice(at))
      if (group === null) break
      written += group[1] as string
      at += (group[0] as string).length
      continue
    }
    break
  }
  return { written, rest: text.slice(at) }
}

/**
 * The exact digits of a written number, or `null` when they are not a number.
 *
 * THE DECIMAL MARK is decided by what is around it rather than by a `D`
 * directive, and the two rules are the two conventions every tool writes:
 *
 *   - when both `.` and `,` appear, whichever comes LAST is the mark and the
 *     other is grouping (`-1,000.50` and `1.000,50` both read as they look);
 *   - with only one kind present, a lone `,` followed by one or two digits is a
 *     mark (`1,50` is one and a half), while anything else is grouping
 *     (`1,000` is a thousand, `1,000,000` is a million) — and a `.` is always a
 *     mark, because that is hledger's default and the one every English-writing
 *     tool emits.
 *
 * EVERYTHING ELSE IS REFUSED rather than trimmed: the integer part must be a
 * genuine grouping ({@link GROUPED}) and the fraction must be digits, so
 * `1.2.3` is not quietly read as `12.3`.
 */
const parseDecimal = (raw: string): Decimal | null => {
  let text = raw.replace(/ /g, "")
  let negative = false
  if (text.startsWith("-")) {
    negative = true
    text = text.slice(1)
  } else if (text.startsWith("+")) text = text.slice(1)
  if (text === "") return null

  const dots: Array<number> = []
  const commas: Array<number> = []
  for (let at = 0; at < text.length; at++) {
    const char = text.charAt(at)
    if (char === ".") dots.push(at)
    else if (char === ",") commas.push(at)
    else if (!isDigit(char)) return null
  }
  let mark = -1
  if (dots.length > 0 && commas.length > 0) mark = Math.max(dots[dots.length - 1] as number, commas[commas.length - 1] as number)
  else if (dots.length > 0) mark = dots[dots.length - 1] as number
  else if (commas.length === 1) {
    const only = commas[0] as number
    if (text.length - only - 1 <= 2) mark = only
  }

  const whole = mark >= 0 ? text.slice(0, mark) : text
  const fraction = mark >= 0 ? text.slice(mark + 1) : ""
  if (!GROUPED.test(whole)) return null
  if (!/^[0-9]*$/.test(fraction)) return null
  const value = BigInt(whole.replace(/[.,]/g, "") + fraction)
  return { value: negative ? -value : value, scale: fraction.length }
}

/** An unquoted commodity: no whitespace, no digit and none of the characters
 *  that mean something else on the line. A commodity that holds one of those is
 *  written quoted (`"quoted commodity"`, `"AAPL2"`), which is how hledger lets
 *  it be said at all. */
const BARE_COMMODITY = /^[^0-9\s+\-".@=;,#*!()[\]]+$/

/** The commodity a token names, or `null` when the token is not one — quoted,
 *  or bare. */
const commodityOf = (token: string): string | null => {
  if (token.startsWith('"')) {
    return token.length > 2 && token.endsWith('"') ? token.slice(1, -1) : null
  }
  return BARE_COMMODITY.test(token) ? token : null
}

/**
 * One posting's amount region — everything after the account, minus the
 * comment, the cost annotation and the balance assertion — as the amount it
 * states and the exact number under it.
 *
 * `null` is a region that is NOT an amount. The caller tells that from an
 * omission by the region being empty, and files the line as raw text, which is
 * the whole of "nothing is mis-read silently".
 */
const parseAmount = (raw: string): { readonly amount: HledgerAmount; readonly value: Decimal } | null => {
  let text = raw.trim()
  if (text === "") return null
  let leading = false
  let negative = false
  if (text.startsWith("-") || text.startsWith("+")) {
    leading = true
    negative = text.startsWith("-")
    text = text.slice(1).trimStart()
  }

  let commodity = ""
  let side: "prefix" | "suffix" = "prefix"
  let spaced = false
  let written = ""

  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1)
    if (end < 0) return null
    commodity = text.slice(1, end)
    const rest = text.slice(end + 1)
    spaced = /^\s/.test(rest)
    const number = scanNumber(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  } else if (isDigit(text[0])) {
    const number = scanNumber(text)
    if (number === null) return null
    written = number.written
    spaced = /^\s/.test(number.rest)
    const token = number.rest.trim()
    if (token !== "") {
      const named = commodityOf(token)
      if (named === null) return null
      commodity = named
    }
    side = "suffix"
  } else {
    // A commodity on the left: `$10`, `€ 10`, `US$10`, `USD 10` — and NOT the
    // sign, which the branch above already took off (`$-10` is minus ten).
    const found = /^[^0-9\s+\-".@=;,#*!()[\]]+/.exec(text)
    if (found === null) return null
    commodity = found[0]
    const rest = text.slice(commodity.length)
    spaced = /^\s/.test(rest)
    const number = scanNumber(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  }

  // A sign may also sit against the digits: `$-10`, `10-` is not a thing, and
  // `-10 EUR` had it before the digits already.
  if (written.startsWith("-") || written.startsWith("+")) {
    if (written.startsWith("-")) negative = !negative
    written = written.slice(1)
  }
  const value = parseDecimal(written)
  if (value === null) return null
  const exact = negative ? negated(value) : value
  return {
    amount: {
      commodity,
      quantity: quantityOf(exact),
      // The sign is LEADING only where it was written before a prefix
      // commodity (`-$10`); everywhere else the number carries it.
      sign: leading && negative && side === "prefix" ? "leading" : "number",
      side,
      spaced,
    },
    value: exact,
  }
}

/** How many days a month really has — so `2024-02-31` is not a day. */
const daysIn = (year: number, month: number): number => {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [31, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] as number
}

/** `YYYY-MM-DD` for a written day, or `null` when it names no real one. The
 *  three separators hledger accepts are all one reading here. */
const isoOf = (written: string): string | null => {
  const parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(written)
  if (parts === null) return null
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null
  return `${parts[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** The shape of a date at the head of a line, before it is judged a real one. */
const DATE_SHAPE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/

/** Whether a token stands alone at the head of a line — the date of a header
 *  ends where the rest of the header begins, and `2024-01-01x` is not a date
 *  with a description. */
const endsAt = (text: string, at: number): boolean => at >= text.length || /\s/.test(text.charAt(at))

/**
 * The `key:value` pairs one comment carries, in the order written.
 *
 * hledger's rule, which is not the one a guess would pick: a KEY is one token
 * and a VALUE runs to the next comma or the end of the comment, so
 * `; trip:berlin paid:card` is ONE tag whose value is `berlin paid:card` — the
 * comma is what separates two (`; trip:berlin, paid:card`).
 */
const tagsIn = (comment: string): ReadonlyArray<HledgerTag> => {
  const tags: Array<HledgerTag> = []
  const pattern = /([^\s:;,]+):\s*([^,]*)/g
  for (let found = pattern.exec(comment); found !== null; found = pattern.exec(comment)) {
    const value = (found[2] as string).trim()
    tags.push({ key: found[1] as string, value: value === "" ? null : value })
  }
  return tags
}

/** One transaction's header, or `null` when the line is not one — which
 *  includes a date-shaped line whose date names no real day, because a header
 *  this reader cannot date is a line it cannot make sense of. */
const headerOf = (line: string, bounds: HledgerBounds, cut: { long: boolean }): HledgerTransaction | null => {
  const dateWritten = DATE_SHAPE.exec(line)?.[0]
  if (dateWritten === undefined) return null
  const date = isoOf(dateWritten)
  if (date === null) return null
  let rest = line.slice(dateWritten.length)

  let secondaryDate: string | null = null
  if (rest.startsWith("=")) {
    // `=` here is a secondary date and nothing else; a spelling that names no
    // real day makes the whole line unreadable rather than a transaction whose
    // second date quietly went missing.
    const after = rest.slice(1)
    const second = DATE_SHAPE.exec(after)?.[0]
    if (second === undefined || !endsAt(after, second.length)) return null
    const iso = isoOf(second)
    if (iso === null) return null
    secondaryDate = iso
    rest = after.slice(second.length)
  }
  if (!endsAt(rest, 0) && !rest.startsWith("=")) return null

  rest = rest.trimStart()
  let status: HledgerStatus = "unmarked"
  if (rest.startsWith("*")) {
    status = "cleared"
    rest = rest.slice(1).trimStart()
  } else if (rest.startsWith("!")) {
    status = "pending"
    rest = rest.slice(1).trimStart()
  }

  let code: string | null = null
  if (rest.startsWith("(")) {
    const close = rest.indexOf(")")
    if (close > 0) {
      code = clip(rest.slice(1, close).trim(), bounds.cell, cut)
      rest = rest.slice(close + 1).trimStart()
    }
  }

  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  const head = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  const bar = head.indexOf("|")
  return {
    date,
    secondaryDate,
    status,
    code,
    description: clip(head, bounds.cell, cut),
    payee: bar >= 0 ? clip(head.slice(0, bar).trim(), bounds.cell, cut) : clip(head, bounds.cell, cut),
    note: bar >= 0 ? clip(head.slice(bar + 1).trim(), bounds.cell, cut) : null,
    comment: comment === null || comment === "" ? null : clip(comment, bounds.cell, cut),
    tags: comment === null ? [] : tagsIn(comment),
    postings: [],
  }
}

/** One posting as it was stated, with the number under it and whether the line
 *  carried a cost annotation. */
interface Stated {
  readonly posting: HledgerPosting
  readonly value: Decimal | null
  readonly cost: boolean
}

/**
 * One posting line, or `null` when the line is not one — the caller keeps the
 * text as a raw entry, because a line that looks like a posting and states
 * something unreadable is not a posting this reader may guess about.
 */
const postingOf = (
  raw: string,
  bounds: HledgerBounds,
  cut: { long: boolean },
): Stated | null => {
  let content = raw.trim()
  if (content === "") return null
  // A posting's own status mark, which this reader does not store: the
  // transaction's mark is what the page draws.
  if (content.startsWith("*") || content.startsWith("!")) content = content.slice(1).trimStart()
  if (content === "") return null

  // THE ACCOUNT ENDS AT TWO SPACES OR A TAB, which is what lets an account
  // hold a single space (`expenses:dining out`) and still be told from the
  // amount beside it.
  let end = content.length
  const tab = content.indexOf("\t")
  const gap = content.indexOf("  ")
  if (tab >= 0) end = Math.min(end, tab)
  if (gap >= 0) end = Math.min(end, gap)

  let account = content.slice(0, end).trim()
  let virtual: HledgerPosting["virtual"] = "no"
  if (account.startsWith("(") && account.endsWith(")")) {
    virtual = "unbalanced"
    account = account.slice(1, -1).trim()
  } else if (account.startsWith("[") && account.endsWith("]")) {
    virtual = "balanced"
    account = account.slice(1, -1).trim()
  }
  account = clip(account, bounds.cell, cut)
  if (account === "") return null

  const rest = content.slice(end)
  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  let region = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  // A cost annotation (`@`, `@@`) is hledger's conversion, not this account's
  // movement; a balance assertion (`=`, `==`) is a claim about the running
  // total that this reader does not keep a running total to check.
  const atSign = region.indexOf("@")
  const cost = atSign >= 0
  if (cost) region = region.slice(0, atSign).trim()
  const equals = region.indexOf("=")
  if (equals >= 0) region = region.slice(0, equals).trim()

  if (region !== "" && parseAmount(region) === null) return null
  const stated = region === "" ? null : parseAmount(region)
  return {
    posting: {
      account,
      virtual,
      amount: stated === null ? null : stated.amount,
      inferred: false,
      comment: comment === null || comment === "" ? null : clip(comment, bounds.cell, cut),
      tags: comment === null ? [] : tagsIn(comment),
    },
    value: stated?.value ?? null,
    cost,
  }
}

/** A balance amount, written the way a total is drawn: a word commodity after
 *  the number with a space, a symbol before it with none, and a minus in front
 *  of a symbol (`-$1200.00`). The exact text a reader checks against their own
 *  arithmetic. */
const canonical = (commodity: string, value: Decimal): HledgerAmount => {
  const quantity = quantityOf(value)
  if (commodity === "") return { commodity, quantity, sign: "number", side: "prefix", spaced: false }
  if (/^[A-Za-z]/.test(commodity)) return { commodity, quantity, sign: "number", side: "suffix", spaced: true }
  return {
    commodity,
    quantity,
    sign: quantity.startsWith("-") ? "leading" : "number",
    side: "prefix",
    spaced: false,
  }
}

/** One posting's contribution to the account tree. */
interface Movement {
  readonly account: string
  readonly commodity: string
  readonly value: Decimal
}

const byCommodity = (amounts: ReadonlyMap<string, Decimal>): ReadonlyArray<HledgerAmount> =>
  [...amounts.entries()]
    .filter(([, value]) => value.value !== 0n)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([commodity, value]) => canonical(commodity, value))

/**
 * Accounts in TREE order: `:`-separated segments compared one at a time, so
 * `expenses`, `expenses:dining out`, `expenses:food` are contiguous and
 * `expenses-old` follows them — where a plain string sort would put
 * `expenses-old` between the parent and its own children and the flat tree
 * would draw `food` under it.
 */
const compareAccounts = (left: string, right: string): number => {
  const one = left.split(":")
  const two = right.split(":")
  for (let at = 0; at < Math.min(one.length, two.length); at++) {
    const a = one[at] as string
    const b = two[at] as string
    if (a !== b) return a < b ? -1 : 1
  }
  return one.length - two.length
}

/**
 * The postings summed: every named account and every parent prefix, each with
 * its per-commodity total.
 */
const balancesOf = (movements: ReadonlyArray<Movement>): HledgerBalances => {
  const leaves = new Map<string, Map<string, Decimal>>()
  for (const movement of movements) {
    const held = leaves.get(movement.account) ?? new Map<string, Decimal>()
    held.set(movement.commodity, add(held.get(movement.commodity) ?? { value: 0n, scale: 0 }, movement.value))
    leaves.set(movement.account, held)
  }

  const rolled = new Map<string, Map<string, Decimal>>()
  const addTo = (account: string, commodity: string, value: Decimal): void => {
    const held = rolled.get(account) ?? new Map<string, Decimal>()
    held.set(commodity, add(held.get(commodity) ?? { value: 0n, scale: 0 }, value))
    rolled.set(account, held)
  }
  for (const [account, held] of leaves) {
    const parts = account.split(":")
    for (let depth = 1; depth <= parts.length; depth++) {
      const prefix = parts.slice(0, depth).join(":")
      for (const [commodity, value] of held) addTo(prefix, commodity, value)
    }
  }

  const total = new Map<string, Decimal>()
  for (const held of leaves.values()) for (const [commodity, value] of held) total.set(commodity, add(total.get(commodity) ?? { value: 0n, scale: 0 }, value))

  const of = new Map<string, ReadonlyArray<HledgerAmount>>()
  for (const [account, held] of rolled) {
    const amounts = byCommodity(held)
    if (amounts.length > 0) of.set(account, amounts)
  }
  return {
    accounts: [...rolled.keys()].sort(compareAccounts),
    total: byCommodity(total),
    of,
  }
}

/** A comment and the line that joined it — indented comment lines under one
 *  posting or one transaction are one comment, because that is what they are. */
const joined = (held: string | null, addition: string): string => held === null ? addition : `${held}\n${addition}`

/** An indented line joining the directive above it: one entry, one text, so a
 *  directive's sub-lines stay WITH the directive rather than becoming lines the
 *  page calls unknown. */
const continueEntry = (entries: Array<HledgerEntry>, at: number, text: string): void => {
  const held = entries[at]
  if (held !== undefined) entries[at] = { ...held, text: joined(held.text, text) }
}

const scan = (text: string, bounds: HledgerBounds): HledgerJournal => {
  const cut = { long: false }
  const rawLines = text.split("\n")
  // A trailing newline is the end of the last line, not a line of its own.
  const logical = text === "" ? 0 : text.endsWith("\n") ? rawLines.length - 1 : rawLines.length
  const read = Math.min(logical, bounds.lines)
  const truncated = logical > bounds.lines

  const transactions: Array<HledgerTransaction> = []
  const entries: Array<HledgerEntry> = []
  const movements: Array<Movement> = []
  let moreTransactions = false

  /** The transaction being read, its postings as written, and whether it is
   *  still being KEPT — past the transaction bound the postings are consumed
   *  and dropped, so the file is walked once and the cap costs no second pass. */
  let current: { txn: HledgerTransaction; postings: Array<Stated> } | null = null
  let keeping = false
  let inComment = false
  /** The entry index of the directive an indented line would continue, or
   *  `null` when there is none to continue. */
  let directive: number | null = null

  const keep = (entry: HledgerEntry): void => {
    entries.push(entry)
    directive = entry.kind === "directive" ? entries.length - 1 : null
  }

  const finish = (): void => {
    directive = null
    if (current === null) return
    const held = current
    current = null
    if (!keeping) return

    // THE INFERRED AMOUNT, per GROUP: the ordinary postings balance among
    // themselves and so do the balanced virtuals, while a `(…)` unbalanced
    // posting balances nothing. A transaction with a cost is never inferred
    // from — hledger balances it in the cost commodity and this reader does not
    // convert — and a group infers only when exactly one amount is missing and
    // every amount it does state is in one commodity.
    const inferred = new Map<number, { readonly value: Decimal; readonly commodity: string }>()
    if (!held.postings.some((one) => one.cost)) {
      for (const virtual of ["no", "balanced"] as const) {
        const group = held.postings.flatMap((one, at) => (one.posting.virtual === virtual ? [{ one, at }] : []))
        const known = group.filter(({ one }) => one.value !== null)
        const missing = group.filter(({ one }) => one.value === null)
        const commodities = new Set(known.map(({ one }) => one.posting.amount?.commodity ?? ""))
        if (missing.length !== 1 || known.length === 0 || commodities.size !== 1) continue
        const target = missing[0]
        if (target === undefined) continue
        let sum: Decimal = { value: 0n, scale: 0 }
        for (const { one } of known) if (one.value !== null) sum = add(sum, one.value)
        // The COMMODITY comes from an amount the group DID state — the posting
        // being inferred into has none, which is the whole reason it is here.
        const commodity = known[0]?.one.posting.amount?.commodity ?? ""
        inferred.set(target.at, { value: negated(sum), commodity })
      }
    }

    const postings = held.postings.map((one, at) => {
      const filled = inferred.get(at)
      if (filled === undefined) return one.posting
      return { ...one.posting, amount: canonical(filled.commodity, filled.value), inferred: true }
    })
    transactions.push({ ...held.txn, postings })
    for (const [at, one] of held.postings.entries()) {
      const posting = postings[at]
      const value = inferred.get(at)?.value ?? one.value
      if (posting === undefined) continue
      const amount = posting.amount
      if (value === null || amount === null) continue
      movements.push({ account: posting.account, commodity: amount.commodity, value })
    }
  }

  for (let at = 0; at < read; at++) {
    const raw = (rawLines[at] as string).endsWith("\r") ? (rawLines[at] as string).slice(0, -1) : (rawLines[at] as string)
    const line = at + 1
    const text = clip(raw, bounds.cell, cut)

    if (inComment) {
      entries.push({ line, text, kind: "comment" })
      if (/^\s*end comment\b/.test(raw)) inComment = false
      continue
    }
    if (/^\s*$/.test(raw)) {
      finish()
      continue
    }
    if (raw.startsWith(";") || raw.startsWith("#") || raw.startsWith("*")) {
      finish()
      keep({ line, text, kind: "comment" })
      continue
    }

    if (!/^\s/.test(raw)) {
      // COLUMN ZERO: a transaction header, a comment block, or a directive.
      if (DATE_SHAPE.test(raw)) {
        const header = headerOf(raw, bounds, cut)
        if (header === null) {
          finish()
          keep({ line, text, kind: "unknown" })
          continue
        }
        finish()
        keeping = transactions.length < bounds.transactions
        if (!keeping) moreTransactions = true
        current = { txn: header, postings: [] }
        continue
      }
      if (/^\s*comment\b/.test(raw)) {
        finish()
        inComment = true
        entries.push({ line, text, kind: "comment" })
        directive = null
        continue
      }
      finish()
      keep({ line, text, kind: "directive" })
      continue
    }

    // INDENTED. A comment here belongs to what it sits under: the transaction
    // before its postings, or the posting above it — and a line that continues
    // a directive stays in that directive's text.
    const content = raw.trim()
    if (content === "") continue
    if (content.startsWith(";") || content.startsWith("#")) {
      const comment = content.replace(/^[;#]+\s*/, "").trim()
      if (current === null) {
        if (directive === null) keep({ line, text, kind: "comment" })
        else continueEntry(entries, directive, content)
      } else if (current.postings.length === 0) {
        current.txn = {
          ...current.txn,
          comment: joined(current.txn.comment, comment),
          tags: [...current.txn.tags, ...tagsIn(comment)],
        }
      } else {
        const last = current.postings[current.postings.length - 1]
        if (last !== undefined) {
          current.postings[current.postings.length - 1] = {
            ...last,
            posting: {
              ...last.posting,
              comment: joined(last.posting.comment, comment),
              tags: [...last.posting.tags, ...tagsIn(comment)],
            },
          }
        }
      }
      continue
    }

    if (current === null) {
      if (directive === null) keep({ line, text, kind: "unknown" })
      else continueEntry(entries, directive, content)
      continue
    }
    const stated = postingOf(raw, bounds, cut)
    if (stated === null) {
      keep({ line, text, kind: "unknown" })
      continue
    }
    if (keeping) current.postings.push(stated)
  }
  finish()

  return {
    transactions,
    entries,
    balances: balancesOf(movements),
    moreTransactions,
    truncated,
    longCells: cut.long,
    lines: read,
  }
}

/** A journal, read — bounded, exact and total. */
export const hledgerJournal = (text: string, bounds?: Partial<HledgerBounds>): HledgerJournal =>
  scan(text, boundedBy(bounds))

/** An amount as a person wrote it: the symbol against the number (with a minus
 *  in front of it when that is where the file put it), a word commodity after
 *  it with a space. */
export const hledgerAmountText = (amount: HledgerAmount): string => {
  if (amount.commodity === "") return amount.quantity
  const gap = amount.spaced ? " " : ""
  if (amount.side === "suffix") return `${amount.quantity}${gap}${amount.commodity}`
  if (amount.sign === "leading" && amount.quantity.startsWith("-")) {
    return `-${amount.commodity}${gap}${amount.quantity.slice(1)}`
  }
  return `${amount.commodity}${gap}${amount.quantity}`
}
