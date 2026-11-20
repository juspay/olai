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
import { Tip } from "@olai/web/client/Tip.tsx"
import { SEGMENT, SEGMENT_IN_FORCE, SEGMENT_STRIP } from "@olai/ui-primitives/Segmented.tsx"

import { amountDigits, amountParts, amountText } from "./spell.ts"

export type View = "transactions" | "balances" | "source"

const VIEWS: ReadonlyArray<{ readonly value: View; readonly label: string }> = [
  { value: "transactions", label: "Transactions" },
  { value: "balances", label: "Balances" },
  { value: "source", label: "Source" },
]

export type Depth = "1" | "2" | "3" | "all"

const DEPTHS: ReadonlyArray<{ readonly value: Depth; readonly label: string }> = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "all", label: "All" },
]

const tabId = (scope: string, view: View): string => `${scope}-tab-${view}`
const panelId = (scope: string, view: View): string => `${scope}-panel-${view}`

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

const humanDay = (iso: string): string => {
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  return `${MONTHS[month - 1] ?? ""} ${day}`
}

const shortDay = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(8, 10)}`

const dayOfMonth = (iso: string): string => iso.slice(8, 10)

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

const commoditiesOf = (ledger: Journal): ReadonlyArray<string> => {
  const held = new Set<string>()
  for (const transaction of ledger.transactions) {
    for (const posting of transaction.postings) {
      if (posting.amount !== null) held.add(posting.amount.commodity)
    }
  }
  return [...held].sort()
}

interface Fact {
  readonly kind: "dates" | "transactions" | "accounts" | "commodities"
  readonly text: string
}

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
          <span
            class={`whitespace-nowrap ${
              at < facts().length - 1 || unreadable() > 0 ? "after:ml-2 after:content-['·']" : ""
            }`}
            data-testid={TESTID.hledgerFact}
            data-fact={fact().kind}
          >
            {fact().text}
          </span>
        )}
      </Index>
      <Show when={unreadable() > 0}>
        <button
          type="button"
          class="inline-flex min-h-8 cursor-pointer items-center rounded-control border border-alarm/40 bg-alarm/10 px-2 py-0.5 text-label text-alarm hover:bg-alarm/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-alarm md:min-h-0"
          data-testid={TESTID.hledgerUnreadable}
          onClick={() => props.onUnreadable()}
        >
          {`\u26a0 ${counted(unreadable(), "line", "lines")} not read`}
        </button>
      </Show>
    </header>
  )
}

export function TabStrip(props: {
  readonly scope: string
  readonly view: View
  readonly onPick: (view: View) => void
}) {
  let strip: HTMLDivElement | undefined
  const go = (view: View | undefined): void => {
    if (view === undefined) return
    props.onPick(view)
    strip?.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.focus()
  }
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
            tabindex={props.view === choice().value ? 0 : -1}
            class={`olai-tab -mb-px border-b-2 px-3 py-1.5 text-label transition-colors ${
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

function TransactionHead(props: { readonly transaction: Transaction }) {
  const one = () => props.transaction
  return (
    <div class="col-span-full grid grid-cols-subgrid items-baseline py-0.5">
      <Tip text={one().date}>
        <span class="hidden font-mono text-label text-muted md:block" data-testid={TESTID.hledgerDate}>
          {shortDay(one().date)}
          <Show when={one().secondaryDate}>{(second) => <>{` =`}{shortDay(second())}</>}</Show>
        </span>
        <span class="sr-only hidden md:block">{one().date}</span>
      </Tip>
      <span class="col-span-full flex min-w-0 items-baseline gap-1.5 md:col-span-1">
        <Tip text={one().date}>
          <span class="font-mono text-caption text-muted md:hidden" data-testid={TESTID.hledgerDay}>{dayOfMonth(one().date)}</span>
          <span class="sr-only md:hidden">{one().date}</span>
        </Tip>
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
      <span class="col-span-full flex flex-wrap justify-end gap-x-2 md:col-span-2">
        <Index each={one().tags}>{(tag) => <TagPill tag={tag()} />}</Index>
      </span>
      <span class="hidden md:block" />
    </div>
  )
}

function TransactionRow(props: { readonly transaction: Transaction }) {
  const one = () => props.transaction
  return (
    <div
      class="col-span-full mt-3 grid grid-cols-subgrid items-baseline hover:bg-rule/30 md:mt-0"
      data-testid={TESTID.hledgerTxn}
      data-date={one().date}
      data-status={one().status}
      data-code={one().code ?? ""}
      data-description={one().description}
      data-payee={one().payee}
      data-note={one().note ?? ""}
    >
      <TransactionHead transaction={one()} />
      <Show when={one().prose}>
        {(prose) => (
          <div class="col-span-full pl-1 text-label italic text-muted" data-testid={TESTID.hledgerTxnComment}>{prose()}</div>
        )}
      </Show>
      <Index each={one().postings}>{(posting) => <PostingRow posting={posting()} />}</Index>
    </div>
  )
}

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
        props.status === "cleared"
          ? "olai-tone-dot bg-done"
          : props.status === "pending"
            ? "olai-tone-dot-quiet bg-doing"
            : "border border-muted"
      }`}
    />
  )
}

function PostingRow(props: { readonly posting: Posting }) {
  const amount = (): string => (props.posting.amount === null ? "" : amountText(props.posting.amount))
  const hasTail = (): boolean =>
    props.posting.cost !== null ||
    props.posting.assertion !== null ||
    (props.posting.amount !== null && amountParts(props.posting.amount).suffix !== "")
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
      <span class="flex min-w-0 items-baseline gap-1.5" data-testid={TESTID.hledgerAccount}>
        <AccountName account={props.posting.account} virtual={props.posting.virtual} />
        <Show when={props.posting.prose}>
          {(prose) => (
            <span class="truncate text-label italic text-muted" data-testid={TESTID.hledgerPostingComment}>{prose()}</span>
          )}
        </Show>
        <Index each={props.posting.tags}>{(tag) => <TagPill tag={tag()} />}</Index>
      </span>
      <span class="flex items-baseline justify-end gap-1.5 text-right font-mono text-label tabular-nums" data-testid={TESTID.hledgerAmount}>
        <Show when={props.posting.amount}>{(held) => <AmountNumber amount={held()} muted={props.posting.inferred} />}</Show>
        <Show when={props.posting.inferred}>
          <Tip text="inferred">
            <span
              class="leading-none text-muted md:hidden"
              data-testid={TESTID.hledgerInferred}
              aria-hidden="true"
            >
              ◌
            </span>
            <span class="sr-only md:hidden">inferred</span>
          </Tip>
        </Show>
      </span>
      <span
        class={`flex items-baseline gap-1.5 text-left font-mono text-label tabular-nums ${hasTail() ? "pl-1.5" : ""}`}
        data-testid={TESTID.hledgerAmountTail}
      >
        <Show when={props.posting.amount}>{(held) => <AmountSuffix amount={held()} muted={props.posting.inferred} />}</Show>
        <span class="hidden items-baseline gap-1.5 md:flex">
          <Annotations posting={props.posting} />
        </span>
      </span>
      <span class="hidden justify-center self-center md:flex">
        <Show when={props.posting.inferred}>
          <Tip text="inferred" say>
            <span class="leading-none text-muted" data-testid={TESTID.hledgerInferred} aria-hidden="true">◌</span>
          </Tip>
        </Show>
      </span>
      <span class="col-span-full flex items-baseline justify-end gap-1.5 font-mono text-label tabular-nums md:hidden">
        <Annotations posting={props.posting} />
      </span>
    </div>
  )
}

function Annotations(props: { readonly posting: Posting }) {
  return (
    <>
      <Show when={props.posting.cost}>
        {(cost) => <Tip text="cost annotation" say>
          <span class="truncate text-muted" data-testid={TESTID.hledgerCost}>{cost()}</span>
        </Tip>}
      </Show>
      <Show when={props.posting.assertion}>
        {(claim) => <Tip text="balance assertion" say>
          <span class="truncate text-muted" data-testid={TESTID.hledgerAssertion}>{claim()}</span>
        </Tip>}
      </Show>
    </>
  )
}

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

function AmountNumber(props: { readonly amount: Amount; readonly muted: boolean }) {
  const parts = () => amountParts(props.amount)
  const ink = () => (props.muted ? "text-muted" : "text-ink")
  return (
    <span class={`whitespace-nowrap ${ink()}`}>{`${parts().prefix}${parts().number}`}</span>
  )
}

function AmountSuffix(props: { readonly amount: Amount; readonly muted: boolean }) {
  const parts = () => amountParts(props.amount)
  return (
    <Show when={parts().suffix}>
      {(suffix) => <span class={`whitespace-nowrap ${props.muted ? "text-muted" : "text-ink"}`}>{suffix()}</span>}
    </Show>
  )
}

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

function MonthBand(props: { readonly month: string; readonly count: number }) {
  const label = (): string => {
    const year = props.month.slice(0, 4)
    const month = Number(props.month.slice(5, 7))
    return `${MONTH_NAMES[month - 1] ?? ""} ${year}`
  }
  return (
    <div
      class={`col-span-full sticky top-[calc(var(--height-chrome)+2.125rem)] ${LAYER.row} flex items-baseline justify-between gap-4 border-b border-rule bg-paper py-1 text-caption uppercase tracking-wide text-muted`}
      data-testid={TESTID.hledgerMonth}
      data-month={props.month}
    >
      <span>{label()}</span>
      <span>{counted(props.count, "transaction", "transactions")}</span>
    </div>
  )
}

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
      class="grid grid-cols-[minmax(0,1fr)_max-content_max-content] gap-x-3 md:grid-cols-[5.5rem_minmax(0,1fr)_max-content_max-content_1rem] md:gap-x-0"
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

function DepthControl(props: { readonly value: Depth; readonly onPick: (depth: Depth) => void }) {
  return (
    <div class={SEGMENT_STRIP} data-testid={TESTID.hledgerDepth}>
      <Index each={DEPTHS}>
        {(choice) => (
          <button
            type="button"
            class={`${SEGMENT} ${
              props.value === choice().value ? SEGMENT_IN_FORCE : "text-muted hover:text-ink"
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

function DepthGuides(props: { readonly depth: number }) {
  return (
    <Index each={Array.from({ length: props.depth }, (_, at) => at)}>
      {() => <span aria-hidden="true" class="mr-1.5 inline-block h-4 w-px shrink-0 self-center border-l border-rule" />}
    </Index>
  )
}

export function BalancesPanel(props: {
  readonly scope: string
  readonly balances: Balances
  readonly depth: Depth
  readonly onDepth: (depth: Depth) => void
  readonly closed: ReadonlySet<string>
  readonly opened: ReadonlySet<string>
  readonly onToggle: (account: string, expanded: boolean) => void
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
  const expanded = (account: string): boolean => {
    if (props.closed.has(account)) return false
    if (props.opened.has(account)) return true
    const limit = props.depth === "all" ? Infinity : Number(props.depth)
    return account.split(":").length < limit
  }
  const rows = createMemo((): ReadonlyArray<string> => {
    const out: Array<string> = []
    const stack: Array<{ readonly depth: number; readonly expanded: boolean }> = []
    for (const account of props.balances.accounts) {
      const depth = account.split(":").length - 1
      let top = stack[stack.length - 1]
      while (top !== undefined && top.depth >= depth) {
        stack.pop()
        top = stack[stack.length - 1]
      }
      if (!stack.some((entry) => !entry.expanded)) out.push(account)
      stack.push({ depth, expanded: expanded(account) })
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
              const isExpanded = (): boolean => expanded(account())
              return (
                <div
                  class={`col-span-full grid grid-cols-subgrid border-b border-rule py-0.5 ${
                    depth() === 0 ? "bg-rule/20 text-ink" : "text-body text-ink"
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
                        class="inline-flex w-4 shrink-0 cursor-pointer justify-center text-muted hover:text-ink"
                        aria-expanded={isExpanded() ? "true" : "false"}
                        aria-label={isExpanded() ? `Collapse ${account()}` : `Expand ${account()}`}
                        data-testid={TESTID.hledgerBalanceToggle}
                        onClick={() => props.onToggle(account(), isExpanded())}
                      >
                        {isExpanded() ? "▾" : "▸"}
                      </button>
                    </Show>
                    <span
                      class={`truncate text-ink ${depth() === 0 ? "font-semibold" : ""}`}
                      data-testid={TESTID.hledgerBalanceAccount}
                    >
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
                                  {amountDigits(amount())}
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
      <div class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper md:hidden" aria-hidden="true" />
    </div>
  )
}

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
      <div class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper md:hidden" aria-hidden="true" />
    </div>
  )
}
