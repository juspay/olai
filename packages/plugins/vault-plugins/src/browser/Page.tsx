import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { PLUGIN_BROWSER_FILE, PLUGIN_README_FILE, PLUGIN_SERVER_FILE } from "@olai/surface"
import type { BrowserManagement } from "@olai/surface/management"
import { LAYER } from "@olai/web/client/layer.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { run } from "@olai/web/client/run.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { type AgentItem, itemKey, proseIn } from "@olai/format"
import type { BesideDoor } from "olai-plugin-chat/beside"
import { Control } from "olai-plugin-plugin-inspector/control"
import { useHere } from "olai-plugin-navigation/routing"
import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { client } from "../client.ts"
import { beside, engines, router } from "./doors.ts"
import { readmeItem } from "../index.ts"
import { changedCount, diffLines } from "./diff.ts"
import { Code } from "./page/Code.tsx"
import { Verbs, type Acts } from "./page/Verbs.tsx"
import { faultSaid, LOOK, metaOf, pluginNamed, stageOf, TRUST_SAID, wakes, type Defined } from "./state.ts"

export function PluginPage(props: {
  readonly word: string
  readonly file?: string
  readonly management: BrowserManagement
}) {
  const roster = props.management.roster()
  const plugin = createMemo(() => pluginNamed(roster(), props.word))
  return (
    <main class={`mx-auto w-full max-w-3xl px-4 py-6 ${CLEARANCE}`}>
      <Show when={plugin()} fallback={<Missing word={props.word} />}>
        {(found) => (
          <Key each={[props.word]} by={(word) => word}>
            {() => <Known plugin={found()} file={props.file} management={props.management} />}
          </Key>
        )}
      </Show>
    </main>
  )
}

function Missing(props: { readonly word: string }) {
  return (
    <section data-testid={TESTID.pageMissing} data-plugin={props.word}>
      <h1 class="m-0 text-title">No plugin called {props.word}</h1>
      <p class="mt-2 text-body text-muted">
        This vault has no <code class="font-mono">plugins/{props.word}/</code> folder. It may have been deleted, or
        the link may come from another vault. Ask for a new one with <b>New plugin</b> in the command palette.
      </p>
    </section>
  )
}

