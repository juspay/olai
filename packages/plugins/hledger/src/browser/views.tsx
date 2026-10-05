/**
 * The three things a journal's page can draw, and the header row above them
 * that says what the file holds.
 *
 * Split from {@link ./Hledger.tsx} so that the PAGE owns the reading and the
 * DRAWINGS own the shapes: the page reads once, parses once, and switches which
 * of these is mounted; each of these takes the piece of the parse it draws and
 * nothing else. A view that could reach back into the body or the router would
 * be a view that had to be re-read when either moved.
 *
 * WHAT THE FILE SAYS, drawn as the file wrote it — which is the whole of the
 * redesign. An amount is `Amount.written` when the reader wrote it down
 * (`$4,250.00`, grouping and all) and `decimalText` when the reader COMPUTED
 * it, in the style the file used or the house style (`./spell.ts`, which is the
 * one spinner of an amount). A cost and a balance assertion are drawn beside
 * the amount, in muted type, from the raw annotation the reader kept. A payee
 * and its note are the header's two parsed halves, never the raw description
 * again. A comment's prose is drawn once and its tags once — pills, not the
 * comment repeated.
 *
 * THE TRANSACTIONS ARE ONE ALIGNED GRID. The panel is four columns — the date,
 * the description, the amounts, a marker — and each transaction and each
 * posting row is a `col-span-full grid-cols-subgrid` group, so every amount
 * lines up down the whole page rather than within its own transaction. Month
 * bands are sticky in the same grid, so the month a reader is in stays on
 * screen.
 *
 * THE BALANCES ARE A REAL TREE with one column per commodity: the amount a
 * column holds is the amount for THAT commodity, and a row with no total shows
 * `—` rather than a zero or a colour. Collapsing is per parent, the depth
 * control clips the tree, and both are the PAGE's state (kept across a live
 * revision while the account still exists).
 *
 * THE STRIP IS A TABS PATTERN, properly: `role="tablist"`/`role="tab"` with
 * `aria-selected`, `aria-controls` pointing at the panel each tab owns, a
 * `role="tabpanel"` for each, and the arrow keys moving the selection and the
 * focus. The ids are minted from the PAGE's own unique id, because two ledger
 * pages can be mounted at once (a split pane, a kept-alive tab).
 *
 * EVERY ROW THAT REPEATS CARRIES ITS IDENTITY IN `data-*`, not only in its
 * text: `data-account`, `data-amount`, `data-status`, `data-commodity` and the
 * rest are the frozen DOM contract a scenario reads without scraping a sentence
 * the markup is free to change.
 *
 * THE ROWS ARE `<Index>` AND NOT `<For>`, for the reason `../Csv.tsx` argues
 * about its own table: a revision re-parses the file into fresh objects, so a
 * keyed list would unmount and remount every row on every write, throwing away
 * the DOM a reader was looking at — and `<Index>`'s child function runs once
 * per POSITION, so every derived value below is a function called where it is
 * drawn rather than a snapshot taken when the row was built.
 */
import { Index, Show, createEffect, createMemo } from "solid-js"

import {
  HLEDGER_CELL,
  type Amount,
  type Balances,
  type Journal,
  type Posting,
  type Tag,
  type Transaction,
} from "../journal/index.ts"

import { TESTID } from "olai-plugin-hledger/testids"

import { TAG_CLASS } from "@olai/markdown-ui/tags.ts"
import { tagStyle } from "@olai/appearance/tagInk.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"

import { amountParts, amountText } from "./spell.ts"

/** Which of the page's three drawings is on screen. The page owns the signal;
 *  this is the vocabulary it and the strip share. */
export type View = "transactions" | "balances" | "source"

const VIEWS: ReadonlyArray<{ readonly value: View; readonly label: string }> = [
  { value: "transactions", label: "Transactions" },
  { value: "balances", label: "Balances" },
  { value: "source", label: "Source" },
]

/** How deep the balances tree is drawn. `all` is the whole tree; a number is
 *  the number of `:`-segments shown, so `2` keeps depth 0 and 1. */
export type Depth = "1" | "2" | "3" | "all"

