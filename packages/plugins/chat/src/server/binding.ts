/**
 * THE TWO GESTURES THAT BIND A NODE TO A CONVERSATION — the only verbs on this
 * plugin's surface that are two acts rather than a pass-through.
 *
 * ## Why they are composed at all
 *
 * Every other verb here hands the call straight to the panel: what a chunk
 * MEANS, which row is still undelivered, which conversation a `reopen` was
 * refused about — all of it is the chat's own record, and a second opinion
 * anywhere else would be a second answer to what a message said. These two are
 * different because each is HALF a chat verb and HALF a property write, and
 * until this lane the composition root was the only place both halves were in
 * hand. It is this module now.
 *
 * ## The ORDERS are opposite, and each is the guarantee
 *
 * {@link startAgentSession} opens the conversation FIRST: `newSession` has
 * RESOLVED by the time the state is read, so the id written down is a
 * conversation that exists. The other order would leave a property naming a
 * session nobody opened every time the agent failed to start.
 *
 * {@link assignSession} writes the property FIRST, because nothing has to be
 * opened — both halves are about things that already exist — and the durable one
 * is the assignment: the property IS it, so a mark written before a write that
 * then failed would be a session believing it had been assigned to a node that
 * never claimed it.
 *
 * ## AND THE REFUSAL IS READ HERE, against the roster rather than the tab
 *
 * A node already talking through a conversation keeps it, and *one agent, one
 * current session* is the whole sentence. The list dims such a node where
 * somebody can see it before pressing, which is a courtesy; this is the check
 * that must not be racing, because a tab decides against the frame it was drawn
 * on and two tabs can be looking at one node.
 */

import { type OpFailure, sessionValue, UsageFailure } from "@olai/format"
import { Effect } from "effect"

import type { Chat } from "../scoped.ts"

/** WHAT A BINDING NEEDS BESIDES THE PANEL — the roster's reading of the node,
 *  and the one property write. Both are handed in rather than reached for, which
 *  is what lets a bench drive these two orders without a store. */
export interface Binding {
  /** What the vault says this node is bound to right now, or `null`. */
  readonly boundAt: (
    node: string,
  ) => { readonly engine: string; readonly session: string | null; readonly title: string } | null
  /**
   * WHICH KEY THIS VAULT KEEPS ITS BINDINGS UNDER — for the refusal below, and
   * for nothing else here.
   *
   * A FUNCTION rather than a string, because the answer moves: the key is a
   * DECLARATION now ({@link ../kinds.ts}), so a row landing in
   * `_olai/Properties.olai` between one gesture and the next changes it, and a
   * value captured when this record was built would be the sentence naming a
   * column the board has moved past. The carrier that resolves it per revision
   * is `./agents.ts`.
   *
   * IT IS NOT WHAT {@link Binding.write} WRITES UNDER, and the separation is
   * deliberate rather than an omission: the write goes through a door that was
   * handed the key where the roster resolved it, so this half never has to be
   * right about a key for anything to land — it only has to be right about a
   * key for the sentence to be helpful.
   */
  readonly key: () => string
  /** ONE PROPERTY, WRITTEN, through the gate a keystroke goes through. */
  readonly write: (node: string, value: string) => Effect.Effect<void, OpFailure>
}

/**
 * A NODE AGENT'S SESSION, STARTED — and, on a node that already had one, the
 * *fresh session* affordance, which is the same two acts.
 *
 * What the bound case owes besides is the LINEAGE: the conversation being
 * replaced must not come back as a chat nobody claims. So the binding is read
 * BEFORE the open, because by the time the property has been rewritten the
 * roster's answer is the new session — and only a node that WAS bound has a
 * predecessor, and only to a conversation that is not the one just opened. An
 * agent that answers `session/new` with an id it already had (the scripted one
 * does) must not supersede a session with itself.
 *
 * NOT CONDITIONAL. The write overwrites whatever the key holds: the property is
 * what the person just pressed a menu entry to set, and the value it held is the
 * engine that press named anyway.
 */
export const startAgentSession = (
  chat: Chat,
  binding: Binding,
  input: { readonly node: string; readonly agent: string },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const was = binding.boundAt(input.node)
    yield* chat.startAgentSession(input.node, input.agent)
    const now = chat.state().session
    if (now === null) {
      return yield* new UsageFailure({
        reason: `${input.agent} opened no conversation to bind to this node`,
      })
    }
    yield* binding.write(input.node, sessionValue(input.agent, now.id))
    if (was?.session != null && was.session !== now.id) {
      yield* chat.replaced({ agent: was.engine, session: was.session }, now.id)
    }
  })

/**
 * A CONVERSATION THAT ALREADY EXISTS, GIVEN A NODE — the migration gesture.
 *
 * THE VALUE IS WRITTEN WHOLE — engine and session — so a node that named another
 * engine is re-pointed rather than left naming one engine and another's
 * conversation.
 *
 * The mark goes AFTER the write and never refuses: the assignment has landed,
 * and a mark that could not be written costs the migration contract rather than
 * the binding.
 */
export const assignSession = (
  chat: Chat,
  binding: Binding,
  input: {
    readonly node: string
    readonly agent: string
    readonly session: string
  },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const held = binding.boundAt(input.node)
    if (held?.session != null) {
      return yield* new UsageFailure({
        reason: `“${held.title}” is already talking through a conversation — `
          + `one agent, one current session. Give it a fresh session from the panel, `
          + `or take the session off its \`${binding.key()}\` property first.`,
      })
    }
    yield* binding.write(input.node, sessionValue(input.agent, input.session))
    yield* chat.assignedTo(input.node, { agent: input.agent, session: input.session })
  })
