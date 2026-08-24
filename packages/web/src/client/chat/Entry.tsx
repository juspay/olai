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
 *
 * WHAT SEPARATES ONE ROW FROM THE NEXT is deliberately not here. A row used to
 * carry its own bottom margin, which was fine until something had to draw a
 * line ALONGSIDE a run of rows — a subagent's lane ({@link ./Transcript.tsx})
 * — and found the gaps between them were somebody else's and had to be
 * cancelled out by a matching negative. Two numbers in two files, one of them
 * in a file that has no idea the other exists, and a spacing tweak here would
 * have broken a rail over there with nothing to catch it. The list owns the
 * gap now, because the list is what has rows to put gaps between.
 */

import { SAYING_MS } from "@olai/surface"

import type { ChatEntry, Delivery } from "@olai/surface"
import { createScheduled, throttle } from "@solid-primitives/scheduled"
import { createEffect, createMemo, Match, Show, Switch } from "solid-js"


import { Attachments } from "./Attachments.tsx"
import { ContextChips } from "./ContextChips.tsx"
import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { TESTID } from "../testids.ts"

import { AskForm } from "./AskForm.tsx"
import { createDeclared } from "./declared.ts"
import { markNodeRefs } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"
import { ToolFrame } from "./ToolFrame.tsx"

/** How often a growing answer may be re-rendered. Fast enough that it reads as
 *  live, slow enough that the cost is the clock's rather than the agent's.
 *
 *  THE WIRE'S OWN NUMBER, not one of this component's. The server publishes a
 *  growing row's pieces on exactly this clock (`@olai/surface`'s `SAYING_MS`),
 *  so a second number here would be either a re-render per frame with a
 *  throttle that never bites, or a throttle a beat out of step with the frames
 *  it is throttling — a cadence decided twice for one thing that happens once.
 *  What this still buys where they agree is the burst: frames that arrive
 *  together after a stall re-render once. */
const FRAME_MS = SAYING_MS

/**
 * WHAT A FATE LOOKS LIKE — the whole of it, per fate, in one row.
 *
 * The bubble's edge, the words under it and their tone are three views of one
 * thing: what became of this message. They were two tables keyed by the same
 * fate, so answering "what does an unanswered message look like" meant reading
 * two places and holding them together — the same split this feature exists to
 * undo one layer up.
 *
 * ALARM for the certainty and DOING for the doubt, which is the palette's own
 * vocabulary rather than two shades of wrong: `alarm` is an error or a
 * refusal, and `doing` is the token for something in flight — which is exactly
 * what a message nothing has answered about still is.
 *
 * The words are about the MESSAGE rather than about the protocol: nobody needs
 * the word "steer" or a deadline in seconds to know what to do next. The detail
 * — which method, which agent, how long — is the banner's, where the reason it
 * failed already goes.
 */
const FACE: Record<Delivery, {
  readonly bubble: string
  readonly said: string
  readonly tone: string
}> = {
  refused: {
    bubble: "border border-dashed border-alarm bg-alarm/5",
    said: "not sent",
    tone: "text-alarm",
  },
  unanswered: {
    bubble: "border border-dashed border-doing bg-doing/5",
    said: "no answer — it may not have arrived",
    tone: "text-doing",
  },
}

/** ... and what a message that simply WENT looks like, which is not a fate and
 *  is deliberately not a third row above: the table answers "what became of
 *  it", and nothing became of an ordinary message. */
const SENT = "border border-accent/30 bg-accent/10"

/** The edge a message's bubble takes, fate or none. A function of the row and
 *  nothing else, so it sits out here with the table it reads rather than being
 *  minted per component. */
const bubbleOf = (fate: Delivery | undefined): string =>
  fate === undefined ? SENT : FACE[fate].bubble

/**
 * WAITING ITS TURN AT THE AGENT, and it is deliberately not a fate.
 *
 * Nothing has gone wrong with a queued message: it went out, it is at the
 * agent, and there is a turn in front of it. So the bubble is left exactly as
 * an ordinary message's, and what says so is a line under it in the same slot
 * the delivery strip uses — a person who has just pressed send and is looking
 * there gets an answer to "is anything happening about this", which is the
 * question the whole feature exists for.
 *
 * `doing` rather than `muted`, which is the palette's own vocabulary read the
 * way {@link FACE} reads it: this is something in flight, like an unanswered
 * message is, and unlike a refusal, which is over. It is the same token the
 * live cue under the transcript uses, so a person watching the panel sees one
 * colour for "in progress" and not two.
 *
 * IT CLEARS ITSELF, from the wire: the server takes the mark off when the turns
 * in front of this one end, so nothing here has a clock, a timer or an opinion
 * about how long a turn takes.
 */
