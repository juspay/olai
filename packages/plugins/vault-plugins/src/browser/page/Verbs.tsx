import { createSignal, lazy, Show } from "solid-js"

import { Tip } from "@olai/web/client/Tip.tsx"
import { TESTID } from "../../testids.ts"
import type { Defined, Stage } from "../state.ts"
import type { MoreVerb } from "./MorePanel.tsx"

const MorePanel = lazy(() => import("./MorePanel.tsx"))

export interface Acts {
  readonly busy: () => boolean
  readonly approve: () => void
  readonly trust: (trusting: boolean) => void
  readonly trusting: () => boolean
  readonly setOn: (on: boolean) => void
  readonly confirmRemove: () => void
  readonly remove: () => void
  readonly askFix: () => void
  readonly askChange: () => void
  readonly canAsk: () => boolean
  readonly canOpen: () => boolean
  readonly moved: () => boolean
  readonly reread: () => void
}

const PRIMARY = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border-0 bg-ink px-3 py-1.5 text-body font-medium text-paper hover:bg-ink/90 disabled:cursor-default disabled:opacity-60 md:min-h-8"
const QUIET = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-transparent px-2 py-1 text-body text-muted hover:text-ink disabled:cursor-default disabled:opacity-60 md:min-h-8"

const decides = (stage: Stage): boolean => stage === "review" || stage === "paused"

export function Verbs(props: {
  readonly plugin: Defined
  readonly stage: Stage
  readonly acts: Acts
  readonly foot?: boolean
}) {
  return (
    <Show
      when={!(decides(props.stage) && props.acts.moved())}
      fallback={
        <div class="flex items-center gap-2" data-testid={TESTID.pageMoved}>
          <p class="m-0 text-label text-alarm">This changed while you were reading it. Above is what it says now.</p>
          <button type="button" class={QUIET} data-testid={TESTID.pageMovedRead} onClick={() => props.acts.reread()}>
            I have read it
          </button>
        </div>
      }
    >
      <div class={`flex items-center gap-2 ${props.foot === true ? "[&>button:first-of-type:not([role=switch])]:flex-1" : ""}`}>
        <Primary plugin={props.plugin} stage={props.stage} acts={props.acts} />
        <More plugin={props.plugin} stage={props.stage} acts={props.acts} />
      </div>
    </Show>
  )
}

function Primary(props: { readonly plugin: Defined; readonly stage: Stage; readonly acts: Acts }) {
  return (
    <>
      <Show when={props.stage === "building" && props.acts.canOpen()}>
        <Tip text="The agent's own Stop is in the conversation. Nothing starts here until you turn it on.">
          <button type="button" class={QUIET} data-testid={TESTID.pageVerb} data-verb="open-builder" disabled={props.acts.busy()}
            onClick={() => props.acts.askChange()}>Open the conversation</button>
        </Tip>
      </Show>
      <Show when={props.stage === "review"}>
        <button type="button" class={PRIMARY} data-testid={TESTID.pageVerb} data-verb="turn-on" disabled={props.acts.busy()}
          onClick={() => props.acts.approve()}>Turn on</button>
      </Show>
      <Show when={props.stage === "paused"}>
        <button type="button" class={PRIMARY} data-testid={TESTID.pageVerb} data-verb="turn-on-version" disabled={props.acts.busy()}
          onClick={() => props.acts.approve()}>Turn on this version</button>
      </Show>
      <Show when={props.stage === "off"}>
        <button type="button" class={PRIMARY} data-testid={TESTID.pageVerb} data-verb="turn-on" disabled={props.acts.busy()}
          onClick={() => props.acts.setOn(true)}>Turn on</button>
      </Show>
      <Show when={props.stage === "on"}>
        <button type="button" role="switch" aria-checked="true" aria-label={`Turn off ${props.plugin.source.title}`}
          class="inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-0 bg-done p-0.5 disabled:cursor-default disabled:opacity-60"
          data-testid={TESTID.pageVerb} data-verb="switch" disabled={props.acts.busy()}
          onClick={() => props.acts.setOn(false)}>
          <span class="size-5 translate-x-4 rounded-full bg-paper transition-transform" aria-hidden="true" />
        </button>
      </Show>
      <Show when={props.stage === "broken" && props.acts.canAsk()}>
        <button type="button" class={PRIMARY} data-testid={TESTID.pageVerb} data-verb="ask-fix" disabled={props.acts.busy()}
          onClick={() => props.acts.askFix()}>Ask the agent to fix it</button>
      </Show>
    </>
  )
}

const moreVerbs = (stage: Stage, acts: Acts): ReadonlyArray<MoreVerb> => [
  ...(stage === "building" ? [] : acts.trusting()
    ? [{
      id: "trust-stop",
      label: "Stop trusting changes",
      testid: TESTID.pageTrustStop,
      run: () => acts.trust(false),
    }]
    : [{
      id: "trust-always",
      label: "Always trust changes",
      testid: TESTID.pageTrustAlways,
      run: () => acts.trust(true),
    }]),
  ...(acts.canOpen() ? [{
    id: "ask-change",
    label: "Ask for a change…",
    testid: TESTID.pageAskChange,
    run: () => acts.askChange(),
  }] : []),
  {
    id: "delete",
    label: "Delete…",
    testid: TESTID.pageDelete,
    run: () => acts.confirmRemove(),
  },
]

function More(props: { readonly plugin: Defined; readonly stage: Stage; readonly acts: Acts }) {
  const [anchor, setAnchor] = createSignal<HTMLElement | null>(null)
  const verbs = () => moreVerbs(props.stage, props.acts)
  return (
    <Show when={verbs().length > 0}>
      <button
        type="button"
        class={`${QUIET} tracking-[0.05em]`}
        data-testid={TESTID.pageMore}
        data-plugin={props.plugin.name}
        aria-haspopup="menu"
        aria-expanded={anchor() !== null}
        aria-label={`More for ${props.plugin.source.title}`}
        onClick={(event) => {
          const button = event.currentTarget
          setAnchor((before) => (before === null ? button : null))
        }}
      >•••</button>
      <Show when={anchor()}>
        {(at) => (
          <MorePanel
            anchor={at()}
            plugin={props.plugin.name}
            verbs={verbs().map((verb) => ({ ...verb, run: () => { setAnchor(null); verb.run() } }))}
            close={() => setAnchor(null)}
          />
        )}
      </Show>
    </Show>
  )
}
