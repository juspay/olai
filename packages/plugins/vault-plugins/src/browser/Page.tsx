/**
 * ONE PLUGIN'S PAGE — `/plugins/<word>`, and the whole of what a person sees
 * about a plugin their vault defines.
 *
 * ## The order of the page is an argument
 *
 * *What it does* first, in the author's own prose, because that is the
 * question. *What it uses* second, read off the code's own imports, because
 * that is the second question and the one nobody would otherwise be able to
 * answer without reading TypeScript. *The code* third, because the people who
 * want it will scroll and the people who do not should not have to. *Settings*
 * and *Ask for a change* after that: they are about a plugin that already
 * runs, and a page whose first screen is a knob is a page that has assumed the
 * decision.
 *
 * ## One primary verb, and the sentence under it
 *
 * Each state offers exactly one thing to press (`./page/Verbs.tsx` argues
 * which and why), and wherever that verb is drawn the standing sentence is
 * drawn with it: a plugin runs on this computer with everything olai can
 * reach. There is no sandbox, this phase does not pretend to build one, and
 * the page says so in one plain line rather than in a dialog somebody dismisses.
 *
 * ## On a phone the verb is at the foot
 *
 * Not because the page is different — it is the same page, the same sections,
 * the same words — but because the one thing a thumb must reach cannot be at
 * the top of a scroll. The head's copy is hidden below `md` and a sticky foot
 * is shown, with `CLEARANCE` under it so the home indicator and the thumb bar
 * never sit on the button (`olai-plugin-layout/clearance`). Both copies are
 * MOUNTED at both sizes and one is hidden by CSS: a breakpoint must not
 * rebuild the page's subtree, and a `<Show>` over a media query would do
 * exactly that on every rotation.
 *
 * ## What it does not hold
 *
 * No state of the inspector's, and no second settings store: the knobs are the
 * inspector's own `Control` over the leaves the roster carries, written once
 * and drawn in two places. No claims reader either — the README is rendered
 * through the app's markdown pipeline with no directory membership behind it,
 * so a link in a README is drawn plainly rather than decorated as live or
 * dead. That is a limit and not an oversight: the alternative is this page
 * declaring the vault and refusing to draw at all when it is absent.
 */

import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { PLUGIN_BROWSER_FILE, PLUGIN_README_FILE, PLUGIN_SERVER_FILE } from "@olai/surface"
import type { BrowserManagement } from "@olai/surface/management"
import { LAYER } from "@olai/web/client/layer.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { run } from "@olai/web/client/run.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import type { DockDoor } from "olai-plugin-chat/dock"
import { Control } from "olai-plugin-plugin-inspector/control"
import { createComputed, createMemo, createSignal, For, Show, untrack } from "solid-js"

import { TESTID } from "../testids.ts"
import { client } from "../client.ts"
import { dock } from "./doors.ts"
import { changedCount, diffLines } from "./diff.ts"
import { Code } from "./page/Code.tsx"
import { Verbs, type Acts } from "./page/Verbs.tsx"
import { faultSaid, LOOK, metaOf, pluginNamed, stageOf, TRUST_SAID, type Defined } from "./state.ts"

export function PluginPage(props: {
  readonly word: string
  /** Which of the folder's files the ADDRESS named, where it named one — a
   *  half's own path is this page's address (`./route.ts`), and landing on it
   *  should land on that file rather than on whichever the page opens by
   *  default. */
  readonly file?: string
  readonly management: BrowserManagement
}) {
  // The roster subscription is this page's, taken once under the owner the
  // pane mounted it in and released when the pane leaves it.
  const roster = props.management.roster()
  const plugin = createMemo(() => pluginNamed(roster(), props.word))
  return (
    <main class={`mx-auto w-full max-w-3xl px-4 py-6 ${CLEARANCE}`}>
      <Show when={plugin()} fallback={<Missing word={props.word} />}>
        {(found) => <Known plugin={found()} file={props.file} management={props.management} />}
      </Show>
    </main>
  )
}