const WAITING = "queued"

/** What the agent said is not in a file, so there is no path to name — and the
 *  empty string resolves against the served directory itself, which is where
 *  the agent was started and therefore what a relative path in what it says is
 *  relative to. */
const AGENT_WROTE_IT = ""

export function Entry(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
}) {
  /** ONLY FOR A ROW THAT CAN STREAM — off the same `kind` the asker below is
   *  read off, and for its reason: `kind` never changes for an entry, and a
   *  scheduler per row would leave every user message and every tool frame of
   *  a long transcript holding a timer over text that cannot move. */
  const due = props.entry.kind === "agent"
    ? createScheduled((run) => throttle(run, FRAME_MS))
    : undefined
  /** What the SET says about the ids this message names — a question now,
   *  asked once per message ({@link ./declared.ts}).
   *
   *  ONLY FOR THE AGENT's own prose, which is the only row with rendered
   *  markdown in it, and `kind` never changes for an entry — so this is asked
   *  once rather than leaving every user message and every tool frame of a long
   *  transcript holding an asker with nothing to ask about. */
  const declared = props.entry.kind === "agent" ? createDeclared() : undefined
  /** The element the agent's rendered answer lands in, so the ids it names can
   *  be found in it ({@link ./refs.ts}). A ref rather than a query on the pane:
   *  the pass is over ONE message, and it re-runs while that message streams. */
  let said: HTMLDivElement | undefined
  /** The text to draw: the current one whenever the throttle says so, and the
   *  last one it allowed otherwise. A settled entry passes straight through —
   *  the final text must never be the one the throttle happened to skip. */
  const shown = createMemo((previous: string = "") => {
    const text = props.entry.text
    if (props.entry.kind !== "agent" || props.entry.streaming !== true) return text
    // `due` is present for exactly the kind this line has already narrowed to,
    // which the type cannot see: the two are read off one `kind` that never
    // changes for an entry.
    return due === undefined || due() ? text : previous
  })
  /** The matching arm, or nothing. One idiom for every kind: Solid's `<Match>`
   *  then hands the narrowed row to the child, so a kind-specific field is
   *  read off a value the discriminant already picked. */
  const ofKind = <K extends ChatEntry["kind"]>(
    kind: K,
  ): Extract<ChatEntry, { kind: K }> | undefined =>
    props.entry.kind === kind
      ? (props.entry as Extract<ChatEntry, { kind: K }>)
      : undefined
  // ONLY for the agent's own prose, which is the only row that has rendered
  // markdown in it — asked once, off the same `kind` the asker above was, so
  // this is not a `said === undefined` bail inside an effect every row of a
  // long transcript would keep live. It also keeps the markdown chunk's fetch
  // where it was: reading `markdownReady()` is what ASKS for the pipeline
  // (`../markdown/chunk.ts`), and a panel of user messages should no more
  // request it than a page of outline rows does.

  //
  // It re-runs on three things, because three things move: the sentence as it
  // streams, the ANSWER (which of these ids the set declares is a question now,
  // and it lands a beat after the words do), and the pipeline landing — until
  // which the element holds the answer's own text, `pre-wrap` and with no code
  // spans in it at all, so a pass that did not track it would run once against
  // that text and never again.
  if (declared !== undefined) {
    createEffect(() => {
      shown()
      markdownReady()
      if (said === undefined) return
      // ASK FIRST, THEN MARK, and both off the same spans: the ids in this
      // message go as one question ({@link ./declared.ts}), and what has been
      // answered so far is what marks. A span nothing has answered about yet is
      // PLAIN — never marked on a guess and un-marked when the answer arrives.
      // ONE PASS: it marks with what has been answered and hands back every id
      // the message asked about, which is what goes on the wire. What an id
      // RESOLVES TO is the format's `nodeNamed`, run server-side — a span
      // saying `echo` is marked with `order`, because rows carry the node they
      // SHOW and a mark on the placement's own id would leave the page for a
      // node that is right there. Reading the answer inside this effect is what
      // re-runs the pass when one lands.
      declared.want(markNodeRefs(said, declared.named))
    })
  }

  return (
    <div
      class="min-w-0"
      data-testid={TESTID.chatEntry}
      data-kind={props.entry.kind}
      data-entry-id={props.entry.id}
      data-streaming={props.entry.kind === "agent" && props.entry.streaming === true}
    >
      <Switch>
        <Match when={ofKind("user")}>
          {(user) => (
          /* What you said sits apart from what the agent said: on the right,
              in an accent-tinted bubble. A faint `bg-rule/60` box on a
              full-width line was the only cue before, and it read as another
              agent paragraph. The chips and pictures ride with the words,
              because they went with the message. */
          <div class="ml-auto flex w-fit max-w-[85%] flex-col items-end">
            {/* What the message was ABOUT, above what it said — the order the
                composer had them in, and the order they were meant in: the node
                is the subject and the words are what was asked about it. Still
                pressable here, which is the other half of this feature: the row
                a question was asked from is one press away from the answer. */}
            <ContextChips nodes={user().context ?? []} />
            {/* The pictures first, then the words — which is the order they were
                put in, and it keeps a message whose whole content is a
                screenshot from being an empty grey box with a chip under it. */}
            <Attachments names={user().attachments ?? []} />
            <Show when={user().text !== ""}>
              <p
                class={`whitespace-pre-wrap rounded px-2 py-1.5 text-sm text-ink ${
                  bubbleOf(user().delivery)
                }`}
                data-testid={TESTID.chatMine}
              >
                {user().text}
              </p>
            </Show>
            {/* IT DID NOT LAND — and the words are still here, which is the
                whole of the promise. The bubble goes dashed and edged rather
                than being replaced by a notice, because what a person wants to
                see is the message they typed, exactly as they typed it; what
                they want to know is what became of it.

                WHICH of the two it was is the difference between an offer and
                a lie. A refusal is certain, so the strip says so plainly and
                puts one press under it. A silence is not: the agent may have
                the message already, so the strip says THAT — and carries no
                button at all, because a retry there would hand somebody a
                duplicate they had no way to predict. Nothing retries on its
                own either way. */}
            {/* IT HAS NOT BEEN STARTED ON YET — the agent is on something
                else, and this is next. Above the delivery strip and never
                beside it: a row is one or the other, since a message that is
                waiting at the agent is one nothing has failed about. */}
            <Show when={user().queued}>
              <div
                class="mt-1 flex items-center gap-2"
                data-testid={TESTID.chatQueued}
              >
                <span class="font-mono text-[0.6875rem] text-doing">{WAITING}</span>
              </div>
            </Show>
            <Show when={user().delivery} keyed>
              {(fate) => (
                <div
                  class="mt-1 flex items-center gap-2"
                  data-testid={TESTID.chatDelivery}
                  data-delivery={fate}
                >
                  <span class={`font-mono text-[0.6875rem] ${FACE[fate].tone}`}>
                    {FACE[fate].said}
                  </span>
                  {/* The quiet pill's shape in the transcript's own scale, and
                      that divergence says why in place, as `../pill.ts` asks of
                      every lookalike: this button sits in a line of 11px mono
                      with `not sent` beside it, and wearing `QUIET_PILL`'s
                      `text-xs`/`px-2 py-1` would make one control in that line
                      a size larger than the words it belongs to. */}
                  <Show when={fate === "refused"}>
                    <button
                      type="button"
                      class="rounded border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted hover:text-ink"
                      data-testid={TESTID.chatResend}
                      onClick={() => props.chat.resend(user().id)}
                    >
                      send again
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </div>
          )}
        </Match>

        <Match when={ofKind("agent")}>
          {(agent) => (
          /* A wrapper with no styling of its own, purely so the rendered
              answer is an element this component can reach into: `Markdown`
              owns its own div (it is the one place `innerHTML` is written) and
              what is inside it belongs to no component at all. */
          <div ref={said}>
            <Markdown
              source={shown()}
              from={AGENT_WROTE_IT}
              live={agent().streaming === true}
              // `olai-md-compact`: an answer is drawn in a 26rem drawer beside
              // the page, not as a page — so it takes the tighter spacing scale
              // and the heading ceiling, the same ones a note takes
              // (`theme/scale.ts`). Without it an agent opening with a `#`
              // sets a 2rem heading in a column half that wide.
              class="olai-md-compact text-sm"
              testid={TESTID.chatSaid}
            />
            {/* The caret is CSS (styles.css), hung off the last block of the
                rendered answer. An element of its own would have to go after
                the markdown — which means on a line of its own, under the
                paragraph it belongs to, since markdown decides what the last
                block is and a block cannot be reached into from out here.
                `::after` is reaching into it, which is exactly what was
                wanted. */}
          </div>
          )}
        </Match>

        <Match when={ofKind("tool")}>
          {(tool) => <ToolFrame entry={tool()} />}
        </Match>

        <Match when={ofKind("ask")}>
          {(ask) => <AskForm entry={ask()} chat={props.chat} />}
        </Match>

        <Match when={ofKind("refusal")}>
          {(row) => <Refusal failure={row().refusal} />}
        </Match>

        <Match when={ofKind("notice")}>
          {(notice) => (
            <p class="font-mono text-[0.6875rem] text-muted">{notice().text}</p>
          )}
        </Match>
      </Switch>
    </div>
  )
}
