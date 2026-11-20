import { TESTID } from "olai-plugin-hledger/testids"
import { readJournal } from "../journal/index.ts"
import { createEffect, createSignal, onCleanup, createMemo, createUniqueId, Show } from "solid-js"

import { Empty } from "@olai/web/client/Empty.tsx"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"

import { BodyRefused } from "olai-plugin-markdown/body-refused"
import { Effect } from "effect"
import type { Body } from "olai-plugin-vault/surface"
import { servedDirectory } from "./vault.ts"
import { hledgerSaid } from "./said.ts"
import {
  BalancesPanel,
  type Depth,
  LedgerHeader,
  SourcePanel,
  TabStrip,
  TransactionsPanel,
  type View,
} from "./views.tsx"

export function Hledger(props: { readonly file: string }) {
  const scope = createUniqueId()
  const [served, setServed] = createSignal<Body>()
  const [view, setView] = createSignal<View>("transactions")
  const [depth, setDepth] = createSignal<Depth>("2")
  const [closed, setClosed] = createSignal<ReadonlySet<string>>(new Set())
  const [opened, setOpened] = createSignal<ReadonlySet<string>>(new Set())
  const toggleFold = (account: string, expanded: boolean): void => {
    const change = (held: ReadonlySet<string>, add: boolean): ReadonlySet<string> => {
      const next = new Set(held)
      if (add) next.add(account)
      else next.delete(account)
      return next
    }
    setClosed((previous) => change(previous, expanded))
    setOpened((previous) => change(previous, !expanded))
  }
  const pickDepth = (next: Depth): void => {
    if (next === depth()) return
    setDepth(next)
    setOpened(new Set<string>())
  }
  const [reveal, setReveal] = createSignal(0)
  const showUnreadable = (): void => {
    setView("source")
    setReveal((count) => count + 1)
  }
  createEffect(() => {
    const directory = servedDirectory()
    const file = props.file
    const revision = directory?.head(() => file)()
    if (directory === undefined || revision === undefined) { setServed(undefined); return }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void Effect.runPromise(directory.body(file), { signal: controller.signal }).then(
      body => { if (!controller.signal.aborted) setServed(body) },
      () => { if (!controller.signal.aborted) setServed({ text: null, refused: true }) },
    )
  })
  const ledger = createMemo(() => {
    const entry = served()
    return entry !== undefined && !entry.refused && entry.text !== null ? readJournal(entry.text) : null
  })
  const said = () => {
    const read = ledger()
    return read === null ? null : hledgerSaid(read)
  }

  return (
    <>
      <Show when={served()?.refused}>
        <BodyRefused />
      </Show>
      <Show when={ledger()}>
        {(read) => (
          <>
            <LedgerHeader ledger={read()} onUnreadable={showUnreadable} />
            <Show
              when={read().transactions.length === 0 && read().entries.length === 0}
              fallback={
                <>
                  <TabStrip scope={scope} view={view()} onPick={setView} />
                  <Show when={view() === "transactions"}>
                    <TransactionsPanel scope={scope} transactions={read().transactions} />
                  </Show>
                  <Show when={view() === "balances"}>
                    <BalancesPanel
                      scope={scope}
                      balances={read().balances}
                      depth={depth()}
                      onDepth={pickDepth}
                      closed={closed()}
                      opened={opened()}
                      onToggle={toggleFold}
                    />
                  </Show>
                  <Show when={view() === "source"}>
                    <SourcePanel scope={scope} text={served()?.text ?? ""} read={read()} reveal={reveal()} />
                  </Show>
                  <Show when={said()}>
                    {(one) => (
                      <SaidLine
                        said={one()}
                        class="mt-4 mb-0 text-body"
                        testid={TESTID.hledgerSaid}
                      />
                    )}
                  </Show>
                </>
              }
            >
              <Empty testid={TESTID.hledgerEmpty} line="No transactions yet" />
            </Show>
          </>
        )}
      </Show>
    </>
  )
}
