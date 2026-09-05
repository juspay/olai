/**
 * WHO IS TALKING, over the first row of their run — a mark and a name.
 *
 * The panel used to say whose a row was by its SHAPE alone: a right-hand accent
 * bubble is yours, a full-width paragraph is the agent's, a full-width
 * paragraph with an edge down its left is a machine's ({@link ./Rang.tsx}). That
 * is a vocabulary a reader has to learn and then hold while they read, and it
 * ran out the moment there were three parties — the third face was distinct
 * from the other two and said nothing about WHICH of them it was. A face and a
 * name is what every transcript anybody has ever read does instead.
 *
 * ## Three kinds, three answers, and none of them hardcoded
 *
 *   - THE PERSON wears their own picture, resolved down the identity row's
 *     ladder — the proxy's IdP avatar, the operator's template, the gravatar of
 *     a real email claim, and the silhouette when no rung had one. It is the
 *     same answer the header chip draws, through the same single ask
 *     (`@olai/web/client/who/index.ts`, core viewer furniture shared
 *     by both faces), because a header saying one thing
 *     about who is looking and a transcript saying another would be two answers
 *     to one question. There is no default picture anywhere in this file:
 *     `null` from the ladder is the silhouette, which is a rung and not a
 *     fallback — and it is also what a serve running no identity row draws
 *     here, since `who.get` answers nobody with nothing standing behind that
 *     row's door.
 *   - THE AGENT wears the {@link ./AgentMark.tsx} family, the marks the header
 *     and the picker already draw, so the agent in the title bar and the agent
 *     in the transcript are visibly one thing. An agent olai has no shape for
 *     gets that file's plain generic and never another agent's.
 *   - A PLUGIN wears the mark its own manifest contributed
 *     ({@link ./PluginMark.tsx}), because core may know a plugin's name as data
 *     and nothing else.
 *
 * ## Why a strip above the words rather than a gutter beside them
 *
 * A gutter is what a full-width chat does, and this is a 26rem drawer beside a
 * page. A column of faces down its left would take a fifth of the width from
 * every row for a fact that changes a handful of times a conversation — and it
 * could not hold the person's own messages anyway, which are drawn on the RIGHT
 * and would have their face on the far side of the bubble it names. So the face
 * goes ABOVE the run, on the side the words are on ({@link ./speakers.ts}'s
 * `onTheRight`), which costs one line per run and nothing per row.
 *
 * It is drawn in the panel's CHROME voice — small, mono, uppercase-free, muted
 * — which is the voice the lane label, the queued strip and the delivery line
 * already speak in. The panel has one register for "this is about the message"
 * and another for the message, and a name over somebody's words is the first.
 *
 * ## Why the name is spoken and the mark is not
 *
 * The mark is `aria-hidden` in all three components: the name is beside it, so
 * a second copy of the answer in the accessible name would be the panel saying
 * one word twice. What the mark buys is the GLANCE, which is a thing a screen
 * reader does not do and does not need — the name is already the whole answer
 * there.
 */

import { Match, Show, Switch } from "solid-js"

import type { AgentChoice } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import {
  saying,
  UserIcon,
  whoAmI,
  type Who as Person,
} from "@olai/web/client/who/index.ts"
import { AgentMark, MARK } from "./AgentMark.tsx"
import { PluginMark } from "./PluginMark.tsx"
import { onTheRight, type Speaker as Party } from "./speakers.ts"

/** What this panel calls the person when nobody is on the connection — a local
 *  `just run`, a proxy that injects nothing. It is `you` rather than a login
 *  invented for the occasion, because that is what is true: these are the words
 *  the reader typed, and the row is already drawn on their side. */
const ANONYMOUS = "you"

/** What the AGENT slot says before a conversation has bound one. It is drawn
 *  vanishingly rarely — a row is attributed to the agent, so there is one — but
 *  the session is what holds WHICH, and a face that waited for it would flicker
 *  in on the beat the session lands. The generic mark beside this word is the
 *  same honest shape. */