const DEPTHS: ReadonlyArray<{ readonly value: Depth; readonly label: string }> = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "all", label: "All" },
]

const tabId = (scope: string, view: View): string => `${scope}-tab-${view}`
const panelId = (scope: string, view: View): string => `${scope}-panel-${view}`

/** A count and the noun it counts, in the number it is — `1 transaction`. */
const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/** `2026-07-01` as a person reads a day — `Jul 1`. */
const humanDay = (iso: string): string => {
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  return `${MONTHS[month - 1] ?? ""} ${day}`
}

/** The days a journal spans, as a person reads them — `Jul 1 – Sep 30, 2026`,
 *  or nothing when no transaction carried a date. `YYYY-MM-DD` sorts as text,
 *  which is what makes the min and the max below a comparison. */
const dateRange = (transactions: ReadonlyArray<Transaction>): string | null => {
  let first: string | null = null
  let last: string | null = null
  for (const transaction of transactions) {
    const date = transaction.date
    if (first === null || date < first) first = date
    if (last === null || date > last) last = date
  }
  if (first === null || last === null) return null
  if (first === last) return `${humanDay(first)}, ${first.slice(0, 4)}`
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${humanDay(first)} \u2013 ${humanDay(last)}, ${first.slice(0, 4)}`
  }
  return `${humanDay(first)}, ${first.slice(0, 4)} \u2013 ${humanDay(last)}, ${last.slice(0, 4)}`
}

/** The commodities the file's postings named, sorted — the header's fourth
 *  fact, and the balances tree's columns. Read from the POSTINGS and not the
 *  rolled-up balances, because a commodity that nets to zero everywhere would
 *  have no total to be read off. */
const commoditiesOf = (ledger: Journal): ReadonlyArray<string> => {
  const held = new Set<string>()
  for (const transaction of ledger.transactions) {
    for (const posting of transaction.postings) {
      if (posting.amount !== null) held.add(posting.amount.commodity)
    }
  }
  return [...held].sort()
}

/** One fact of the header row. */
interface Fact {
  readonly kind: "dates" | "transactions" | "accounts" | "commodities"
  readonly text: string
}

/**
 * WHAT THE FILE HOLDS, as a row of facts rather than a sentence — the days it
 * spans, the transactions and accounts it has, and the commodities it uses.
 * Each fact is its own `data-fact` span, so a scenario reads one without
 * scraping the row, and each is `whitespace-nowrap` so a fact is never broken
 * across a line.
 *
 * A file with no transactions simply omits the dates rather than inventing
 * one, and a file with no commodities omits that fact too.
 */
export function LedgerHeader(props: {
  readonly ledger: Journal
  readonly onUnreadable: () => void
}) {
  const facts = createMemo((): ReadonlyArray<Fact> => {
    const read = props.ledger
    const out: Array<Fact> = []
    const range = dateRange(read.transactions)
    if (range !== null) out.push({ kind: "dates", text: range })
    out.push({ kind: "transactions", text: counted(read.transactions.length, "transaction", "transactions") })
    out.push({ kind: "accounts", text: counted(read.balances.accounts.length, "account", "accounts") })
    const commodities = commoditiesOf(read)
    if (commodities.length > 0) out.push({ kind: "commodities", text: commodities.join(" ") })
    return out
  })
  const unreadable = createMemo(() => props.ledger.entries.filter((entry) => entry.kind === "unknown").length)
  return (
    <header class="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body text-muted" data-testid={TESTID.hledgerHeader}>
      <Index each={facts()}>
        {(fact, at) => (
          <>
            <Show when={at > 0}>
              <span aria-hidden="true">·</span>
            </Show>
            <span class="whitespace-nowrap" data-testid={TESTID.hledgerFact} data-fact={fact().kind}>{fact().text}</span>
          </>
        )}
      </Index>
      <Show when={unreadable() > 0}>
        <button
          type="button"
          class="ml-1 inline-flex min-h-8 cursor-pointer items-center rounded-control border border-alarm/40 bg-alarm/10 px-2 py-0.5 text-label text-alarm hover:bg-alarm/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-alarm md:min-h-0"
          data-testid={TESTID.hledgerUnreadable}
          onClick={() => props.onUnreadable()}
        >
          {`\u26a0 ${counted(unreadable(), "line", "lines")} not read`}
        </button>
      </Show>
    </header>
  )
}

/** The page's view strip — a tablist whose arrow keys move the selection, as a
 *  tabs pattern's do. Sticky under the chrome, so the view a reader is in stays
 *  on screen. */
export function TabStrip(props: {
  readonly scope: string
  readonly view: View
  readonly onPick: (view: View) => void
}) {
  let strip: HTMLDivElement | undefined
  /** Select and focus one tab — the three ways in (a step, Home, End) end
   *  here, so the focus and the selection cannot drift apart. */
  const go = (view: View | undefined): void => {
    if (view === undefined) return
    props.onPick(view)
    strip?.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.focus()
  }
  /** Select and focus a tab by offset, wrapping — what Left/Right do. */
  const step = (from: View, by: number): void => {
    const at = VIEWS.findIndex((one) => one.value === from)
    go(VIEWS[(at + by + VIEWS.length) % VIEWS.length]?.value)
  }
  const onKey = (event: KeyboardEvent): void => {
    const node = event.target instanceof HTMLElement ? event.target : null
    const current = node?.dataset["view"] as View | undefined
    if (current === undefined) return
    if (event.key === "ArrowRight") { event.preventDefault(); step(current, 1) }
    else if (event.key === "ArrowLeft") { event.preventDefault(); step(current, -1) }
    else if (event.key === "Home") { event.preventDefault(); go(VIEWS[0]?.value) }
    else if (event.key === "End") { event.preventDefault(); go(VIEWS[VIEWS.length - 1]?.value) }
  }
  return (
    <div
      class={`sticky top-[var(--height-chrome)] ${LAYER.page} mb-4 flex gap-1 border-b border-rule bg-paper`}
      ref={strip}
      role="tablist"
      onKeyDown={onKey}
    >
      <Index each={VIEWS}>
        {(choice) => (
          <button
            type="button"
            role="tab"
            id={tabId(props.scope, choice().value)}
            aria-controls={panelId(props.scope, choice().value)}
            aria-selected={props.view === choice().value ? "true" : "false"}
            // Roving tabindex: the strip is ONE stop and the arrows move within
            // it, which is the tabs pattern and not three separate stops.
            tabindex={props.view === choice().value ? 0 : -1}
            class={`-mb-px border-b-2 px-3 py-1.5 text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              props.view === choice().value
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
            data-testid={TESTID.hledgerTab}
            data-view={choice().value}
            onClick={() => props.onPick(choice().value)}
          >
            {choice().label}
          </button>
        )}
      </Index>
    </div>
  )
}

