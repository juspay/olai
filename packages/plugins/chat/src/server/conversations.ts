/**
 * `chat.conversations`, STOOD UP — the door another row is handed, over the
 * four things this row already does.
 *
 * ## Why this is a module and not fifteen lines in `../server.ts`
 *
 * For `./deliveries.ts`'s reason, read one question over: the interesting part
 * of a provision is not the verbs, it is WHICH AUTHORITY each one carries and
 * what it answers when the thing behind it is not there. Both of those are
 * decided per CONSUMER — the runtime hands this function the asking plugin's
 * own word and that activation's lifetime — and a decision made per consumer
 * is a decision worth being able to call from a test with a made-up consumer
 * in hand. The owner below is four thunks the row fills in; everything that
 * reads as policy is here, where a test can play it.
 *
 * ## The authority, which is the whole of the keying
 *
 * `who` is the asking plugin's word, stamped by the bridge off the fiber that
 * declared the key rather than taken from any argument — so a message this
 * door delivers carries THAT plugin as its `rang` and no row can sign
 * another's name to one (`../chat.ts`'s `doorFor` argues the anti-spoofing
 * property at the place it is enforced; this is one of its callers).
 *
 * `lifetime.current` is that activation still being here. It gates
 * {@link Conversations.say} and RIDES the delivery, because a delivered body
 * may be HELD for the length of a turn — or until somebody opens a
 * conversation nobody is in, which can be days. A consumer that has since
 * unloaded must not have words land under its name, and the gate is the same
 * one `Deliveries` uses for the same reason.
 *
 * ## What is NOT here, and is the point of the door
 *
 * No reading. There is no verb on this module that answers what a conversation
 * said, and that is a deliberate absence rather than a gap waiting to be
 * filled ({@link ../conversations.ts}'s header argues it).
 *
 * ## The mint is the row's, borrowed whole
 *
 * {@link ConversationsOwner.mint} is the SAME three-act mint the person's *New
 * chat* runs (`./new-chat.ts`'s `newChat`): a node, a binding, a session, under
 * one permit, with the node surviving a refused start. A second spelling of
 * those three acts for machine callers is the thing most worth not having —
 * it is where "the Inbox moved under us" and "the parent can no longer hold a
 * chat" would quietly get two different answers.
 */
import { Effect } from "effect"

import type { OpFailure } from "@olai/format"
import type { Provision } from "@olai/plugin-api/services"

import type { Conversations } from "../conversations.ts"
import type { Conversing } from "../sessions.ts"
import type { NewChatInput } from "./new-chat.ts"
import { lines } from "../teaching.ts"

/** What {@link ConversationsOwner.mint} answers: the node, the conversation it
 *  was seated on where one started, and the sentence where none did. */
export interface Minted {
  readonly node: string
  readonly to: Conversing | null
  readonly refusal: string | null
}

export interface ConversationsOwner {
  /** The three acts, through this row's own refusal when there is no chat to
   *  seat anything on — which is the sentence a serve with no installed engine
   *  answers every other conversation verb with. */
  readonly mint: (input: NewChatInput) => Effect.Effect<Minted, OpFailure>
  /** The FIRST message into a conversation just opened, with the caller's
   *  lines riding under it (`../chat.ts`'s `Panel.send`). Separate from
   *  {@link deliver} because it is a REQUEST: the caller is waiting, and an
   *  agent that would not take the words is a sentence it is owed. */
  readonly send: (
    to: Conversing,
    text: string,
    preamble: ReadonlyArray<string>,
  ) => Effect.Effect<void, OpFailure>
  /** Which conversation is seated on a node, or `null` for a node that is not
   *  a node agent, or is one that has never been started. */
  readonly seat: (node: string) => Conversing | null
  /** One machine-marked message into a conversation that is already there, as
   *  the named plugin, gated on that plugin still being here. `false` where
   *  there is no chat at all to hand it to. */
  readonly deliver: (
    who: string,
    to: Conversing,
    text: string,
    current: () => boolean,
  ) => Effect.Effect<boolean>
  /** The engines this machine can actually start, best first. */
  readonly engines: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}

export const conversationsProvision = (
  owner: ConversationsOwner,
): Provision<Conversations> => (who, lifetime) => {
  const current = lifetime?.current ?? (() => true)
  return {
    /**
     * THE NODE IS ANSWERED WHATEVER HAPPENS NEXT, which is the one promise
     * this verb makes beyond the mint's own.
     *
     * A start that refused and a first message the agent would not take are
     * the same thing to the caller — a conversation that exists and has not
     * begun — and both come back as `refusal` beside the node, because what a
     * caller does with either is the same: write the node down, show the
     * sentence, let somebody open it later.
     */
    open: (input) =>
      Effect.gen(function*() {
        const made = yield* owner.mint({
          agent: input.engine,
          title: input.title,
          parent: input.parent,
        })
        if (made.to === null) return { node: made.node, refusal: made.refusal }
        // THE SENTENCES BECOME LINES HERE and nowhere else — the one seam
        // `[olai] ` is spelled on (`../teaching.ts`), so what this caller
        // asked for reaches the agent as olai's words beside olai's contract
        // rather than as a second convention.
        const said = yield* Effect.result(owner.send(made.to, input.say, lines(input.teach)))
        return {
          node: made.node,
          refusal: said._tag === "Failure" ? said.failure.message : null,
        }
      }),
    /**
     * ...AND SPEAKING INTO ONE THAT IS ALREADY THERE, write-only.
     *
     * THREE WAYS TO ANSWER `false`, and each is ordinary: the asking
     * activation has left, the node is not a node agent (its property was
     * edited away, the record was trashed), or the vault names a conversation
     * nobody has started. A roster drawn a second before a press can mean any
     * of them, which is why this is an answer and not a failure.
     */
    say: (input) =>
      Effect.suspend(() => {
        if (!current()) return Effect.succeed(false)
        const to = owner.seat(input.node)
        if (to === null) return Effect.succeed(false)
        return owner.deliver(who, to, input.text, current)
      }),
    engines: owner.engines,
  }
}
