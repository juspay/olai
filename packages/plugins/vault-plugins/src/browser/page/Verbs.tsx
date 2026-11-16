/**
 * ONE PRIMARY VERB PER STATE, and the `•••` beside it.
 *
 * ## One, and it is the state's own
 *
 * Every screen of this page has exactly one thing a person is meant to press,
 * and it is different on each: *Stop* while an agent is writing the folder,
 * *Turn on* when it is ready to be read, the switch itself once it is running,
 * *Turn on this version* when an edit paused it, *Ask the agent to fix it*
 * when it could not start. A row of equal-weight buttons would make the reader
 * choose a verb before they have chosen an answer; the second-rank verbs live
 * behind the dots, where they can be found and cannot be pressed by accident.
 *
 * ## *Turn on* IS the approval, and that is why it carries a version
 *
 * `plugins.approve` writes two facts in one write — *I have read this and it
 * may run*, and *I want it running* — so the primary button on a plugin
 * nobody has approved is one press rather than a consent dialog followed by a
 * switch. What it sends back is the version the page DREW, so a serve whose
 * reading has moved on refuses by name instead of approving whatever is on
 * disk at the moment of the press.
 *
 * ## ...and why the verb disarms itself
 *
 * The page is drawn off a live roster. An edit that lands while somebody is
 * reading REPLACES the source under them, and a button that went on being
 * armed would send the version that is current at the press — which makes the
 * serve's own guard unreachable and turns the gesture into *approve whatever
 * is there now*. So the page remembers the version it first showed this
 * reader; when the roster moves, the verb is not drawn at all and *I have read
 * it* is drawn in its place. What re-arms it is reading again, which is a
 * press of its own. (`olai-plugin-plugin-inspector`'s `Panel.tsx` reached the
 * same answer for the same button in the panel; this is that rule on the page
 * the gesture now lives on.)
 */

import { createSignal, lazy, Show } from "solid-js"

import { Tip } from "@olai/web/client/Tip.tsx"
import { TESTID } from "../../testids.ts"
import type { Defined, Stage } from "../state.ts"
import type { MoreVerb } from "./MorePanel.tsx"

const MorePanel = lazy(() => import("./MorePanel.tsx"))

/** What a press on this page can do. Built once by the page, which owns the
 *  calls, the in-flight flag and the refusal line; this file owns which of
 *  them each state offers and what each is called. */
export interface Acts {
  /** A call is in flight: every verb is frozen rather than hidden, so nothing
   *  moves under a finger. */
  readonly busy: () => boolean
  /** Approve the version on screen. */
  readonly approve: () => void
  /** ...and the standing decision, on its own: every later version may run
   *  unread, or may not. It does NOT touch the switch, which is what it used
   *  to do — choosing *Always trust changes* on a plugin somebody had switched
   *  off turned it back on. */
  readonly trust: (trusting: boolean) => void
  /** Whether that standing decision is in force, so the menu draws the way out
   *  of it rather than the way into it a second time. */
  readonly trusting: () => boolean
  /** The ordinary switch on a plugin that is already approved. */
  readonly setOn: (on: boolean) => void
  /** Ask for the confirmation, and — once it is on screen — go through with
   *  it. Deleting a plugin takes its folder and its decision. */
  readonly confirmRemove: () => void
  readonly remove: () => void
  /** Hand the fault to the conversation that wrote the code, verbatim. */
  readonly askFix: () => void
  /** ...or open that conversation to ask it for something new. */
  readonly askChange: () => void
  /** Whether there is a conversation to SPEAK INTO — a plugin with a builder
   *  bound to it. The serve posts the words whether or not this tab can draw
   *  the conversation, which is why this is a different question from the one
   *  below. */
  readonly canAsk: () => boolean
  /** ...and whether this tab can OPEN it: a dock is held and there is a seat
   *  for it. With chat off, or on a phone, there is nothing to open and the
   *  page offers no verb that would. */
  readonly canOpen: () => boolean
  /** Whether what is on screen has moved since this reader started reading. */
  readonly moved: () => boolean
  /** I have read it: take the version on screen as the one I am deciding
   *  about, and arm the verb again. */
  readonly reread: () => void
}

