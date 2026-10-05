/**
 * The three things a journal's page can draw, and the one line above them that
 * says what the file holds.
 *
 * Split from {@link ./Hledger.tsx} so that the PAGE owns the reading and the
 * DRAWINGS own the shapes: the page reads once, parses once, and switches which
 * of these is mounted; each of these takes the piece of the parse it draws and
 * nothing else. A view that could reach back into the body or the router would
 * be a view that had to be re-read when either moved.
 *
 * THE STRIP IS A TABS PATTERN, properly: `role="tablist"`/`role="tab"`
 * with `aria-selected`, `aria-controls` pointing at the panel each tab owns, a
 * `role="tabpanel"` for each, and the arrow keys moving the selection and the
 * focus — which is what makes it a view strip rather than three buttons.
 * `@olai/ui-primitives`' `Segmented` is a settings control (`aria-pressed`, the
 * preference testids) and means "which of these is chosen"; this means "which
 * panel is showing". The ids are minted from the PAGE's own unique id, because
 * two ledger pages can be mounted at once (a split pane, a kept-alive tab) and
 * a fixed id would name two elements.
 *
 * EVERY ROW THAT REPEATS CARRIES ITS IDENTITY IN `data-*`, not only in its
 * text: `data-account`, `data-amount`, `data-status`, `data-commodity` and the
 * rest are facts a scenario reads without scraping a sentence the markup is
 * free to change. What the row SAYS is still drawn — this is a page for a
 * person first — but a test that asked "is this posting in assets:cash, and is
 * it inferred" gets an answer that does not move when a class or a wording
 * does.
 *
 * THE ROWS ARE `<Index>` AND NOT `<For>`, for the reason `../Csv.tsx` argues
 * about its own table: a revision re-parses the file into fresh objects, so a
 * keyed list would unmount and remount every row on every write, throwing away
 * the DOM a reader was looking at (and any browser state inside it). This page
 * draws a FILE, whose rows are positions in that file, and a position is what
 * `<Index>` keys.
 *
 * WHICH MAKES EVERY READ INSIDE A ROW A READ OF AN ACCESSOR. `<Index>`'s child
 * function runs once per POSITION, so a value taken out of it once — a
 * `const depth = …`, a `const value = props.tag.value` — is the value that
 * position had when the row was built and never the one it has now. What is
 * read inside the markup is a live read (the prop itself is a getter); what is
 * computed outside it is a snapshot. Every derived value below is therefore a
 * function, called where it is drawn.
 */
import { Index, Show, createMemo, createUniqueId } from "solid-js"

import {
  hledgerAmountText,
  HLEDGER_CELL,
  type HledgerBalances,
  type HledgerJournal,
  type HledgerPosting,
  type HledgerTag,
  type HledgerTransaction,
} from "@olai/format"

import { TESTID } from "olai-plugin-hledger/testids"

/** Which of the page's three drawings is on screen. The page owns the signal;
 *  this is the vocabulary it and the strip share. */
export type View = "transactions" | "balances" | "raw"

const VIEWS: ReadonlyArray<{ readonly value: View; readonly label: string }> = [
  { value: "transactions", label: "Transactions" },
  { value: "balances", label: "Balances" },
  { value: "raw", label: "Raw" },
]

const tabId = (scope: string, view: View): string => `${scope}-tab-${view}`
const panelId = (scope: string, view: View): string => `${scope}-panel-${view}`

/** A count and the noun it counts, in the number it is — `1 transaction`. */
const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

/**
 * WHAT THE FILE HOLDS, in one line — the count of transactions, the count of
 * accounts, and the days the transactions span.
 *
 * The DATE RANGE is read from the transactions and not from the raw header
 * text: a header whose date did not parse is not a transaction at all
 * (`@olai/format`'s `hledger.ts`), so there is no unreadable string to put
 * where a reader expects a day. A file with no transactions simply omits the
 * third fact rather than inventing one.
 */
export const headerLine = (ledger: HledgerJournal): string => {
  const facts: Array<string> = [
    counted(ledger.transactions.length, "transaction", "transactions"),
    counted(ledger.balances.accounts.length, "account", "accounts"),
  ]
  const range = dateRange(ledger.transactions)
  if (range !== null) facts.push(range)
  return facts.join(" · ")
}

/** The span of a journal's dates, `2026-01-05–2026-03-31`, or nothing when no
 *  transaction carried one. `YYYY-MM-DD` sorts as text, which is what makes the
 *  two comparisons below a min and a max. */
const dateRange = (transactions: ReadonlyArray<HledgerTransaction>): string | null => {
  let first: string | null = null
  let last: string | null = null
  for (const transaction of transactions) {
    const date = transaction.date
    if (first === null || date < first) first = date
    if (last === null || date > last) last = date
  }
  return first === null || last === null ? null : `${first}\u2013${last}`
}