/** One transaction's header: date, status, payee, note, code and tags — drawn
 *  in the same subgrid as its postings so the amount columns align. */
function TransactionHead(props: { readonly transaction: Transaction }) {
  const one = () => props.transaction
  return (
    <div class="col-span-full grid grid-cols-subgrid items-baseline py-0.5">
      <span class="col-span-3 font-mono text-caption text-muted md:col-span-1 md:text-label">
        {one().date}
        <Show when={one().secondaryDate}>{(second) => <>{`=${second()}`}</>}</Show>
      </span>
      <span class="col-span-3 flex min-w-0 items-baseline gap-1.5 md:col-span-1">
        <StatusDot status={one().status} />
        <span class="truncate text-body font-medium text-ink">{one().payee}</span>
        <Show when={one().note}>
          {(note) => (
            <>
              <span aria-hidden="true" class="text-muted">·</span>
              <span class="truncate text-label text-muted" data-testid={TESTID.hledgerTxnNote}>{note()}</span>
            </>
          )}
        </Show>
        <Show when={one().code}>
          {(code) => <span class="font-mono text-caption text-muted">({code()})</span>}
        </Show>
      </span>
      <span class="col-span-3 flex flex-wrap justify-end gap-x-2 md:col-span-1">
        <Index each={one().tags}>{(tag) => <TagPill tag={tag()} />}</Index>
      </span>
      {/* The marker column — a placeholder on a laptop, gone on a phone where
          the postings carry their own. */}
      <span class="hidden md:block" />
    </div>
  )
}