function Known(props: { readonly plugin: Defined; readonly file?: string; readonly management: BrowserManagement }) {
  const source = () => props.plugin.source
  const here = useHere()
  const [read, setRead] = createSignal(false)
  const stage = () => stageOf(props.plugin, read())
  const [busy, setBusy] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  const [said, setSaid] = createSignal<string>()
  const [removing, setRemoving] = createSignal(false)
  const [shown, setShown] = createSignal(props.plugin.source.version)
  const readme = (): AgentItem => readmeItem(props.plugin.name)
  const open = () => (source().chat === true ? beside() : undefined)
  const watching = () => stage() === "building" || wakes(stage())
  const call = <T,>(effect: Parameters<typeof run<T>>[0], after?: (answer: T) => void) => {
    setBusy(true)
    setRefused(undefined)
    run<T>(effect, (failure) => { setBusy(false); setRefused(failure.message) }, (answer) => { setBusy(false); after?.(answer) })
  }
  const acts: Acts = {
    busy,
    approve: () => call(client().procedures.plugins.approve({ name: props.plugin.name, version: shown(), forever: false })),
    trust: (trusting) => call(client().procedures.plugins.trust({ name: props.plugin.name, version: shown(), trusting })),
    setOn: (on) => call(props.management.set(props.plugin.name, on)),
    remove: () => call(client().procedures.plugins.remove({ name: props.plugin.name }), () => setRemoving(false)),
    confirmRemove: () => setRemoving(true),
    askFix: () => call(client().procedures.plugins.ask({ name: props.plugin.name, said: "" }), (answer) => {
      if (!answer.sent) { setSaid("There was no agent to take it. The conversation that built it is in Chats."); return }
      setSaid("Sent to the conversation that built it.")
      open()?.open({ item: readme(), from: here() })
    }),
    askChange: () => open()?.open({ item: readme(), from: here() }),
    canAsk: () => source().chat === true && source().asking === true,
    canOpen: () => open() !== undefined,
    trusting: () => source().trusting === true,
    moved: () => shown() !== source().version,
    reread: () => setShown(source().version),
  }
  return (
    <section data-testid={TESTID.page} data-plugin={props.plugin.name} data-stage={stage()}>
      <Show when={watching() && open()}>{(door) => <Beside door={door()} item={readme()} from={here} />}</Show>
      <header class="flex items-start gap-3">
        <div class="mt-1 flex size-9 shrink-0 items-center justify-center rounded-control bg-pill text-muted" aria-hidden="true">
          <svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
            <path d="M8 2.5v11" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="m-0 text-title">{source().title}</h1>
          <Show when={source().description !== ""}>
            <p class="mt-1 text-body text-muted">{source().description}</p>
          </Show>
          <p class="mt-2 flex flex-wrap items-center gap-2 text-label" data-testid={TESTID.pageState} data-stage={stage()}>
            <span class={`${DOT} ${LOOK[stage()].dot}`} aria-hidden="true" />
            <b class={LOOK[stage()].tone ?? ""}>{LOOK[stage()].word}</b>
            <Show when={metaOf(props.plugin, stage()) !== ""}>
              <span class="text-muted">· {metaOf(props.plugin, stage())}</span>
            </Show>
          </p>
        </div>
        <div class="hidden md:block">
          <Verbs plugin={props.plugin} stage={stage()} acts={acts} />
        </div>
      </header>

      <Show when={refused()}>
        {(why) => <p class="mt-3 rounded-control bg-alarm/10 px-3 py-2 text-label text-alarm" data-testid={TESTID.pageRefused}>{why()}</p>}
      </Show>
      <Show when={said()}>
        {(line) => <p class="mt-3 rounded-control bg-pill px-3 py-2 text-label text-muted" data-testid={TESTID.pageAskSaid}>{line()}</p>}
      </Show>

      <Show when={removing()}>
        <Banner tone="red" testid={TESTID.pageDelete + "-asking"}>
          <b>Delete {source().title}?</b> Its folder <code class="font-mono">{source().folder}</code> and the
          decision you made about it both go. The conversation that built it stays in Chats.
          <span class="ml-2 inline-flex gap-2">
            <button type="button" class="cursor-pointer rounded-control border-0 bg-alarm px-2 py-1 text-paper"
              data-testid={TESTID.pageDeleteConfirm} disabled={busy()} onClick={() => acts.remove()}>Delete</button>
            <button type="button" class="cursor-pointer rounded-control border border-line bg-transparent px-2 py-1"
              data-testid={TESTID.pageDeleteKeep} disabled={busy()} onClick={() => setRemoving(false)}>Keep it</button>
          </span>
        </Banner>
      </Show>

      <Show when={stage() === "paused"}>
        <Banner tone="amber" testid={TESTID.pageBanner}>
          <b>{changedSaid(props.plugin)}</b> Nothing new runs until you say so. It is off meanwhile.
        </Banner>
      </Show>
      <Show when={stage() === "broken"}>
        <Banner tone="red" testid={TESTID.pageBanner}>
          {faultSaid(props.plugin) ?? "It could not start, and gave no message."}
        </Banner>
      </Show>

      <Show when={source().readme !== undefined && stage() !== "paused"}>
        <Block heading="What it does">
          <div data-testid={TESTID.pageReadme}>
            <Markdown claims={undefined} from={`${source().folder}${PLUGIN_README_FILE}`} source={proseIn(source().readme ?? "")} class="olai-md" />
          </div>
        </Block>
      </Show>

      <Show when={stage() === "building"}>
        <Block heading="The code" note={source().folder}>
          <Landing source={source()} />
          <button
            type="button"
            class="mt-3 cursor-pointer rounded-control border border-line bg-transparent px-2 py-1 text-label text-muted hover:text-ink"
            data-testid={TESTID.pageReadAnyway}
            onClick={() => setRead(true)}
          >I'll read it now</button>
        </Block>
      </Show>

      <Show when={stage() === "on"}>
        <Show when={(props.plugin.configurationValues ?? []).length > 0}>
          <Block heading="Settings" note="Saved in Settings.olai, for everyone using this directory">
            <div class="flex flex-wrap gap-4">
              <Key each={props.plugin.configurationValues ?? []} by="key">
                {(value) => (
                  <div data-testid={TESTID.pageKnob} data-key={value().key}>
                    <Control name={props.plugin.name} value={value()} configure={props.management.configure} />
                  </div>
                )}
              </Key>
            </div>
          </Block>
        </Show>
      </Show>

      <Ask item={readme()} name={source().title} chat={source().chat === true} />

      <Show when={(source().uses ?? []).length > 0}>
        <Block heading="What it uses" note={stage() === "paused" ? "unchanged" : undefined}>
          <ul class="m-0 flex list-none flex-col gap-1 p-0 text-label" data-testid={TESTID.pageUses}>
            <For each={source().uses ?? []}>
              {(use) => (
                <li class="flex flex-wrap items-baseline gap-2">
                  <span class="text-ink">{use.said}</span>
                  <code class="rounded-control bg-pill px-1 font-mono text-caption text-muted">{use.named}</code>
                </li>
              )}
            </For>
          </ul>
          <p class="mt-2 text-label text-muted" data-testid={TESTID.pageTrustSaid}>
            Read from the code's own imports. {TRUST_SAID}
          </p>
        </Block>
      </Show>

      <Show when={stage() !== "building"}>
        <Block
          heading={stage() === "paused" ? "What changed" : "The code"}
          note={stage() === "paused" ? "since the version you turned on" : "Read it, or don't. It is all here."}
        >
          <Code source={source()} at={props.file} diffing={stage() === "paused"} />
        </Block>
      </Show>

      <div
        class={`sticky bottom-0 ${LAYER.row} -mx-4 mt-8 flex flex-col gap-1 border-t border-line/60 bg-panel px-4 pt-3 ${CLEARANCE} md:hidden`}
        data-testid={TESTID.pageFoot}
      >
        <Verbs plugin={props.plugin} stage={stage()} acts={acts} foot />
        <p class="m-0 text-caption text-muted" data-testid={TESTID.pageTrustSaid}>{TRUST_SAID}</p>
      </div>
    </section>
  )
}

