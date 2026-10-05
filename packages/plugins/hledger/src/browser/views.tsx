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
 * THE TAB STRIP IS NOT `@olai/ui-primitives`' `Segmented`, and that is the one
 * place this file departs from the client's habits. `Segmented` is a settings
 * control: it carries `aria-pressed` and the preference testids, and it means
 * "which of these is chosen". A page's view strip is a TABS pattern —
 * `role="tablist"`/`role="tab"` with `aria-selected` — and a screen reader is
 * told which panel is showing, not which preference is set. The two are both
 * strips of buttons and nothing else about them is the same, so the shared
 * component is not shared here.
 *
 * EVERY ROW THAT REPEATS CARRIES ITS IDENTITY IN `data-*`, not only in its
 * text: `data-account`, `data-amount`, `data-status`, `data-commodity` and the
 * rest are facts a scenario reads without scraping a sentence the markup is
 * free to change. What the row SAYS is still drawn — this is a page for a
 * person first — but a test that asked "is this posting in assets:cash, and is
 * it inferred" gets an answer that does not move when a class or a wording
 * does.
 */
import { For, Show } from "solid-js"

import {
  hledgerAmountText,
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

/**
 * WHAT THE FILE HOLDS, in one line — the count of transactions, the count of
 * accounts, and the days the transactions span.
 *
 * The DATE RANGE is read from the transactions that have a readable date and
 * not from the raw header text: a header whose date did not parse is a fact
 * this line cannot use, and `dateWritten` would put an unparseable string where
 * a reader expects a day. A file with no readable dates simply omits the third
 * fact rather than inventing one — three facts is the shape of an ordinary
 * journal, not a promise to make one up.
 */
export const headerLine = (ledger: HledgerJournal): string => {
  const facts: Array<string> = [
    `${ledger.transactions.length} transactions`,
    `${ledger.balances.accounts.length} accounts`,
  ]
  const range = dateRange(ledger.transactions)
  if (range !== null) facts.push(range)
  return facts.join(" · ")
}

/** The span of a journal's readable dates, `2026-01-05–2026-03-31`, or nothing
 *  when no transaction carried one. `YYYY-MM-DD` sorts as text, which is what
 *  makes the two comparisons below a min and a max. */
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

/** The page's view strip. A tab is selected, not pressed — see this file's
 *  header for why it is drawn here rather than borrowed. */
export function TabStrip(props: {
  readonly view: View
  readonly onPick: (view: View) => void
}) {
  return (
    <div class="mb-5 flex gap-1 border-b border-rule" role="tablist">
      <For each={VIEWS}>
        {(choice) => (
          <button
            type="button"
            role="tab"
            // A border under the selected tab rather than a fill: the strip
            // shares one baseline with the page below it, and a filled chip in
            // a list of three reads as a filter rather than a view.
            class={`-mb-px border-b-2 px-3 py-1.5 text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              props.view === choice.value
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
            data-testid={TESTID.hledgerTab}
            data-view={choice.value}
            // Spelled both ways round, like the client's other strips: a
            // framework that drops a false boolean announces nothing at all.
            aria-selected={props.view === choice.value ? "true" : "false"}
            onClick={() => props.onPick(choice.value)}
          >
            {choice.label}
          </button>
        )}
      </For>
    </div>
  )
}

/** Every transaction, in file order — the journal's main reading. */
export function TransactionsPanel(props: {
  readonly transactions: ReadonlyArray<HledgerTransaction>
}) {
  return (
    <div class="flex flex-col gap-6" data-testid={TESTID.hledgerTransactions}>
      <For each={props.transactions}>{(transaction) => <Transaction transaction={transaction} />}</For>
    </div>
  )
}

/** One transaction: its header, its postings, and its own comment and tags. */
function Transaction(props: { readonly transaction: HledgerTransaction }) {
  return (
    <article
      class="border-b border-rule pb-4"
      data-testid="hledger-txn"
      data-date={props.transaction.date}
      data-status={props.transaction.status}
      data-code={props.transaction.code ?? ""}
      data-description={props.transaction.description}
    >
      <div class="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="font-mono text-label text-muted">{props.transaction.date}</span>
        <Show when={props.transaction.status === "unmarked" ? undefined : props.transaction.status}>
          {(status) => <span class="text-label text-muted">{status()}</span>}
        </Show>
        <Show when={props.transaction.code ?? undefined}>
          {(code) => <span class="font-mono text-label text-muted">({code()})</span>}
        </Show>
        <span class="text-body text-ink">{props.transaction.description}</span>
      </div>
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        <For each={props.transaction.postings}>{(posting) => <Posting posting={posting} />}</For>
      </ul>
      <Show when={props.transaction.comment ?? undefined}>
        {(comment) => (
          <span class="mt-1 block text-label text-muted italic" data-testid="hledger-txn-comment">
            {comment()}
          </span>
        )}
      </Show>
      <Show when={props.transaction.tags.length > 0}>
        <span class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <For each={props.transaction.tags}>{(tag) => <Tag tag={tag} />}</For>
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
  // the attribute may not disagree about.
  const amount = (): string =>
    props.posting.amount === null ? "" : hledgerAmountText(props.posting.amount)
  return (
    <li
      class="flex flex-wrap items-baseline gap-x-2 font-mono text-label"
      data-testid="hledger-posting"
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
        {(comment) => <span class="text-muted italic">{comment()}</span>}
      </Show>
    </li>
  )
}

/** One tag written under a transaction's header. */
function Tag(props: { readonly tag: HledgerTag }) {
  const value = props.tag.value
  return (
    <span class="font-mono text-label text-muted" data-testid="hledger-tag">
      {value === null ? props.tag.key : `${props.tag.key}: ${value}`}
    </span>
  )
}

/**
 * Every account, as a tree.
 *
 * FLAT AND INDENTED rather than nested lists, and it is the indent that carries
 * the depth: the format hands back the account names and their rolled-up
 * balances (`@olai/format`'s `hledger.ts`), and it hands them in flat tree
 * order — parents before their children — so this draws one row per name, at
 * `depth` columns in, rather than reassembling a nesting that is already a fact
 * of the order. `data-depth` says the same thing as the padding for a reader
 * that is not an eye.
 *
 * A ROW IS DRAWN EVEN WHEN ITS TOTAL IS EMPTY, because the account was NAMED in
 * the file and a reader browsing their chart of accounts wants to see it — a
 * parent with children nets to zero all the time, and the children below it are
 * its balance. The format's map simply has no entry to draw for it.
 */
export function BalancesPanel(props: { readonly balances: HledgerBalances }) {
  return (
    <div class="flex flex-col" data-testid={TESTID.hledgerBalances}>
      <For each={props.balances.accounts}>
        {(account) => {
          const depth = account.split(":").length - 1
          return (
            <div
              class="flex flex-wrap items-baseline gap-x-4 border-b border-rule py-1"
              data-testid="hledger-balance"
              data-account={account}
              data-depth={depth}
            >
              <span
                class={depth === 0 ? "text-body text-ink" : "text-label text-muted"}
                style={{ "padding-left": `${depth * 1.25}rem` }}
                data-testid="hledger-balance-account"
              >
                {account.slice(account.lastIndexOf(":") + 1)}
              </span>
              <span class="ml-auto flex flex-wrap justify-end gap-x-4 font-mono text-label tabular-nums">
                <For each={props.balances.of.get(account) ?? []}>
                  {(amount) => (
                    <span data-testid="hledger-balance-amount" data-commodity={amount.commodity}>
                      {hledgerAmountText(amount)}
                    </span>
                  )}
                </For>
              </span>
            </div>
          )
        }}
      </For>
    </div>
  )
}

/**
 * The file itself, verbatim.
 *
 * No highlighting and no parsing: this view exists so that a reader who wants
 * to know exactly what the format made of their journal can read the bytes it
 * read. Anything drawn here that was not in the file would defeat it, which is
 * why it takes the SOURCE and not the parse.
 */
export function RawPanel(props: { readonly text: string }) {
  return (
    <pre
      class="m-0 overflow-x-auto whitespace-pre font-mono text-label"
      data-testid={TESTID.hledgerRaw}
    >
      {props.text}
    </pre>
  )
}
