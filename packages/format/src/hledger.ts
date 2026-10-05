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
 *   - COSTS (`@` and `@@`) are discarded. The posting's own amount is what the
 *     account moved; a price annotation is a conversion hledger applies when it
 *     reports in another commodity.
 *   - AUTO POSTINGS (`=` rules) and PERIODIC TRANSACTIONS (`~`) are kept as the
 *     directives they are and never applied. A rule that fires today would make
 *     this reading depend on the clock, and a balance that changes while
 *     nobody edits the file is not a fact about the file.
 *   - `include` is not followed. A file's balances are the postings IN that
 *     file; following a path would make the answer depend on the rest of the
 *     disk, and the page is for the file somebody opened.
 *   - `alias`, `D`, `P`, `commodity` and `account` are not applied: they are
 *     kept, in order, as raw entries (`{@link HledgerEntry}`), because a
 *     reader who wants them wants the words.
 *
 * A commodity's minor units and thousands separators are read the way every
 * tool writes them — the last `,` or `.` in a number is the decimal mark when
 * one or two digits follow it, and everything else is grouping — rather than
 * from a `D` directive, for the same reason: the directive is somebody's
 * configuration and the digits are the file.
 *
 * ## Balances are exact, and rolled up
 *
 * Money is never a float. A quantity is a `bigint` scaled by the number of
 * decimal places it was written with, so `-1,000.50` is exactly `-100050/100`
 * and a sum of ten thousand of them is exact. Postings are summed per account
 * per commodity, and every account's total includes its children's: a posting
 * to `assets:bank:checking` is also a posting to `assets:bank` and `assets`,
 * which is what a person reading an account tree expects to see.
 *
 * An amount may be OMITTED on one posting of a transaction, and hledger's rule
 * is that it is inferred to make the transaction balance. This reads it the
 * same way WHEN it can: exactly one omission, and every amount the transaction
 * does state in one commodity. Two commodities with an omission is not an
 * error a reader can fix, so the posting keeps no amount and says so
 * (`{@link HledgerPosting.inferred}` is false and the amount is `null`).
 *
 * ## THE BOUND IS ON THE READING, not a slice taken afterwards
 *
 * The same correction `./csv.ts` argues, over the three axes a journal can be
 * enormous along: lines read ({@link HLEDGER_LINES}), transactions kept
 * ({@link HLEDGER_TRANSACTIONS}), and the length of any one field
 * ({@link HLEDGER_CELL}) — a description, a comment, an account or a raw
 * entry. The scan STOPS paying for what it will not draw: past the transaction
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
 * it is (`kind: "unknown"`), at its own line number, and the rest of the file
 * still reads.
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
 *  account, or a raw line. The axis the other two cannot cover, since a file
 *  that is one enormous line is one line and one transaction. */
export const HLEDGER_CELL = 2_000

/** How a transaction is marked: `*` cleared, `!` pending, or neither. */
export type HledgerStatus = "cleared" | "pending" | "unmarked"

/**
 * One amount, as it was written: the commodity, the exact quantity as a decimal
 * string, and which side of the number the commodity sat on. `spaced` says
 * whether a space separated them, so `$1,000.50`, `-1000.50 EUR` and `10 USD`
 * all round-trip through {@link hledgerAmountText}.
 */
export interface HledgerAmount {
  readonly commodity: string
  readonly quantity: string
  readonly side: "prefix" | "suffix"
  readonly spaced: boolean
}

/** One `key:value` from a transaction's comment. A `key:` with nothing after it
 *  keeps a null value rather than an empty string, because the empty string is
 *  a value somebody could have written. */
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
  readonly line: number
}

/** One transaction: the header's facts, its comment and tags, and its
 *  postings. `dateWritten` is the header's own spelling and `date` is that
 *  normalized to `YYYY-MM-DD` — a header whose spelling named no real day is
 *  not a transaction at all and is kept as a raw entry. */
export interface HledgerTransaction {
  readonly date: string
  readonly dateWritten: string
  readonly secondaryDate: string | null
  readonly status: HledgerStatus
  readonly code: string | null
  readonly description: string
  readonly payee: string | null
  readonly note: string | null
  readonly comment: string | null
  readonly tags: ReadonlyArray<HledgerTag>
  readonly postings: ReadonlyArray<HledgerPosting>
  readonly line: number
}

/** A line that is not a transaction header or a posting: a directive, a
 *  comment, or a line this reader could not make sense of. The TEXT is kept
 *  whole (up to {@link HLEDGER_CELL}) and nothing is interpreted. */