const AN_AGENT = "agent"

/**
 * THE FACE ONE ROW IS OWED — who is speaking, and what this conversation calls
 * the agent when the answer is the agent.
 *
 * ONE VALUE rather than two props threaded side by side, because it is one
 * question the LIST answers ({@link ./Transcript.tsx}) and one thing a row is
 * either owed or not: `null` for every row inside a run, which is most of them.
 * Two props would let a caller hand over half of it.
 */
export interface Faced {
  /** Which of the three parties. {@link ./speakers.ts}'s `facedAt` decides,
   *  and answers `null` for a row that is not the first of its run. */
  readonly party: Party
  /** Which agent this conversation is with, or `undefined` before one is
   *  bound. Carried rather than reached for: it is a fact about the SESSION,
   *  which is the list's to know and not a row's. */
  readonly agent: AgentChoice | undefined
}

export function Speaker(props: Faced) {
  const who = whoAmI()
  /** The person on this connection, or `null`/`undefined` — the resource's own
   *  three answers, kept apart the way {@link ../who/Who.tsx} keeps them: a
   *  failed door is not the same as nobody. Both draw {@link ANONYMOUS} here,
   *  because a transcript is not the place to report on an identity door — the
   *  header chip is, and it does. */
  const person = () => who.who()
  /** What to CALL the speaker. The person's display name, else their login,
   *  else `you`; the agent's roster name; a plugin's own name, which is the
   *  string core stamped on the row. */
  const called = (): string => {
    switch (props.party.of) {
      case "human": {
        const one = person()
        return one == null ? ANONYMOUS : one.name ?? one.login
      }
      case "agent":
        return props.agent?.name ?? AN_AGENT
      case "plugin":
        return props.party.name
    }
  }
  return (
    <div
      class="mb-1 flex min-w-0 items-center gap-1.5 font-mono text-[0.6875rem] text-muted"
      classList={{
        // The face sits on the side its words do. `flex-row-reverse` rather
        // than a second class list: what changes is which end of the line the
        // mark is at, and mirroring the row is one statement of that where an
        // alignment plus an order would be two.
        "flex-row-reverse": onTheRight(props.party),
      }}
      data-testid={TESTID.chatSpeaker}
      data-speaker={props.party.of}
      data-speaker-name={called()}
    >
      <Switch>
        <Match when={props.party.of === "human"}>
          {/* THE LADDER'S ANSWER, whatever rung it came off. A picture the
              server resolved, or the silhouette that IS the bottom rung —
              never a default drawn here, which would be this file inventing a
              face for somebody it has never been told about. */}
          <Show when={person()?.picture} fallback={<UserIcon class={MARK} />}>
            {(src) => (
              <img
                src={src()}
                alt=""
                width={14}
                height={14}
                referrerPolicy="no-referrer"
                class={`${MARK} rounded-full object-cover`}
              />
            )}
          </Show>
        </Match>
        <Match when={props.party.of === "agent"}>
          {/* The empty id draws that file's plain generic, which is the honest
              mark for "an agent, and this panel has not been told which". */}
          <AgentMark id={props.agent?.id ?? ""} />
        </Match>
        <Match when={props.party.of === "plugin" ? props.party : undefined} keyed>
          {(plugin) => <PluginMark name={plugin.name} />}
        </Match>
      </Switch>
      {/* The full account of who this is goes under the POINTER rather than on
          the line: on a shared vault the difference between a display name and
          the account it belongs to is the whole question (`../who/saying.ts`),
          and it does not fit in a drawer beside a page. */}
      <span
        class="min-w-0 truncate"
        title={props.party.of === "human" ? personTitle(person()) : undefined}
      >
        {called()}
      </span>
    </div>
  )
}

/** The person's login beside their name, for the tooltip — or nothing at all
 *  when there is nobody to say it of. Its own function so the `<span>` above
 *  reads as one line rather than as a nested conditional. */
const personTitle = (one: Person | null | undefined): string | undefined =>
  one == null ? undefined : saying(one)
