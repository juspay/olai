/**
 * One row of the conversation, and the six things it can be.
 *
 * A switch rather than six call sites, because "what kind of row is this" is
 * one question and the transcript should not have to know the answer. Each arm
 * is small enough to read at a glance and different enough from the others to
 * earn its own shape.
 *
 * One of the six is the only row a reader can talk BACK through — a question
 * the agent asked ({@link ./AskForm.tsx}) — which is why the conversation's
 * verbs are threaded down here rather than reached for globally: a row that can
 * act is a row that was handed the thing to act on.
 *
 * Markdown at RENDER time, and only for the agent: what a person typed is
 * quoted verbatim, and a tool's title is the agent's own string. The rule is
 * the same one titles and notes follow — the stored text is never touched, and
 * `#` at the start of a line somebody typed is a `#`, not a heading.
 *
 * The SAME pipeline a note and a document go through ({@link ../markdown/}),
 * not one of its own: an agent writing a fenced diff into the panel and a
 * person writing one into a note are doing the same thing, and a second
 * renderer here would be a second dialect — footnotes in one place and not the
 * other, a highlighter kept in step by hand.
 *
 * Rendered WHILE IT ARRIVES, not only once the turn has stopped. Plain text
 * until the end is cheaper and it is what this used to do, and what it looked
 * like was broken: an answer with a code block in it sat there as three
 * backticks, a line, three backticks, for as long as the turn ran — which is
 * exactly the stretch a person is watching it. "It will be right in a moment"
 * is not something a panel gets to say.
 *
 * The cost that argument was about is real — re-parsing the whole message from
 * the top is quadratic in its length over a turn — and it is paid for twice
 * rather than avoided: {@link Note} is told the text is live so no prefix of it
 * enters the cache, and the text this component hands over is THROTTLED, so a
 * message re-renders a few times a second however fast the tokens land. What
 * that costs is bounded by the clock instead of by the agent.
 */

import type { ChatEntry } from "@olai/surface"
import { createScheduled, throttle } from "@solid-primitives/scheduled"
import { createEffect, createMemo, Match, Show, Switch } from "solid-js"


import { Attachments } from "./Attachments.tsx"
import { Context } from "./Context.tsx"
import { useDerived } from "../derived.tsx"
import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { TESTID } from "../testids.ts"
import { AskForm } from "./AskForm.tsx"
import { markNodeRefs } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"
import { ToolFrame } from "./ToolFrame.tsx"

/** How often a growing answer may be re-rendered. Fast enough that it reads as
 *  live, slow enough that the cost is the clock's rather than the agent's. */
const FRAME_MS = 120

/** What the agent said is not in a file, so there is no path to name — and the
 *  empty string resolves against the served directory itself, which is where
 *  the agent was started and therefore what a relative path in what it says is
 *  relative to. */
const AGENT_WROTE_IT = ""

export function Entry(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
}) {
  const due = createScheduled((run) => throttle(run, FRAME_MS))
  const derived = useDerived()
  /** The element the agent's rendered answer lands in, so the ids it names can
   *  be found in it ({@link ./refs.ts}). A ref rather than a query on the pane:
   *  the pass is over ONE message, and it re-runs while that message streams. */
  let said: HTMLDivElement | undefined
  /** The text to draw: the current one whenever the throttle says so, and the
   *  last one it allowed otherwise. A settled entry passes straight through —
   *  the final text must never be the one the throttle happened to skip. */
  const shown = createMemo((previous: string = "") => {
    const text = props.entry.text
    if (props.entry.streaming !== true) return text
    return due() ? text : previous
  })

  // After every frame of the answer, and after every frame of the SET: an id
  // is a reference because a node with that id is loaded, and both halves of
  // that move — the sentence as it streams, and the file as anybody writes to
  // it. Reading both here is what keeps the two in step without a cache key
  // for the set (which is the reason this is not a step in the pipeline).
  //
  // ...and after the PIPELINE lands, which is the third thing that moves and
  // the one that is easy to forget: what is in the element until then is the
  // answer's own text, `pre-wrap` and with no code spans in it at all
  // (`../markdown/chunk.ts`). A pass that did not track it would run once
  // against that text, find nothing, and never run again.
  createEffect(() => {
    shown()
    markdownReady()
    const indexes = derived()
    if (said === undefined || indexes === undefined) return
    markNodeRefs(said, (id) => indexes.byId.has(id))
  })

  return (
    <div
      class="mb-2"
      data-testid={TESTID.chatEntry}
      data-kind={props.entry.kind}
      data-entry-id={props.entry.id}
      data-streaming={props.entry.streaming === true}
    >
      <Switch>
        <Match when={props.entry.kind === "user"}>
          {/* What the message was ABOUT, above what it said — the order the
              composer had them in, and the order they were meant in: the node
              is the subject and the words are what was asked about it. Still
              pressable here, which is the other half of this feature: the row
              a question was asked from is one press away from the answer. */}
          <Context nodes={props.entry.context ?? []} />
          {/* The pictures first, then the words — which is the order they were
              put in, and it keeps a message whose whole content is a
              screenshot from being an empty grey box with a chip under it. */}
          <Attachments names={props.entry.attachments ?? []} />
          <Show when={props.entry.text !== ""}>
            <p class="whitespace-pre-wrap rounded bg-rule/60 px-2 py-1 text-sm">
              {props.entry.text}
            </p>
          </Show>
        </Match>

        <Match when={props.entry.kind === "agent"}>
          {/* A wrapper with no styling of its own, purely so the rendered
              answer is an element this component can reach into: `Markdown`
              owns its own div (it is the one place `innerHTML` is written) and
              what is inside it belongs to no component at all. */}
          <div ref={said}>
          <Markdown
            source={shown()}
            from={AGENT_WROTE_IT}
            live={props.entry.streaming === true}
            // `olai-md-compact`: an answer is drawn in a 26rem drawer beside
            // the page, not as a page — so it takes the tighter spacing scale
            // and the heading ceiling, the same ones a note takes
            // (`markdown/scale.ts`). Without it an agent opening with a `#`
            // sets a 2rem heading in a column half that wide.
            class="olai-md-compact text-sm"
            testid={TESTID.chatSaid}
          />
          {/* The caret is CSS (styles.css), hung off the last block of the
              rendered answer. An element of its own would have to go after the
              markdown — which means on a line of its own, under the paragraph
              it belongs to, since markdown decides what the last block is and a
              block cannot be reached into from out here. `::after` is reaching
              into it, which is exactly what was wanted. */}
          </div>
        </Match>

        <Match when={props.entry.kind === "tool"}>
          <ToolFrame entry={props.entry} />
        </Match>

        <Match when={props.entry.kind === "ask"}>
          <AskForm entry={props.entry} chat={props.chat} />
        </Match>

        <Match when={props.entry.kind === "refusal"}>
          <Show
            when={props.entry.refusal}
            fallback={<p class="text-sm text-alarm">{props.entry.text}</p>}
          >
            {(failure) => <Refusal failure={failure()} />}
          </Show>
        </Match>

        <Match when={props.entry.kind === "notice"}>
          <p class="font-mono text-[0.6875rem] text-muted">{props.entry.text}</p>
        </Match>
      </Switch>
    </div>
  )
}