export interface HledgerEntry {
  readonly line: number
  readonly text: string
  readonly kind: "directive" | "comment" | "unknown"
}

/**
 * What the postings add up to. `accounts` is every account named plus every
 * parent prefix, sorted — the rows an account tree draws. `of` is each of
 * those accounts' totals, per commodity, already rolled up, holding only the
 * accounts whose total is not zero (a parent that nets to nothing has no
 * amount to draw). `leaves` are the accounts a posting actually named, and
 * `total` is the whole file's sum, per commodity.
 */
export interface HledgerBalances {
  readonly accounts: ReadonlyArray<string>
  readonly leaves: ReadonlyArray<string>
  readonly total: ReadonlyArray<HledgerAmount>
  readonly of: ReadonlyMap<string, ReadonlyArray<HledgerAmount>>
  readonly inferred: number
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

/**
 * The digits of a written number, exactly — or `null` when there are none.
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
 */
const parseDecimal = (raw: string): Decimal | null => {
  let text = raw.trim()
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
    else if (char < "0" || char > "9") return null
  }
  let mark = -1
  if (dots.length > 0 && commas.length > 0) mark = Math.max(dots[dots.length - 1] as number, commas[commas.length - 1] as number)
  else if (dots.length > 0) mark = dots[dots.length - 1] as number
  else if (commas.length === 1) {
    const only = commas[0] as number
    if (text.length - only - 1 <= 2) mark = only
  }

  let whole: string
  let fraction: string
  if (mark >= 0) {
    whole = text.slice(0, mark).replace(/[.,]/g, "")
    fraction = text.slice(mark + 1).replace(/[.,]/g, "")
  } else {
    whole = text.replace(/[.,]/g, "")
    fraction = ""
  }
  if (whole === "") whole = "0"
  if (whole.length > 0 && !/^[0-9]+$/.test(whole)) return null
  if (!/^[0-9]*$/.test(fraction)) return null
  if (whole === "0" && fraction === "") return { value: 0n, scale: 0 }
  const value = BigInt(whole + fraction)
  return { value: negative ? -value : value, scale: fraction.length }
}

/** A number as it may be written next to its commodity: an optional sign, then
 *  digits with grouping and at most one decimal mark. */
const NUMERIC = /^[-+]?[0-9][0-9.,]*/

/**
 * One posting's amount region — everything after the account, minus the
 * comment, the cost annotation and the balance assertion — as the amount it
 * states and the exact number under it.
 *
 * `null` is a region that states nothing, which is the one posting per
 * transaction that is allowed to omit its amount.
 */
const parseAmount = (raw: string): { readonly amount: HledgerAmount; readonly value: Decimal } | null => {
  let text = raw.trim()
  if (text === "") return null
  let negative = false
  if (text.startsWith("-") || text.startsWith("+")) {
    negative = text.startsWith("-")
    text = text.slice(1).trimStart()
  }

  let commodity = ""
  let side: "prefix" | "suffix" = "prefix"
  let spaced = false
  let written = ""

  if (text.startsWith('"')) {
    // A quoted commodity may hold spaces: `"quoted commodity" 5`.
    const end = text.indexOf('"', 1)
    if (end < 0) return null
    commodity = text.slice(1, end)
    const rest = text.slice(end + 1)
    spaced = /^\s/.test(rest)
    written = rest.trimStart()
  } else if (/^[0-9]/.test(text)) {
    const found = NUMERIC.exec(text)
    if (found === null) return null
    written = found[0]
    const rest = text.slice(written.length)
    spaced = /^\s/.test(rest)
    const after = rest.trim()
    commodity = after.startsWith('"') && after.endsWith('"') && after.length > 1 ? after.slice(1, -1) : after
    side = "suffix"
  } else {
    // A commodity on the left: `$10`, `€ 10`, `US$10`, `USD 10`.
    const found = /^[^0-9\s]+/.exec(text)
    if (found === null) return null
    commodity = found[0]
    const rest = text.slice(commodity.length)
    spaced = /^\s/.test(rest)
    const digits = NUMERIC.exec(rest.trimStart())
    if (digits === null) return null
    written = digits[0]
  }

  if (written.startsWith("-") || written.startsWith("+")) {
    if (written.startsWith("-")) negative = !negative
    written = written.slice(1)
  }
  const value = parseDecimal(written)
  if (value === null) return null
  const exact = negative ? negated(value) : value
  return { amount: { commodity, quantity: quantityOf(exact), side, spaced }, value: exact }
}

