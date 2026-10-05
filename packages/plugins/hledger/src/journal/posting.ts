/**
 * ONE POSTING, AS THE LINE UNDER A HEADER STATES IT — the account, its bracket
 * pair, its amount, and whatever was written beside it.
 *
 * `null` is a line that is NOT a posting: a line that looks like one and states
 * something unreadable is a line this reader may not guess about, so the caller
 * keeps it as raw text. That refusal is why the amount parse is asked ONCE:
 * a second call to the same function over the same region was how the old
 * reading told an omission from a refusal, and asking it twice is asking a
 * question whose answer cannot differ.
 *
 * The account ENDS AT TWO SPACES OR A TAB, which is what lets an account hold a
 * single space (`expenses:dining out`) and still be told from the amount beside
 * it. A cost annotation (`@`, `@@`) and a balance assertion (`=`, `==`) are cut
 * off before the amount is read, and the cost is remembered rather than modelled
 * — hledger balances such a transaction in the cost commodity and this reader
 * does not convert.
 */
import { type Amount, parseAmount } from "./amount.ts"
import { type Tag, tagsIn } from "./tags.ts"

/** One posting under a transaction. `virtual` is the account's bracket pair:
 *  `(acct)` unbalanced, `[acct]` balanced, none for an ordinary posting. An
 *  amount is `null` when the line stated none and it could not be inferred —
 *  or when the line stated only an ASSERTION, which is a claim about a running
 *  total and not an omission to fill ({@link ./infer.ts}). `cost` and
 *  `assertion` are the annotations as written (`@ $271.12`, `= $5,123.45`),
 *  kept so a page can draw them beside the amount. */
export interface Posting {
  readonly account: string
  readonly virtual: "no" | "unbalanced" | "balanced"
  readonly amount: Amount | null
  readonly inferred: boolean
  readonly cost: string | null
  readonly assertion: string | null
  readonly comment: string | null
  /** The comment's own words, with its tags taken out. */
  readonly prose: string
  readonly tags: ReadonlyArray<Tag>
}

/** One posting as it was stated, with whether the line carried a cost
 *  annotation — the fact {@link ./infer.ts} reads to leave the transaction
 *  unknown rather than convert. */
export interface Stated {
  readonly posting: Posting
  readonly cost: boolean
}

/**
 * One posting line, or `null` when the line is not one — the caller keeps the
 * text as a raw entry, because a line that looks like a posting and states
 * something unreadable is not a posting this reader may guess about.
 */
export const postingOf = (raw: string): Stated | null => {
  let content = raw.trim()
  if (content === "") return null
  // A posting's own status mark, which this reader does not store: the
  // transaction's mark is what the page draws.
  if (content.startsWith("*") || content.startsWith("!")) content = content.slice(1).trimStart()
  if (content === "") return null

  let end = content.length
  const tab = content.indexOf("\t")
  const gap = content.indexOf("  ")
  if (tab >= 0) end = Math.min(end, tab)
  if (gap >= 0) end = Math.min(end, gap)

  let account = content.slice(0, end).trim()
  let virtual: Posting["virtual"] = "no"
  if (account.startsWith("(") && account.endsWith(")")) {
    virtual = "unbalanced"
    account = account.slice(1, -1).trim()
  } else if (account.startsWith("[") && account.endsWith("]")) {
    virtual = "balanced"
    account = account.slice(1, -1).trim()
  }
  if (account === "") return null

  const rest = content.slice(end)
  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  let region = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  // A COST is the annotation as written (`@ $271.12`, `@@ 1,000.00 EUR`) and a
  // BALANCE ASSERTION is the claim after `=` (`= $5,123.45`). Neither is
  // modelled — hledger converts with the first and checks a running total with
  // the second — so both are kept as the text they are, for the page to draw
  // beside the amount.
  let cost: string | null = null
  const atSign = region.indexOf("@")
  if (atSign >= 0) {
    cost = region.slice(atSign).trim()
    region = region.slice(0, atSign).trim()
  }
  let assertion: string | null = null
  const equals = region.indexOf("=")
  if (equals >= 0) {
    assertion = region.slice(equals).trim()
    region = region.slice(0, equals).trim()
  }

  // ONE parse, and the refusal is its `null`: an empty region is an OMISSION,
  // which is a different answer (`amount: null`, and the inference may fill it).
  const stated = region === "" ? null : parseAmount(region)
  if (region !== "" && stated === null) return null
  const said = comment === null ? { tags: [], prose: "" } : tagsIn(comment)
  return {
    posting: {
      account,
      virtual,
      amount: stated,
      inferred: false,
      cost,
      assertion,
      comment: comment === "" ? null : comment,
      prose: said.prose,
      tags: said.tags,
    },
    cost: cost !== null,
  }
}
