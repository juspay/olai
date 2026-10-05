/**
 * A served `.journal` (or `.hledger`/`.ledger`), drawn — the transactions in
 * file order, the account tree they net to, and the file's own bytes, behind
 * one strip of three views.
 *
 * VIEW ONLY, which is a decision and not a stage of one. A journal is
 * somebody's ledger — kept by a person or written by a tool — and what a person
 * opening one in their notes wants is to SEE it: what was spent, where it went,
 * and whether the file they are looking at is the one they meant. An editable
 * ledger is a different product, and half of one — lines you can type in that
 * write back through an op nobody has written — would be a page that looks like
 * it holds your changes. So there is no editor, no create verb, and
 * `markdown_write` refuses the file if anything asks (`@olai/ops`). That is the
 * registry's `edits: false` (../browser.tsx) rather than a `Show` in this file.
 *
 * IT ASKS FOR THE BODY, like `../Csv.tsx` next door and for its reason: a
 * journal is interpreted HERE — `../journal/read.ts`'s `readJournal` is what turns
 * the text into transactions — so the text has to arrive, and it arrives
 * through `vault.files.body`, read for whoever is holding it open and kept by
 * nobody (the vault's `server/bodies.ts`). One read of the disk, at the
 * revision the rest of the page is at, and a file rewritten under an open page
 * redraws it.
 *
 * WHICH VIEW IS SHOWING IS THIS PAGE'S OWN SIGNAL, not a preference and not a
 * route: switching the view is looking at the same file a different way, so it
 * does not deserve a history entry, and the page opening on Transactions every
 * time is the right default — that is the reading a journal is opened for.
 *
 * WHAT IS NOT BOUNDED, said rather than left to be discovered: the WIRE. The
 * whole file's text crosses the socket even though a fraction of it is read
 * here — that is what a `.md` body has always cost, this is the same member,
 * and paging it would be a second protocol for one kind of file. So the memory
 * a huge journal costs this tab is one string rather than one string plus every
 * field of every transaction of it, which is the difference the reading's bound
 * makes and the whole of what it can make from this side. The day somebody
 * keeps a hundred-megabyte journal in a vault it is the READ that has to learn
 * about ranges, for every bodied kind at once.
 */
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

/** The file, and nothing else — ../browser.tsx’s page props, spelled here rather
 *  than imported from the page contribution that imports this component. */
export function Hledger(props: { readonly file: string }) {
  // ONE ID FOR THIS PAGE, so two ledger pages mounted at once (a split pane, a
  // kept-alive tab) do not mint the same tab and panel ids.
  const scope = createUniqueId()
  // THE BODY, asked for by the face that draws from it — the rule ../browser.tsx
  // states: a face asks the wire for what it needs, so what a kind costs this
  // tab is a fact about that kind's own component.
  const [served, setServed] = createSignal<Body>()
  // WHICH VIEW, defaulting to the transactions a journal is opened to read.
  const [view, setView] = createSignal<View>("transactions")
  // THE BALANCES TREE'S OWN STATE, held HERE and not in the panel: a live
  // revision re-parses the file and redraws the panel, and a reader who had
  // collapsed an account expects it to stay collapsed — as long as the account
  // is still in the file.
  const [depth, setDepth] = createSignal<Depth>("2")
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())
  const toggleCollapsed = (account: string): void => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(account)) next.delete(account)
      else next.add(account)
      return next
    })
  }
  // HOW MANY TIMES the unreadable button has been pressed: the source panel
  // reads it and scrolls to the first line the reader could not make sense of.
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
  // ONE PARSE per body, not one per view drawn. A memo rather than a call in
  // the markup: the header, the sentence and all three panels read the same
  // journal, and a call each would be four walks of a file that can be
  // megabytes.
  const ledger = createMemo(() => {
    const entry = served()
    return entry !== undefined && !entry.refused && entry.text !== null ? readJournal(entry.text) : null
  })
  /** WHAT THIS PAGE IS NOT SHOWING, in one sentence or none — a bound said out
   *  loud, or the honest nothing for a file that is empty (./said.ts, which
   *  owns both moods and the words). */
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
            {/* AN EMPTY FILE IS THE EMPTY STATE, not tabs over three empty
                panels: there is nothing to read, so the page says so in the
                app's own empty-state voice and draws no strip at all. */}
            <Show
              when={read().transactions.length === 0 && read().entries.length === 0}
              fallback={
                <>
                  <TabStrip scope={scope} view={view()} onPick={setView} />
                  {/* One panel at a time, keyed on the view — the strip above
                      is the only thing that decides which. The source view
                      reads the FILE and not the parse, so it draws even when
                      the parse is empty but a body arrived. */}
                  <Show when={view() === "transactions"}>
                    <TransactionsPanel scope={scope} transactions={read().transactions} />
                  </Show>
                  <Show when={view() === "balances"}>
                    <BalancesPanel
                      scope={scope}
                      balances={read().balances}
                      depth={depth()}
                      onDepth={setDepth}
                      collapsed={collapsed()}
                      onToggle={toggleCollapsed}
                    />
                  </Show>
                  <Show when={view() === "source"}>
                    <SourcePanel scope={scope} text={served()?.text ?? ""} read={read()} reveal={reveal()} />
                  </Show>
                  {/* WHAT THIS PAGE IS NOT SHOWING, once, under whichever panel
                      is drawn — through the one component that owns what a mood
                      MEANS (`@olai/web/client/SaidLine.tsx`). Nothing at all
                      when the whole file is drawn, which is the ordinary page:
                      a line saying "showing all of it" under every panel is
                      noise that teaches a reader to skip the line that
                      matters. */}
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