/** One transaction: its header, its own comment and tags, and its postings —
 *  a subgrid group so a posting's account and amount land in the page's own
 *  columns. */
function TransactionRow(props: { readonly transaction: Transaction }) {
  const one = () => props.transaction
  return (
    <div
      class="col-span-full grid grid-cols-subgrid items-baseline hover:bg-rule/30"
      data-testid={TESTID.hledgerTxn}
      data-date={one().date}
      data-status={one().status}
      data-code={one().code ?? ""}
      data-description={one().description}
      data-payee={one().payee}
      data-note={one().note ?? ""}
    >
      <TransactionHead transaction={one()} />
      {/* The comment's PROSE alone: its tags are the pills above, drawn once. */}
      <Show when={one().prose}>
        {(prose) => (
          <div class="col-span-full pl-1 text-label italic text-muted" data-testid={TESTID.hledgerTxnComment}>{prose()}</div>
        )}
      </Show>
      <Index each={one().postings}>{(posting) => <PostingRow posting={posting()} />}</Index>
    </div>
  )
}

/** The six-pixel dot that says how a transaction is marked. */
function StatusDot(props: { readonly status: Transaction["status"] }) {
  const label = (): string =>
    props.status === "cleared" ? "cleared" : props.status === "pending" ? "pending" : "not marked"
  return (
    <span
      role="img"
      aria-label={label()}
      data-testid={TESTID.hledgerStatus}
      data-status={props.status}
      class={`inline-block size-1.5 shrink-0 self-center rounded-full ${
        props.status === "cleared" ? "bg-done" : props.status === "pending" ? "bg-doing" : "border border-muted"
      }`}
    />
  )
}

/** One posting — the account (parent path muted, leaf ink), whatever it did to
 *  it, and whatever was written beside it. */
function PostingRow(props: { readonly posting: Posting }) {
  // One derivation, read twice (the `data-amount` fact and the amount drawn):
  // `./spell.ts`'s one spelling of an amount is the thing the markup and the
  // attribute may not disagree about.
  const amount = (): string => (props.posting.amount === null ? "" : amountText(props.posting.amount))
  return (
    <div
      class="col-span-full grid grid-cols-subgrid items-baseline py-px"
      data-testid={TESTID.hledgerPosting}
      data-account={props.posting.account}
      data-amount={amount()}
      data-inferred={props.posting.inferred ? "true" : "false"}
      data-cost={props.posting.cost ?? ""}
      data-assertion={props.posting.assertion ?? ""}
      data-virtual={props.posting.virtual}
    >
      <span class="hidden md:block" />
      <span class="flex min-w-0 items-baseline gap-1.5">
        <AccountName account={props.posting.account} virtual={props.posting.virtual} />
        <Show when={props.posting.prose}>
          {(prose) => (
            <span class="truncate text-label italic text-muted" data-testid={TESTID.hledgerPostingComment}>{prose()}</span>
          )}
        </Show>
        <Index each={props.posting.tags}>{(tag) => <TagPill tag={tag()} />}</Index>
      </span>
      <span class="flex items-baseline justify-end gap-1.5 font-mono text-label tabular-nums">
        <Show when={props.posting.amount}>
          {(held) => <AmountSpans amount={held()} muted={props.posting.inferred} />}
        </Show>
        <Show when={props.posting.cost}>
          {(cost) => <span class="truncate text-muted" data-testid={TESTID.hledgerCost} title="cost annotation">{cost()}</span>}
        </Show>
        <Show when={props.posting.assertion}>
          {(claim) => <span class="truncate text-muted" data-testid={TESTID.hledgerAssertion} title="balance assertion">{claim()}</span>}
        </Show>
      </span>
      <span class="flex justify-center">
        <Show when={props.posting.inferred}>
          <span class="text-muted" data-testid={TESTID.hledgerInferred} title="inferred" aria-label="inferred">◌</span>
        </Show>
      </span>
    </div>
  )
}