/** The page's view strip — a tablist whose arrow keys move the selection, as a
 *  tabs pattern's do. */
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
    // The event's own target, narrowed rather than asserted: the handler is on
    // the strip and the key belongs to whichever tab is focused.
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
      class="mb-5 flex gap-1 border-b border-rule"
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
            // A border under the selected tab rather than a fill: the strip
            // shares one baseline with the page below it, and a filled chip in
            // a list of three reads as a filter rather than a view.
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

/** Every transaction, in file order — the journal's main reading. */
export function TransactionsPanel(props: {
  readonly scope: string
  readonly transactions: ReadonlyArray<HledgerTransaction>
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(props.scope, "transactions")}
      aria-labelledby={tabId(props.scope, "transactions")}
      tabindex={0}
      class="flex flex-col gap-6"
      data-testid={TESTID.hledgerTransactions}
    >
      <Index each={props.transactions}>{(transaction) => <Transaction transaction={transaction()} />}</Index>
    </div>
  )
}

/** One transaction: its header, its postings, and its own comment and tags.
 *  The payee and the note are the header's two halves when the file wrote a
 *  `|`, and the note is drawn — the part a reader scans for is the merchant. */
function Transaction(props: { readonly transaction: HledgerTransaction }) {
  const one = () => props.transaction
  return (
    <article
      class="border-b border-rule pb-4"
      data-testid={TESTID.hledgerTxn}
      data-date={one().date}
      data-secondary={one().secondaryDate ?? ""}
      data-status={one().status}
      data-code={one().code ?? ""}
      data-description={one().description}
      data-payee={one().payee}
      data-note={one().note ?? ""}
    >
      <div class="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="font-mono text-label text-muted">
          {one().date}
          <Show when={one().secondaryDate}>
            {(second) => <>{`=${second()}`}</>}
          </Show>
        </span>
        <Show when={one().status === "unmarked" ? undefined : one().status}>
          {(status) => <span class="text-label text-muted">{status()}</span>}
        </Show>
        <Show when={one().code ?? undefined}>
          {(code) => <span class="font-mono text-label text-muted">({code()})</span>}
        </Show>
        <span class="text-body text-ink">{one().description}</span>
        <Show when={one().note ?? undefined}>
          {(note) => (
            <span class="text-label text-muted italic" data-testid={TESTID.hledgerTxnNote}>
              | {note()}
            </span>
          )}
        </Show>
      </div>
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        <Index each={one().postings}>{(posting) => <Posting posting={posting()} />}</Index>
      </ul>
      <Show when={one().comment ?? undefined}>
        {(comment) => (
          <span class="mt-1 block text-label text-muted italic" data-testid={TESTID.hledgerTxnComment}>
            {comment()}
          </span>
        )}
      </Show>
      <Show when={one().tags.length > 0}>
        <span class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <Index each={one().tags}>{(tag) => <Tag tag={tag()} />}</Index>
        </span>
      </Show>
    </article>
  )
}

/** One posting — the account, whatever it did to it, and whatever was written
 *  beside it. */
function Posting(props: { readonly posting: HledgerPosting }) {
  // One derivation, read twice (the `data-amount` fact and the amount drawn):
  // the format's own spelling of an amount is the one thing here the markup and
  // the attribute may not disagree about. A function rather than a value, so a
  // revision that changes the amount moves both.
  const amount = (): string =>
    props.posting.amount === null ? "" : hledgerAmountText(props.posting.amount)
  return (
    <li
      class="flex flex-wrap items-baseline gap-x-2 font-mono text-label"
      data-testid={TESTID.hledgerPosting}
      data-account={props.posting.account}
      data-amount={amount()}
      data-inferred={props.posting.inferred ? "true" : "false"}
    >
      <span class="text-ink">{props.posting.account}</span>
      {/* A virtual posting names its own bracket, so a reader can see which
          balance a transaction is asserting rather than which it is moving. */}
      <Show when={props.posting.virtual === "no" ? undefined : props.posting.virtual}>
        {(virtual) => (
          <span class="text-muted">{virtual() === "balanced" ? "balanced virtual" : "virtual"}</span>
        )}
      </Show>
      <Show when={amount()}>
        {(text) => <span class="ml-auto text-ink tabular-nums">{text()}</span>}
      </Show>
      {/* The omission the format filled in to balance the transaction — said,
          because a posting whose amount is on the page but not in the file is
          exactly the thing a reader would otherwise misread as theirs. */}
      <Show when={props.posting.inferred}>
        <span class="text-muted italic">inferred</span>
      </Show>
      <Show when={props.posting.comment ?? undefined}>
        {(comment) => (
          <span class="text-muted italic" data-testid={TESTID.hledgerPostingComment}>
            {comment()}
          </span>
        )}
      </Show>
      <Index each={props.posting.tags}>{(tag) => <Tag tag={tag()} />}</Index>
    </li>
  )
}

/** One tag, `key: value` — the shape a reader copies. Read inside the markup
 *  rather than into a local, because a live edit changes the value under a
 *  position `<Index>` keeps. */