function Beside(props: { readonly door: BesideDoor; readonly item: AgentItem; readonly from: () => number }) {
  createEffect<string | undefined>((before) => {
    const key = itemKey(props.item)
    if (before === key) return before
    const here = props.from()
    props.door.open({ item: props.item, from: here })
    router()?.focus(here)
    return key
  })
  return null
}

function Ask(props: { readonly item: AgentItem; readonly name: string; readonly chat: boolean }) {
  const here = useHere()
  const offered = () => beside() === undefined ? undefined
    : props.chat || (engines()?.installed() ?? []).length > 0 ? beside() : undefined
  return (
    <Show when={offered()}>{(door) =>
      <section class="mt-6" data-testid={TESTID.pageAsk}>
        <button
          type="button"
          class="flex w-full cursor-pointer items-baseline gap-2 rounded-control border border-line/60 bg-transparent px-3 py-2 text-left text-body hover:bg-ink/5"
          data-testid={TESTID.pageAskChange}
          onClick={() => door().open({ item: props.item, from: here() })}
        >
          <span>{props.chat ? "Ask for a change…" : `Ask about ${props.name}…`}</span>
          <span class="text-label text-muted">
            {props.chat ? "opens the conversation that built it beside this page" : "opens a chat about this plugin beside this page"}
          </span>
        </button>
      </section>
    }</Show>
  )
}

function Landing(props: { readonly source: Defined["source"] }) {
  const rows = () => [
    { file: PLUGIN_README_FILE, there: props.source.readme !== undefined, said: "what it does, for people" },
    { file: PLUGIN_SERVER_FILE, there: props.source.server.trim() !== "", said: "what runs on the server" },
    { file: PLUGIN_BROWSER_FILE, there: props.source.browser !== undefined, said: "what draws in the page — optional" },
  ]
  return (
    <ul class="m-0 flex list-none flex-col gap-1 p-0 font-mono text-label">
      <For each={rows()}>
        {(row) => (
          <li class="flex items-baseline gap-2" data-file={row.file} data-written={row.there ? "yes" : "no"}>
            <span class={row.there ? "text-done" : "text-muted"} aria-hidden="true">{row.there ? "✓" : "·"}</span>
            <span class={row.there ? "text-ink" : "text-muted"}>{row.file}</span>
            <span class="font-sans text-caption text-muted">{row.there ? "written" : "waiting…"} · {row.said}</span>
          </li>
        )}
      </For>
    </ul>
  )
}

const changedSaid = (plugin: Defined): string => {
  const source = plugin.source
  const halves = [
    { file: PLUGIN_SERVER_FILE, was: source.approvedServer, now: source.server },
    { file: PLUGIN_BROWSER_FILE, was: source.approvedBrowser, now: source.browser ?? "" },
  ].filter((half) => half.was !== undefined)
  if (halves.length === 0) return "The code changed since you turned it on."
  const counted = halves.map((half) => ({ file: half.file, lines: changedCount(diffLines(half.was!, half.now)) }))
  const total = counted.reduce((sum, half) => sum + half.lines, 0)
  const where = counted.length === 1 ? ` in ${counted[0]!.file}` : ""
  return `${total} ${total === 1 ? "line" : "lines"} changed${where}.`
}

function Banner(props: { readonly tone: "amber" | "red"; readonly testid: string; readonly children: unknown }) {
  return (
    <p
      class={`mt-4 rounded-control px-3 py-2 text-label ${props.tone === "red" ? "bg-alarm/10 text-alarm" : "bg-doing/10 text-ink"}`}
      data-testid={props.testid}
      role={props.tone === "red" ? "alert" : "status"}
    >
      {props.children as never}
    </p>
  )
}

function Block(props: { readonly heading: string; readonly note?: string; readonly children: unknown }) {
  return (
    <section class="mt-6">
      <h2 class="m-0 flex flex-wrap items-baseline gap-2 text-body font-semibold">
        {props.heading}
        <Show when={props.note}>{(note) => <small class="font-normal text-label text-muted">{note()}</small>}</Show>
      </h2>
      <div class="mt-2">{props.children as never}</div>
    </section>
  )
}