/** The account, with its parent path muted and its leaf in ink, wrapped in the
 *  virtual posting's bracket pair. On a phone the whole name truncates FROM THE
 *  LEFT (the `direction` flip) so the leaf — the part a reader scans for — stays
 *  visible; the inner span keeps the two halves in their written order. */
function AccountName(props: { readonly account: string; readonly virtual: Posting["virtual"] }) {
  const cut = (): number => props.account.lastIndexOf(":")
  const parent = (): string => (cut() < 0 ? "" : props.account.slice(0, cut() + 1))
  const leaf = (): string => (cut() < 0 ? props.account : props.account.slice(cut() + 1))
  const brackets = (): [string, string] =>
    props.virtual === "balanced" ? ["[", "]"] : props.virtual === "unbalanced" ? ["(", ")"] : ["", ""]
  return (
    <span class="min-w-0 truncate text-left font-mono text-label [direction:rtl] md:[direction:ltr]">
      <span class="[direction:ltr] [unicode-bidi:isolate]">
        <span class="text-muted">{brackets()[0]}{parent()}</span>
        <span class="text-ink">{leaf()}{brackets()[1]}</span>
      </span>
    </span>
  )
}

/** An amount split into its prefix, digits and suffix, so the number column a
 *  right-aligned `tabular-nums` run of rows shares. Muted when the reader
 *  inferred it. */
function AmountSpans(props: { readonly amount: Amount; readonly muted: boolean }) {
  const parts = () => amountParts(props.amount)
  const ink = () => (props.muted ? "text-muted" : "text-ink")
  // ONE flex item, so the column's `gap` falls between the amount and the
  // cost or assertion beside it and never inside the amount: `$ 4,250.00`
  // would be a different number from `$4,250.00`.
  return (
    <span class="whitespace-nowrap">
      <Show when={parts().prefix}>{(prefix) => <span class={ink()}>{prefix()}</span>}</Show>
      <span class={ink()}>{parts().number}</span>
      <Show when={parts().suffix}>{(suffix) => <span class={ink()}>{suffix()}</span>}</Show>
    </span>
  )
}

/** One tag, as a pill — the same ink every `#tag` in the app wears
 *  (`@olai/markdown-ui/tags.ts`), keyed on the tag's own words. */
function TagPill(props: { readonly tag: Tag }) {
  const text = (): string => `#${props.tag.key}${props.tag.value === null ? "" : `:${props.tag.value}`}`
  return (
    <span
      class={TAG_CLASS}
      style={tagStyle(props.tag.key)}
      data-testid={TESTID.hledgerTag}
      data-tag={text()}
    >
      {text()}
    </span>
  )
}

/** One month's heading, a band across the grid: the month and how many
 *  transactions it holds. Sticky under the chrome, so it stays while its
 *  transactions scroll. */
function MonthBand(props: { readonly month: string; readonly count: number }) {
  const label = (): string => {
    const year = props.month.slice(0, 4)
    const month = Number(props.month.slice(5, 7))
    return `${MONTH_NAMES[month - 1] ?? ""} ${year}`
  }
  return (
    <div
      class={`col-span-full sticky top-[calc(var(--height-chrome)+2.125rem)] ${LAYER.row} border-b border-rule bg-paper py-1 text-caption uppercase tracking-wide text-muted`}
      data-testid={TESTID.hledgerMonth}
      data-month={props.month}
    >
      <div class="flex items-baseline justify-between gap-4">
        <span>{label()}</span>{" "}
        <span>{counted(props.count, "transaction", "transactions")}</span>
      </div>
    </div>
  )
}

/** Every transaction, in file order, under its month — the journal's main
 *  reading. One grid down the whole page. */