const PRIMARY = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border-0 bg-ink px-3 py-1.5 text-body font-medium text-paper hover:bg-ink/90 disabled:cursor-default disabled:opacity-60 md:min-h-8"
const QUIET = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-transparent px-2 py-1 text-body text-muted hover:text-ink disabled:cursor-default disabled:opacity-60 md:min-h-8"

/** Which states' verbs are a decision about CODE — the two the version guard
 *  is about, and the two the `moved` disarm applies to. */
const decides = (stage: Stage): boolean => stage === "review" || stage === "paused"

export function Verbs(props: {
  readonly plugin: Defined
  readonly stage: Stage
  readonly acts: Acts
  /** The `•••` is drawn beside the head's copy only: the phone's foot is one
   *  thumb-sized decision, and a second control there is a mis-press. */
  readonly menu?: boolean
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
      {/* ONE ROW, AND AT THE PHONE'S FOOT THE DECISION FILLS IT. Beside the
          head the primary sits at its own width with the `•••` next to it; at
          the foot there is nothing beside it and the row is the width of the
          screen, so a button at its own width would be a small target in a
          wide empty bar — which is the one place a thumb is aiming. A switch
          keeps its size: it is a control with a shape, not a label. */}
      <div class={`flex items-center gap-2 ${props.menu === true ? "" : "[&>button:not([role=switch])]:w-full"}`}>
        <Primary plugin={props.plugin} stage={props.stage} acts={props.acts} />
        <Show when={props.menu === true}>
          <More plugin={props.plugin} stage={props.stage} acts={props.acts} />
        </Show>
      </div>
    </Show>
  )
}

function Primary(props: { readonly plugin: Defined; readonly stage: Stage; readonly acts: Acts }) {
  return (
    <>
      {/*
        A FOLDER BEING WRITTEN HAS NO DECISION TO OFFER, and the button that
        used to be here pretended otherwise. *Stop* wrote `on: no` on a plugin
        nobody had approved — which stops nothing, because an unapproved plugin
        was never going to start — and the agent went on writing files. The
        thing that actually stops a build is the agent's own Stop, in the
        conversation, so this is a way to that conversation and nothing else.
        With no seat to open one in, the page draws no verb here at all: the
        *Ask* section below links to the conversation's own page.
      */}
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
      {/* A RUNNING PLUGIN WEARS A SWITCH rather than a button, because the
          question has changed: it is no longer *may this run* but *is it on*,
          which is the same control every other row in the plugins panel has. */}
      <Show when={props.stage === "on"}>
        <button type="button" role="switch" aria-checked="true" aria-label={`Turn off ${props.plugin.source.title}`}
          class="inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-0 bg-done p-0.5 disabled:cursor-default disabled:opacity-60"
          data-testid={TESTID.pageVerb} data-verb="switch" disabled={props.acts.busy()}
          onClick={() => props.acts.setOn(false)}>
          <span class="size-5 translate-x-4 rounded-full bg-paper transition-transform" aria-hidden="true" />
        </button>
      </Show>
      {/* THE FAULT'S OWN BUTTON, and only where there is somebody to hand it
          to. With no conversation bound the page says the sentence and offers
          no verb, rather than a button that answers nothing. */}
      <Show when={props.stage === "broken" && props.acts.canAsk()}>
        <button type="button" class={PRIMARY} data-testid={TESTID.pageVerb} data-verb="ask-fix" disabled={props.acts.busy()}
          onClick={() => props.acts.askFix()}>Ask the agent to fix it</button>
      </Show>
    </>
  )
}

/**
 * WHAT THE DOTS OFFER — the standing decision about code, the conversation,
 * and the end of the plugin. Each is drawn only where it means something, and
 * the menu is not drawn at all when none of them do.
 *
 * THE TRUST ROW IS A PAIR, not a one-way door. Choosing *Always trust changes*
 * used to leave no sign afterwards that it was in force and no way to take it
 * back: the next edit simply ran, and a person who had changed their mind had
 * to edit the settings file. So the row says which way it is pointing and the
 * press is the other way.
 *
 * DELETE IS LAST AND ASKS AGAIN, because the halves are reachable from nowhere
 * else in the app: this is the only gesture that gets rid of a plugin, and it
 * is also the only one nobody can undo.
 */
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