/**
 * A WORD WITH NO FOLDER BEHIND IT — a plugin somebody deleted, a link from
 * another vault, or a typed address.
 *
 * It says what it looked for and where plugins live, because the one thing a
 * person can do about it is make one or go and look in the folder. A blank
 * page, or a redirect to somewhere else, would both be the app deciding that
 * the address was a mistake.
 */
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
  const stage = () => stageOf(props.plugin)
  const [busy, setBusy] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  /**
   * WHICH VERSION THIS READER HAS BEEN SHOWN — kept with the WORD it belongs
   * to, because one mounted page draws every plugin somebody walks through:
   * navigating from one plugin to another changes a prop rather than remounting,
   * and a remembered version carried across that would disarm the next page's
   * verb for a reason that is not about it.
   */
  const [shown, setShown] = createSignal<{ readonly name: string; readonly version: string }>()
  const seen = () => {
    const was = shown()
    return was?.name === props.plugin.name ? was.version : undefined
  }
  createComputed(() => {
    if (seen() === undefined) setShown({ name: props.plugin.name, version: untrack(() => source().version) })
  })
  const docked = () => {
    const builder = source().builder
    const door = dock()
    if (builder === undefined || door === undefined || !door.desktop()) return undefined
    return { door, builder }
  }
  const call = (effect: Parameters<typeof run>[0], after?: () => void) => {
    setBusy(true)
    setRefused(undefined)
    run(effect, (failure) => { setBusy(false); setRefused(failure.message) }, () => { setBusy(false); after?.() })
  }
  const acts: Acts = {
    busy,
    approve: (forever) => call(client().procedures.plugins.approve({ name: props.plugin.name, version: source().version, forever })),
    setOn: (on) => call(props.management.set(props.plugin.name, on)),
    stop: () => call(client().procedures.plugins.stop({ name: props.plugin.name })),
    // THE FAULT GOES OVER VERBATIM and this page composes none of it: an empty
    // `said` is the serve writing the sentence it already has, which is the
    // whole reason one press is worth more here than a person retyping
    // "it broke" into the conversation.
    askFix: () => call(client().procedures.plugins.ask({ name: props.plugin.name, said: "" }), () => docked()?.door.open(docked()!.builder)),
    askChange: () => { const open = docked(); if (open !== undefined) open.door.open(open.builder) },
    canAsk: () => source().builder !== undefined,
    canOpen: () => docked() !== undefined,
    moved: () => seen() !== undefined && seen() !== source().version,
    reread: () => setShown({ name: props.plugin.name, version: source().version }),
  }
  return (
    <section data-testid={TESTID.page} data-plugin={props.plugin.name} data-stage={stage()}>
      <Show when={docked()}>{(open) => <Docking door={open().door} builder={open().builder} />}</Show>
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
        {/* The head's copy of the verb. Hidden below `md`, where the foot has
            it — mounted either way, so a rotation moves nothing. */}
        <div class="hidden md:block">
          <Verbs plugin={props.plugin} stage={stage()} acts={acts} menu />
        </div>
      </header>

      <Show when={refused()}>
        {(said) => <p class="mt-3 rounded-control bg-alarm/10 px-3 py-2 text-label text-alarm" data-testid={TESTID.pageRefused}>{said()}</p>}
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
          {/* THE README, RENDERED — the author's own prose through the app's
              own pipeline, never a second renderer and never raw text. */}
          <div data-testid={TESTID.pageReadme}>
            <Markdown claims={undefined} from={`${source().folder}${PLUGIN_README_FILE}`} source={source().readme ?? ""} class="olai-md" />
          </div>
        </Block>
      </Show>

      <Show when={stage() === "building"}>
        <Block heading="The code" note={source().folder}>
          <Landing source={source()} />
        </Block>
      </Show>

      <Show when={stage() === "on"}>
        <Show when={(props.plugin.configurationValues ?? []).length > 0}>
          <Block heading="Settings" note="Saved in Settings.olai, for everyone using this directory">
            <div class="flex flex-wrap gap-4">
              <For each={props.plugin.configurationValues ?? []}>
                {(value) => (
                  <div data-testid={TESTID.pageKnob} data-key={value.key}>
                    {/* The plugins panel's own control, over the leaves this
                        plugin declared. Not a copy of it: one knob, one
                        validation, one write door. */}
                    <Control name={props.plugin.name} value={value} configure={props.management.configure} />
                  </div>
                )}
              </For>
            </div>
          </Block>
        </Show>
      </Show>

      <Ask acts={acts} builder={source().builder} />

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

      {/* THE PHONE'S FOOT: one decision, where a thumb is, with the standing
          sentence under it. */}
      <div
        class={`sticky bottom-0 ${LAYER.row} -mx-4 mt-8 flex flex-col gap-1 border-t border-line/60 bg-panel px-4 pt-3 ${CLEARANCE} md:hidden`}
        data-testid={TESTID.pageFoot}
      >
        <Verbs plugin={props.plugin} stage={stage()} acts={acts} />
        <p class="m-0 text-caption text-muted" data-testid={TESTID.pageTrustSaid}>{TRUST_SAID}</p>
      </div>
    </section>
  )
}