export function TransactionsPanel(props: {
  readonly scope: string
  readonly transactions: ReadonlyArray<Transaction>
}) {
  const months = createMemo((): ReadonlyArray<{ readonly month: string; readonly transactions: ReadonlyArray<Transaction> }> => {
    const out: Array<{ month: string; transactions: Array<Transaction> }> = []
    for (const transaction of props.transactions) {
      const month = transaction.date.slice(0, 7)
      const held = out[out.length - 1]
      if (held === undefined || held.month !== month) out.push({ month, transactions: [transaction] })
      else held.transactions.push(transaction)
    }
    return out
  })
  return (
    <div
      role="tabpanel"
      id={panelId(props.scope, "transactions")}
      aria-labelledby={tabId(props.scope, "transactions")}
      tabindex={0}
      class="grid grid-cols-[minmax(0,1fr)_max-content_1rem] md:grid-cols-[5.5rem_minmax(0,1fr)_max-content_1rem]"
      data-testid={TESTID.hledgerTransactions}
    >
      <Index each={months()}>
        {(group) => (
          <>
            <MonthBand month={group().month} count={group().transactions.length} />
            <Index each={group().transactions}>
              {(transaction) => <TransactionRow transaction={transaction()} />}
            </Index>
          </>
        )}
      </Index>
    </div>
  )
}

/** The depth control — a strip of four clips. Held here rather than taken from
 *  `@olai/ui-primitives`' `Segmented` because the DOM contract gives each
 *  button a `data-depth` (`1|2|3|all`) that `Segmented` has no way to emit. */
function DepthControl(props: { readonly value: Depth; readonly onPick: (depth: Depth) => void }) {
  return (
    <div class="inline-flex overflow-hidden rounded-full border border-rule" data-testid={TESTID.hledgerDepth}>
      <Index each={DEPTHS}>
        {(choice) => (
          <button
            type="button"
            class={`${TARGET} inline-flex items-center px-3 text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-0 md:py-1 ${
              props.value === choice().value ? "bg-accent/10 text-ink" : "text-muted hover:text-ink"
            }`}
            data-depth={choice().value}
            aria-pressed={props.value === choice().value ? "true" : "false"}
            onClick={() => props.onPick(choice().value)}
          >
            {choice().label}
          </button>
        )}
      </Index>
    </div>
  )
}

/** One account's vertical guides, one rule per level in. */
function DepthGuides(props: { readonly depth: number }) {
  return (
    <Index each={Array.from({ length: props.depth }, (_, at) => at)}>
      {() => <span aria-hidden="true" class="mr-1.5 inline-block h-4 w-px shrink-0 self-center border-l border-rule" />}
    </Index>
  )
}

/**
 * Every account, as a tree with one column per commodity.
 *
 * FLAT AND INDENTED rather than nested lists: the format hands back the account
 * names in TREE order (`../journal/balances.ts`), so this draws one row per
 * name at `depth` columns in, and `data-depth` says the same thing as the
 * guides. A row with no total shows `—`; a commodity the row does not hold
 * leaves its column blank, because a zero and an absent commodity are different
 * facts and neither is a sign.
 *
 * COLLAPSE AND DEPTH ARE THE PAGE'S STATE, handed in — so a live revision that
 * re-parses the file keeps the tree a reader had opened.
 */
