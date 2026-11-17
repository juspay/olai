/**
 * CORE'S `conversations` KEY, STOOD UP — the door another row is handed, over
 * the four things this row already does.
 *
 * The key is `@olai/plugin-api`'s {@link Conversations} and the owner of the
 * concept is core, which argues there why conversations are brokered rather
 * than named: a row that named this key directly would go `waiting` on a serve
 * with chat switched off. Chat is one provider standing behind it.
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
 * IT ARRIVES BY TWO HOPS AND NEITHER MAY DROP IT. The facade stamps a
 * consuming activation's word and lifetime onto the provision it resolves; the
 * only consumer of THIS door reaches it through core's broker
 * (`@olai/plugin-api`'s `ConversationsWatch`), which is itself a provision and
 * passes both on. The default below — a missing lifetime reading as *still
 * here* — is for the direct host read, which is core calling from outside any
 * activation and has nothing to unload.
 *
 * ## What is NOT here, and is the point of the door
 *
 * No reading. There is no verb on this module that answers what a conversation
 * said, and that is a deliberate absence rather than a gap waiting to be
 * filled (`@olai/plugin-api`'s {@link Conversations} argues it, where the key
 * is declared).
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
import type { Conversations, Provision } from "@olai/plugin-api/services"

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
  /** THE CHAT AT AN ADDRESS — the conversation seated on the chat row at that
   *  place (`./places.ts`), or `null` where no chat is there or the one there
   *  has never been started. Asked of the vault as it stands now. */
  readonly seatAt: (about: string) => Effect.Effect<Conversing | null>
  /** ...and WHICH OF THESE ADDRESSES has a chat row at all, started or not —
   *  the ones that do, read off one vault so the answers cannot disagree. */
  readonly chatsAt: (abouts: ReadonlyArray<string>) => Effect.Effect<ReadonlySet<string>>
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
          about: input.about,
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
     * FOUR WAYS TO ANSWER `false`, and each is ordinary: the asking activation
     * has left, no chat is at that address (its row was retitled or trashed,
     * or the place is gone), or the chat there names a conversation nobody has
     * started. A roster drawn a second before a press can mean any of them,
     * which is why this is an answer and not a failure.
     */
    say: (input) =>
      Effect.gen(function*() {
        if (!current()) return false
        const to = yield* owner.seatAt(input.about)
        if (to === null) return false
        return yield* owner.deliver(who, to, input.text, current)
      }),
    /** Which addresses have a chat — the one fact about a conversation this
     *  door says out loud, and it is a fact about the vault, not about what
     *  anybody said. */
    here: (input) => owner.chatsAt(input.about),
    engines: owner.engines,
  }
}