/**
 * THE CONVERSATION THAT BUILT IT, BESIDE THE PAGE — on a desktop, and only
 * while somebody is holding the panel's door.
 *
 * Its own child under a `<Show>`, so the effect exists exactly while there is
 * a dock to open: with chat off, with no shell seat, or on a phone there is no
 * component here at all rather than an effect asking every frame whether it
 * may run. Opening is a one-shot per conversation — this tracks which
 * conversation, not whether the dock is still showing it, so a reader who
 * closed the panel is not fought with.
 */
function Docking(props: { readonly door: DockDoor; readonly builder: string }) {
  createComputed<string | undefined>((before) => {
    if (before === props.builder) return before
    props.door.open(props.builder)
    return props.builder
  })
  return null
}

/** *Ask for a change* — the one row that reopens the conversation that wrote
 *  the code, and the honest sentence where there is none to reopen. */
function Ask(props: { readonly acts: Acts; readonly builder: string | undefined }) {
  return (
    <section class="mt-6" data-testid={TESTID.pageAsk}>
      <Show
        when={props.acts.canOpen()}
        fallback={
          <p class="m-0 text-label text-muted">
            {props.builder === undefined
              ? "No conversation is bound to this plugin, so there is nobody to ask. Edit the folder yourself, or ask for a new plugin."
              : "No agent is available to ask right now. The conversation that built it is in Chats."}
          </p>
        }
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-baseline gap-2 rounded-control border border-line/60 bg-transparent px-3 py-2 text-left text-body hover:bg-ink/5"
          data-testid={TESTID.pageAskChange}
          onClick={() => props.acts.askChange()}
        >
          <span>Ask for a change…</span>
          <span class="text-label text-muted">opens the conversation that built it</span>
        </button>
      </Show>
    </section>
  )
}

/** WHICH FILES HAVE LANDED, while an agent is still writing the folder. It is
 *  what the page can honestly say about a build in flight: a roster sees files,
 *  not keystrokes. */
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

/** The banner's own sentence about a paused plugin: how much moved, and in
 *  which half. Read off the same walk the block below it draws. */
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

/**
 * THE SENTENCE OVER A PLUGIN THAT IS NOT RUNNING — amber for *paused*, red for
 * *could not start*.
 *
 * NO `data-tone` ON IT, and that is this app's rule rather than an omission: a
 * mood READ FROM A VALUE is `SaidLine`'s and nobody else's (`@olai/web`'s
 * `claims.test.ts`), because four surfaces deciding for themselves what
 * alarmed looks like and how it is announced is the drift that component
 * ended. This is not one of those lines — it is a box with two skins — so what
 * it carries is its testid, its skin, and the `role` the skin implies.
 */
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

/** One section of the page: a heading, an optional aside in the heading, and
 *  whatever is under it. */
/** One section of the page: a heading, an optional aside in the heading, and
 *  whatever is under it.
 *
 *  THE PROP IS `heading` AND NOT `title`, which is this client's own rule
 *  rather than taste: `title=` in a face is swept repo-wide (`@olai/web`'s
 *  `claims.test.ts`), because the DOM attribute of that name is a tooltip no
 *  screen reader and no touch screen reaches — and a prop spelled the same way
 *  is a file the sweep cannot tell apart from the mistake. */
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