export function BalancesPanel(props: {
  readonly scope: string
  readonly balances: Balances
  readonly depth: Depth
  readonly onDepth: (depth: Depth) => void
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (account: string) => void
}) {
  const commodities = createMemo((): ReadonlyArray<string> => {
    const held = new Set<string>()
    for (const amounts of props.balances.of.values()) {
      for (const amount of amounts) held.add(amount.commodity)
    }
    return [...held].sort()
  })
  const stacked = (): boolean => commodities().length > 4
  const columns = (): number => (stacked() ? 1 : commodities().length)
  const parents = createMemo((): ReadonlySet<string> => {
    const held = new Set<string>()
    for (const account of props.balances.accounts) {
      const at = account.lastIndexOf(":")
      if (at >= 0) held.add(account.slice(0, at))
    }
    return held
  })
  /** The rows the control and the collapse state leave on screen, in tree
   *  order. A row is hidden when an ancestor is collapsed or when it is deeper
   *  than the control allows. */
  const rows = createMemo((): ReadonlyArray<string> => {
    const limit = props.depth === "all" ? Infinity : Number(props.depth)
    const out: Array<string> = []
    const stack: Array<{ readonly depth: number; readonly collapsed: boolean }> = []
    for (const account of props.balances.accounts) {
      const depth = account.split(":").length - 1
      let top = stack[stack.length - 1]
      while (top !== undefined && top.depth >= depth) {
        stack.pop()
        top = stack[stack.length - 1]
      }
      const hidden = stack.some((entry) => entry.collapsed)
      if (!hidden && depth < limit) out.push(account)
      stack.push({ depth, collapsed: props.collapsed.has(account) })
    }
    return out
  })
  const amountsOf = (account: string): ReadonlyArray<Amount> => props.balances.of.get(account) ?? []
  const amountFor = (account: string, commodity: string): Amount | undefined =>
    amountsOf(account).find((amount) => amount.commodity === commodity)
  return (
    <div
      role="tabpanel"
      id={panelId(props.scope, "balances")}
      aria-labelledby={tabId(props.scope, "balances")}
      tabindex={0}
      class="relative flex flex-col gap-2"
      data-testid={TESTID.hledgerBalances}
    >
      <div class="flex justify-end">
        <DepthControl value={props.depth} onPick={props.onDepth} />
      </div>
      <div class="overflow-x-auto">
        <div
          class="grid w-max min-w-full"
          style={{
            "grid-template-columns": columns() === 0
              ? "minmax(0, 1fr)"
              : `minmax(0, 1fr) repeat(${columns()}, minmax(4rem, max-content))`,
          }}
        >
          <div
            class="col-span-full grid grid-cols-subgrid bg-rule/40 py-1 font-semibold"
            data-testid={TESTID.hledgerBalanceHead}
          >
            <span class="px-2">Account</span>
            <Show
              when={stacked()}
              fallback={
                <Index each={commodities()}>
                  {(commodity) => (
                    <span class="px-2 text-right tabular-nums" data-testid={TESTID.hledgerBalanceCommodity} data-commodity={commodity()}>
                      {commodity()}
                    </span>
                  )}
                </Index>
              }
            >
              <span class="flex flex-col px-2 text-right tabular-nums">
                <Index each={commodities()}>
                  {(commodity) => (
                    <span data-testid={TESTID.hledgerBalanceCommodity} data-commodity={commodity()}>{commodity()}</span>
                  )}
                </Index>
              </span>
            </Show>
          </div>
          <Index each={rows()}>
            {(account) => {
              const depth = (): number => account().split(":").length - 1
              const hasChildren = (): boolean => parents().has(account())
              const isCollapsed = (): boolean => props.collapsed.has(account())
              return (
                <div
                  class={`col-span-full grid grid-cols-subgrid border-b border-rule py-0.5 ${
                    depth() === 0 ? "font-semibold" : "text-body text-ink"
                  }`}
                  data-testid={TESTID.hledgerBalance}
                  data-account={account()}
                  data-depth={depth()}
                >
                  <span class="flex min-w-0 items-center gap-1 px-2">
                    <DepthGuides depth={depth()} />
                    <Show when={hasChildren()} fallback={<span class="inline-block w-4 shrink-0" />}>
                      <button
                        type="button"
                        class="inline-flex w-4 shrink-0 cursor-pointer justify-center text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-expanded={isCollapsed() ? "false" : "true"}
                        aria-label={isCollapsed() ? `Expand ${account()}` : `Collapse ${account()}`}
                        data-testid={TESTID.hledgerBalanceToggle}
                        onClick={() => props.onToggle(account())}
                      >
                        {isCollapsed() ? "▸" : "▾"}
                      </button>
                    </Show>
                    <span class="truncate text-ink" data-testid={TESTID.hledgerBalanceAccount}>
                      {account().slice(account().lastIndexOf(":") + 1)}
                    </span>
                  </span>
                  <Show
                    when={amountsOf(account()).length > 0}
                    fallback={
                      <>
                        <span class="px-2 text-right text-muted" data-testid={TESTID.hledgerBalanceEmpty}>—</span>
                        <Index each={Array.from({ length: Math.max(0, columns() - 1) }, (_, at) => at)}>
                          {() => <span />}
                        </Index>
                      </>
                    }
                  >
                    <Show
                      when={stacked()}
                      fallback={
                        <Index each={commodities()}>
                          {(commodity) => (
                            <Show when={amountFor(account(), commodity())} fallback={<span />}>
                              {(amount) => (
                                <span
                                  class="px-2 text-right font-mono text-label tabular-nums"
                                  data-testid={TESTID.hledgerBalanceAmount}
                                  data-commodity={amount().commodity}
                                >
                                  {amountText(amount())}
                                </span>
                              )}
                            </Show>
                          )}
                        </Index>
                      }
                    >
                      <span class="flex flex-col px-2 text-right font-mono text-label tabular-nums">
                        <Index each={amountsOf(account())}>
                          {(amount) => (
                            <span data-testid={TESTID.hledgerBalanceAmount} data-commodity={amount().commodity}>
                              {amountText(amount())}
                            </span>
                          )}
                        </Index>
                      </span>
                    </Show>
                  </Show>
                </div>
              )
            }}
          </Index>
        </div>
      </div>
      {/* The commodity columns run off the side on a phone, and a hard cut at
          the edge reads as the last column: a fade says there are more. */}
      <div class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper md:hidden" aria-hidden="true" />
    </div>
  )
}

