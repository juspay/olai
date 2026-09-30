/**
 * THE THREE GESTURES THAT BIND A NODE TO A CONVERSATION — the only verbs on
 * this plugin's surface that are two acts rather than a pass-through.
 *
 * ## Why they are composed at all
 *
 * Every other verb here hands the call straight to the panel: what a chunk
 * MEANS, which row is still undelivered, which conversation a `reopen` was
 * refused about — all of it is the chat's own record, and a second opinion
 * anywhere else would be a second answer to what a message said. These are
 * different because each is HALF a chat verb and HALF a property write, and
 * until this lane the composition root was the only place both halves were in
 * hand. It is this module now.
 *
 * ## The ORDERS are opposite, and each is the guarantee
 *
 * {@link startAgentSession} writes a session id only after opening succeeds.
 * An auth-refused first start writes only the engine, allowing the node panel
 * to be read before a session exists. The node-owned retry retains the binding
 * completion and predecessor; signing in retries that exact open, then commits
 * its real session id and lineage. Other refusals still write nothing.
 *
 * {@link assignSession} writes the property FIRST, because nothing has to be
 * opened — both halves are about things that already exist — and the durable one
 * is the assignment: the property IS it, so a mark written before a write that
 * then failed would be a session believing it had been assigned to a node that
 * never claimed it.
 *
 * {@link closeAgent} is one act: the property taken OFF. Nothing has to be
 * opened and nothing has to be recorded — releasing is not superseding, and
 * the seat the property justified closes by the same reading that opened it.
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

import type { Conversing } from "../sessions.ts"
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
  /** Serialize binding claims, including a completion reached after sign-in. */
  readonly exclusive: <A>(work: Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  readonly changed?: Effect.Effect<void, OpFailure>
  /** ONE PROPERTY, WRITTEN, through the gate a keystroke goes through. */
  readonly write: (node: string, value: string) => Effect.Effect<void, OpFailure>
  /** ONE PROPERTY, TAKEN OFF — the same door, spelled the op's own removal
   *  way: an empty value removes the key exactly as `null` does. Refuses,
   *  like any removal of a key that is not there, when no binding exists. */
  readonly remove: (node: string) => Effect.Effect<void, OpFailure>
}

/** RELEASE a node agent: take the binding property off. Nothing else happens —
 *  no supersession is recorded (releasing is not fresh-starting), the subtree
 *  memory is untouched, and the conversation the node was in becomes an
 *  unclaimed chat again, filed back into Chats by the next filer run, where
 *  it lives on as its own filed node. The seat the property justified closes
 *  by the same revision-driven reading that opened it, so this needs no chat
 *  handle at all.
 *
 * Refuses when no node agent is bound: a close that would write the removal of
 * a key that is not there is a gesture on something that is not on the node. */
export const closeAgent = (
  binding: Binding,
  input: { readonly node: string },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const at = binding.boundAt(input.node)
    if (at === null) {
      return yield* new UsageFailure({ reason: `no node agent is bound to this node to close` })
    }
    yield* binding.remove(input.node)
  })

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
 * The write replaces the binding the gesture observed, under the shared claim
 * permit. A delayed sign-in must not overwrite a binding changed by another
 * gesture while authentication was pending.
 */
export const startAgentSession = (
  chat: Chat,
  binding: Binding,
  input: { readonly node: string; readonly agent: string },
): Effect.Effect<Conversing | null, OpFailure> =>
  Effect.gen(function*() {
    const was = yield* binding.exclusive(Effect.sync(() => binding.boundAt(input.node)))
    let expected = was
    const unchanged = () => {
      const at = binding.boundAt(input.node)
      return at?.engine === expected?.engine && at?.session === expected?.session
    }
    const now = yield* chat.startAgentSession(input.node, input.agent, now => Effect.gen(function*() {
      yield* binding.exclusive(Effect.gen(function*() {
        if (!unchanged()) return yield* new UsageFailure({ reason: "the node's binding changed while this chat was opening" })
        yield* binding.write(input.node, sessionValue(now.agent, now.session))
        if (was?.session != null && (was.engine !== now.agent || was.session !== now.session)) {
          yield* chat.replaced({ agent: was.engine, session: was.session }, now)
        }
      }))
      if (binding.changed !== undefined) yield* binding.changed
    }))
    // Only the engine is durable before authentication. No invented session
    // id is written, and a fresh start keeps its predecessor until it succeeds.
    if (now === null && was === null) yield* binding.exclusive(Effect.gen(function*() {
      if (!unchanged()) return yield* new UsageFailure({ reason: "the node's binding changed while this chat was opening" })
      yield* binding.write(input.node, sessionValue(input.agent, null))
      expected = { engine: input.agent, session: null, title: "" }
    }))
    return now
  })