/** `YYYY-MM-DD` for a written day, or `null` when it names no real one. The
 *  three separators hledger accepts are all one reading here. */
const isoOf = (written: string): string | null => {
  const parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(written)
  if (parts === null) return null
  const month = Number(parts[2])
  const day = Number(parts[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${parts[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** The shape of a date at the head of a line, before it is judged a real one. */
const DATE_SHAPE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/

/** The `key:value` pairs one comment carries, in the order written. */
const tagsIn = (comment: string): ReadonlyArray<HledgerTag> => {
  const tags: Array<HledgerTag> = []
  const pattern = /([^\s:;,]+):([^\s;,]*)/g
  for (let found = pattern.exec(comment); found !== null; found = pattern.exec(comment)) {
    tags.push({ key: found[1] as string, value: found[2] === "" ? null : (found[2] as string) })
  }
  return tags
}

/** One transaction's header, or `null` when the line is not one — which
 *  includes a date-shaped line whose date names no real day, because a header
 *  this reader cannot date is a line it cannot make sense of. */
const headerOf = (line: string, at: number, bounds: HledgerBounds, cut: { long: boolean }): HledgerTransaction | null => {
  const dateWritten = DATE_SHAPE.exec(line)?.[0]
  if (dateWritten === undefined) return null
  const date = isoOf(dateWritten)
  if (date === null) return null
  let rest = line.slice(dateWritten.length)

  let secondaryDate: string | null = null
  if (rest.startsWith("=")) {
    const second = DATE_SHAPE.exec(rest.slice(1))?.[0]
    if (second !== undefined && /^(\s|$)/.test(rest.slice(1 + second.length, 2 + second.length))) {
      secondaryDate = isoOf(second)
      rest = rest.slice(1 + second.length)
    }
  }

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
    dateWritten,
    secondaryDate,
    status,
    code,
    description: clip(head, bounds.cell, cut),
    payee: bar >= 0 ? clip(head.slice(0, bar).trim(), bounds.cell, cut) : clip(head, bounds.cell, cut),
    note: bar >= 0 ? clip(head.slice(bar + 1).trim(), bounds.cell, cut) : null,
    comment: comment === null || comment === "" ? null : clip(comment, bounds.cell, cut),
    tags: comment === null ? [] : tagsIn(comment),
    postings: [],
    line: at,
  }
}

/** One posting line, or `null` when the line is not one. */
const postingOf = (
  raw: string,
  at: number,
  bounds: HledgerBounds,
  cut: { long: boolean },
): { readonly posting: HledgerPosting; readonly value: Decimal | null } | null => {
  const trimmed = raw.trim()
  if (trimmed === "") return null

  // THE ACCOUNT ENDS AT TWO SPACES OR A TAB, which is what lets an account
  // hold a single space (`expenses:dining out`) and still be told from the
  // amount beside it.
  let end = trimmed.length
  const tab = trimmed.indexOf("\t")
  const gap = trimmed.indexOf("  ")
  if (tab >= 0) end = Math.min(end, tab)
  if (gap >= 0) end = Math.min(end, gap)

  let account = trimmed.slice(0, end).trim()
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

  const rest = trimmed.slice(end)
  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  let region = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  // A cost annotation (`@`, `@@`) is hledger's conversion, not this account's
  // movement; a balance assertion (`=`, `==`) is a claim about the running
  // total that this reader does not keep a running total to check.
  const atSign = region.indexOf("@")
  if (atSign >= 0) region = region.slice(0, atSign).trim()
  const equals = region.indexOf("=")
  if (equals >= 0) region = region.slice(0, equals).trim()

  const stated = region === "" ? null : parseAmount(region)
  return {
    posting: {
      account,
      virtual,
      amount: stated === null ? null : stated.amount,
      inferred: false,
      comment: comment === null || comment === "" ? null : clip(comment, bounds.cell, cut),
      line: at,
    },
    value: stated?.value ?? null,
  }
}

/** A balance amount, written the way a total is drawn: a word commodity after
 *  the number with a space, a symbol before it with none. The exact text a
 *  reader checks against their own arithmetic. */
const canonical = (commodity: string, value: Decimal): HledgerAmount =>
  commodity === ""
    ? { commodity, quantity: quantityOf(value), side: "prefix", spaced: false }
    : /^[A-Za-z]/.test(commodity)
      ? { commodity, quantity: quantityOf(value), side: "suffix", spaced: true }
      : { commodity, quantity: quantityOf(value), side: "prefix", spaced: false }

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
 * The postings summed: every named account and every parent prefix, each with
 * its per-commodity total.
 */
const balancesOf = (movements: ReadonlyArray<Movement>, inferred: number): HledgerBalances => {
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
    accounts: [...rolled.keys()].sort(),
    leaves: [...leaves.keys()].sort(),
    total: byCommodity(total),
    of,
    inferred,
  }
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
  let inferred = 0
  let moreTransactions = false

  /** The transaction being read, its postings as written, and whether it is
   *  still being KEPT — past the transaction bound the postings are consumed
   *  and dropped, so the file is walked once and the cap costs no second pass. */
  let current: { readonly txn: HledgerTransaction; readonly postings: Array<{ posting: HledgerPosting; value: Decimal | null }> } | null = null
  let keeping = false
  let inComment = false

  const finish = (): void => {
    if (current === null) return
    const held = current
    current = null
    if (!keeping) return

    // THE INFERRED AMOUNT: exactly one omission, one commodity across
    // everything the transaction does state. Anything else is left unknown,
    // and the posting says so rather than guessing a commodity.
    const known = held.postings.filter((one) => one.value !== null)
    const commodities = new Set(known.map((one) => one.posting.amount?.commodity ?? ""))
    const missing = held.postings.filter((one) => one.value === null)
    if (missing.length === 1 && known.length > 0 && commodities.size === 1) {
      const commodity = known[0]?.posting.amount?.commodity ?? ""
      let sum: Decimal = { value: 0n, scale: 0 }
      for (const one of known) sum = add(sum, one.value as Decimal)
      const value = negated(sum)
      const target = missing[0] as { posting: HledgerPosting; value: Decimal | null }
      target.posting = { ...target.posting, amount: canonical(commodity, value), inferred: true }
      target.value = value
      inferred += 1
    }

    const postings = held.postings.map((one) => one.posting)
    transactions.push({ ...held.txn, postings })
    for (const one of held.postings) {
      const amount = one.posting.amount
      if (one.value === null || amount === null) continue
      movements.push({ account: one.posting.account, commodity: amount.commodity, value: one.value })
    }
  }

  for (let at = 0; at < read; at++) {
    const raw = (rawLines[at] as string).endsWith("\r") ? (rawLines[at] as string).slice(0, -1) : (rawLines[at] as string)
    const line = at + 1

    if (inComment) {
      entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "comment" })
      if (/^\s*end comment\b/.test(raw)) inComment = false
      continue
    }
    if (/^\s*$/.test(raw)) {
      finish()
      continue
    }
    if (raw.startsWith(";") || raw.startsWith("#") || raw.startsWith("*")) {
      finish()
      entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "comment" })
      continue
    }

    if (!/^\s/.test(raw)) {
      // COLUMN ZERO: a transaction header, a comment block, or a directive.
      if (DATE_SHAPE.test(raw)) {
        const header = headerOf(raw, line, bounds, cut)
        if (header === null) {
          finish()
          entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "unknown" })
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
        entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "comment" })
        continue
      }
      finish()
      entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "directive" })
      continue
    }

    // INDENTED: a posting of the transaction being read — or a line with no
    // transaction to be a posting of, which is kept as what it is.
    if (current === null) {
      if (raw.trim() !== "") entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "unknown" })
      continue
    }
    const parsed = postingOf(raw, line, bounds, cut)
    if (parsed === null) {
      if (raw.trim() !== "") entries.push({ line, text: clip(raw, bounds.cell, cut), kind: "unknown" })
      continue
    }
    if (keeping) current.postings.push(parsed)
  }
  finish()

  return {
    transactions,
    entries,
    balances: balancesOf(movements, inferred),
    moreTransactions,
    truncated,
    longCells: cut.long,
    lines: read,
  }
}

/** A journal, read — bounded, exact and total. */
export const hledgerJournal = (text: string, bounds?: Partial<HledgerBounds>): HledgerJournal =>
  scan(text, boundedBy(bounds))

/** An amount as a person wrote it: the symbol against the number, a word
 *  commodity after it with a space. */
export const hledgerAmountText = (amount: HledgerAmount): string => {
  if (amount.commodity === "") return amount.quantity
  const gap = amount.spaced ? " " : ""
  return amount.side === "prefix"
    ? `${amount.commodity}${gap}${amount.quantity}`
    : `${amount.quantity}${gap}${amount.commodity}`
}