/**
 * The file itself, as far as it was READ.
 *
 * ONE SPAN PER READ LINE, with the line's number in a gutter span beside it and
 * the lines joined by newlines — so the panel's own text is the file's text,
 * byte for byte, exactly as the reader read it. A line the reader kept as raw
 * text says WHICH KIND it is in `data-entry` (`directive`/`comment`/`unknown`);
 * a directive or a comment is dimmed, and a line the reader could NOT make sense
 * of is marked in alarm — which is the line the header's unreadable button
 * scrolls to.
 */
export function SourcePanel(props: {
  readonly scope: string
  readonly text: string
  readonly read: Journal
  readonly reveal: number
}) {
  const lines = createMemo((): ReadonlyArray<string> =>
    props.text.split("\n", props.read.lines + 1).slice(0, props.read.lines))
  const kinds = createMemo((): ReadonlyMap<number, string> => {
    const held = new Map<number, string>()
    // The SPAN the fold recorded, not the line count of the text: the text is
    // cut at the cell bound, so a cut directive would lose the marks of the
    // lines that continued it.
    for (const entry of props.read.entries) {
      for (let at = 0; at < entry.span; at++) held.set(entry.line + at, entry.kind)
    }
    return held
  })
  let scroller: HTMLDivElement | undefined
  createEffect(() => {
    const count = props.reveal
    if (count === 0) return
    scroller?.querySelector<HTMLElement>('[data-entry="unknown"]')?.scrollIntoView({ block: "center", inline: "nearest" })
  })
  const lineClass = (entry: string | undefined): string => {
    if (entry === "unknown") return "bg-alarm/10 border-l-2 border-alarm"
    if (entry === "comment" || entry === "directive") return "text-muted"
    return ""
  }
  return (
    <div
      role="tabpanel"
      id={panelId(props.scope, "source")}
      aria-labelledby={tabId(props.scope, "source")}
      tabindex={0}
      class="relative"
      data-testid={TESTID.hledgerSource}
    >
      <div class="overflow-x-auto" ref={scroller}>
        <pre class="m-0 w-max min-w-full font-mono text-label leading-relaxed">
          <Index each={lines()}>
            {(line, at) => (
              <>
                <Show when={at > 0}>{"\n"}</Show>
                <span
                  class="inline-block w-10 select-none pr-3 text-right text-muted"
                  data-testid={TESTID.hledgerSourceNumber}
                  aria-hidden="true"
                >
                  {at + 1}
                </span>
                <span
                  data-testid={TESTID.hledgerSourceLine}
                  data-line={at + 1}
                  data-entry={kinds().get(at + 1)}
                  class={lineClass(kinds().get(at + 1))}
                >
                  {line().slice(0, HLEDGER_CELL)}
                </span>
              </>
            )}
          </Index>
        </pre>
      </div>
      {/* On a phone the source scrolls sideways, and a hard cut at the edge
          reads as the end of the line: a fade says there is more. */}
      <div class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper md:hidden" aria-hidden="true" />
    </div>
  )
}