function Tag(props: { readonly tag: HledgerTag }) {
  return (
    <span class="font-mono text-label text-muted" data-testid={TESTID.hledgerTag}>
      {props.tag.value === null ? props.tag.key : `${props.tag.key}: ${props.tag.value}`}
    </span>
  )
}

/**
 * Every account, as a tree.
 *
 * FLAT AND INDENTED rather than nested lists, and it is the indent that carries
 * the depth: the format hands back the account names and their rolled-up
 * balances (`@olai/format`'s `hledger.ts`), in TREE order — parents before
 * their children and children contiguous — so this draws one row per name, at
 * `depth` columns in, rather than reassembling a nesting the order already
 * states. `data-depth` says the same thing as the padding for a reader that is
 * not an eye — and it is DERIVED per row on every read, because an account
 * inserted above another moves the depth of everything below it.
 *
 * A ROW IS DRAWN EVEN WHEN ITS TOTAL IS EMPTY, because the account was NAMED in
 * the file and a reader browsing their chart of accounts wants to see it — a
 * parent with children nets to zero all the time, and the children below it are
 * its balance. The format's map simply has no entry to draw for it.
 */
export function BalancesPanel(props: {
  readonly scope: string
  readonly balances: HledgerBalances
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(props.scope, "balances")}
      aria-labelledby={tabId(props.scope, "balances")}
      tabindex={0}
      class="flex flex-col"
      data-testid={TESTID.hledgerBalances}
    >
      <Index each={props.balances.accounts}>
        {(account) => {
          const depth = (): number => account().split(":").length - 1
          return (
            <div
              class="flex flex-wrap items-baseline gap-x-4 border-b border-rule py-1"
              data-testid={TESTID.hledgerBalance}
              data-account={account()}
              data-depth={depth()}
            >
              <span
                class={depth() === 0 ? "text-body text-ink" : "text-label text-muted"}
                style={{ "padding-left": `${depth() * 1.25}rem` }}
                data-testid={TESTID.hledgerBalanceAccount}
              >
                {account().slice(account().lastIndexOf(":") + 1)}
              </span>
              <span class="ml-auto flex flex-wrap justify-end gap-x-4 font-mono text-label tabular-nums">
                <Index each={props.balances.of.get(account()) ?? []}>
                  {(amount) => (
                    <span data-testid={TESTID.hledgerBalanceAmount} data-commodity={amount().commodity}>
                      {hledgerAmountText(amount())}
                    </span>
                  )}
                </Index>
              </span>
            </div>
          )
        }}
      </Index>
    </div>
  )
}

/**
 * The file itself, as far as it was READ.
 *
 * ONE SPAN PER READ LINE, and that is two facts at once. The Raw view is the
 * bytes the page actually read — never a re-rendering of the parse — and the
 * bound is the reading's, so the DOM stops where {@link HledgerJournal.lines}
 * stops rather than laying out a hundred-megabyte file a reader is not looking
 * past (`../Hledger.tsx` argues the wire's own bound). And a line the reader
 * kept as raw text says WHICH KIND it is in `data-entry`
 * (`directive`/`comment`/`unknown`), which is the one thing typed about a line
 * that is not a transaction or a posting and the reason the format keeps those
 * entries at all — every line the entry SPANS carries it, not only the first,
 * because a directive's sub-lines are that directive.
 *
 * The two derivations are MEMOS: the line list is one slice of the body, and
 * the line → kind table is one walk of the entries. Read per rendered line
 * instead, the table would be rebuilt once per line — O(lines × entries) at the
 * bound, which is four hundred million operations for a page that draws twenty
 * thousand rows.
 */
export function RawPanel(props: {
  readonly scope: string
  readonly text: string
  readonly read: HledgerJournal
}) {
  const lines = createMemo((): ReadonlyArray<string> =>
    props.text.split("\n", props.read.lines + 1).slice(0, props.read.lines))
  const kinds = createMemo((): ReadonlyMap<number, string> => {
    const held = new Map<number, string>()
    for (const entry of props.read.entries) {
      const span = entry.text.split("\n").length
      for (let at = 0; at < span; at++) held.set(entry.line + at, entry.kind)
    }
    return held
  })
  return (
    <pre
      role="tabpanel"
      id={panelId(props.scope, "raw")}
      aria-labelledby={tabId(props.scope, "raw")}
      tabindex={0}
      class="m-0 overflow-x-auto whitespace-pre font-mono text-label"
      data-testid={TESTID.hledgerRaw}
    >
      <Index each={lines()}>
        {(line, at) => (
          <>
            <Show when={at > 0}>{"\n"}</Show>
            <span data-testid={TESTID.hledgerRawLine} data-line={at + 1} data-entry={kinds().get(at + 1)}>
              {line().slice(0, HLEDGER_CELL)}
            </span>
          </>
        )}
      </Index>
    </pre>
  )
}
