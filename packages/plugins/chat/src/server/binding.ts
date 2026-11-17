/**
 * THE THREE GESTURES THAT TIE AN ITEM TO A CONVERSATION — the only verbs on
 * this plugin's surface that are two acts rather than a pass-through.
 *
 * ## Why they are composed at all
 *
 * Every other verb here hands the call straight to the panel: what a chunk
 * MEANS, which row is still undelivered, which conversation a `reopen` was
 * refused about — all of it is the chat's own record, and a second opinion
 * anywhere else would be a second answer to what a message said. These are
 * different because each is HALF a chat verb and HALF a write of the tie, and
 * until this lane the composition root was the only place both halves were in
 * hand. It is this module now.
 *
 * ## TWO THINGS CARRY A TIE, and the write is not the same write
 *
 * A NODE keeps it as a property on its row, which is one `prop` op. A NOTE
 * keeps it in the YAML block at the top of the `.md`, which is the whole
 * document rewritten: `matterWith` sets the key in place and leaves every other
 * byte alone, and the write is CONDITIONAL on the text it was derived from, so
 * an editor that saved between the read and the write is refused rather than
 * overwritten. {@link tied} is the one place that branch is spelled, and it is
 * spelled off the item KEY — so a gesture names an item and never a mechanism.
 *
 * ONE RE-READ AND ONE RETRY, and no more: the conflict a retry answers is olai
 * itself writing twice in a breath (a start and the sleep mark, say), which is
 * gone by the second read. A file somebody is typing into will still be typed
 * into on a third attempt, and a loop that kept going would be this plugin
 * arguing with a person's editor.
 *
 * ## The ORDERS are opposite, and each is the guarantee
 *
 * {@link startAgentSession} writes a session id only after opening succeeds.
 * An auth-refused first start writes only the engine, allowing the panel
 * to be read before a session exists. The item-owned retry retains the tie's
 * completion and predecessor; signing in retries that exact open, then commits
 * its real session id and lineage. Other refusals still write nothing: the
 * words a person typed stay in the box that sent them, and the item is left
 * exactly as it was.
 *
 * {@link closeAgent} is one act: the tie taken OFF — and on a note that is BOTH
 * of its keys, because the switch that says where its chat opens is a fact
 * about a chat it no longer has. Nothing has to be opened and nothing has to be
 * recorded — releasing is not superseding, and the seat the tie justified
 * closes by the same reading that opened it.
 *
 * ## AND THE REFUSAL IS READ HERE, against the roster rather than the tab
 *
 * An item already talking through a conversation keeps it, and *one agent, one
 * current session* is the whole sentence. The list dims such a row where
 * somebody can see it before pressing, which is a courtesy; this is the check
 * that must not be racing, because a tab decides against the frame it was drawn
 * on and two tabs can be looking at one item.
 */

import { itemOf, matterWith, type OpFailure, sessionValue, UsageFailure } from "@olai/format"
import { Effect } from "effect"

import type { Conversing } from "../sessions.ts"
import type { Chat } from "../scoped.ts"

/** WHAT A BINDING NEEDS BESIDES THE PANEL — the roster's reading of the item,
 *  and the two doors a tie is written through. All of it is handed in rather
 *  than reached for, which is what lets a bench drive these orders without a
 *  store. */
export interface Binding {
  /** What the vault says this item is tied to right now, or `null` — asked by
   *  ITEM KEY (a node's id, or `/` and a note's path). */
  readonly boundAt: (
    item: string,
  ) => { readonly engine: string; readonly session: string | null; readonly title: string } | null
  /**
   * WHICH KEY THIS VAULT KEEPS ITS TIES UNDER — for the refusal below, for the
   * note writer, and for nothing else here.
   *
   * A FUNCTION rather than a string, because the answer moves: the key is a
   * DECLARATION now ({@link ../kinds.ts}), so a row landing in
   * `_olai/Properties.olai` between one gesture and the next changes it, and a
   * value captured when this record was built would be the sentence naming a
   * column the board has moved past. The carrier that resolves it per revision
   * is `./agents.ts`.
   *
   * IT IS NOT WHAT {@link Binding.write} WRITES UNDER, and the separation is
   * deliberate rather than an omission: the row write goes through a door that
   * was handed the key where the roster resolved it, so this half never has to
   * be right about a key for a property to land — it only has to be right for
   * the sentence to be helpful, and for the note's front matter, which this
   * module composes itself.
   */
  readonly key: () => string
  /** ...AND THE KEY A NOTE'S *opens* SWITCH IS WRITTEN UNDER, for the one
   *  gesture that touches it here: closing a note's chat takes it off with the
   *  tie (`./agents.ts`'s `opensKey`). */
  readonly opensKey: () => string
  /** Serialize binding claims, including a completion reached after sign-in. */
  readonly exclusive: <A>(work: Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  readonly changed?: Effect.Effect<void, OpFailure>
  /** ONE PROPERTY, WRITTEN, through the gate a keystroke goes through — the
   *  NODE half of a tie. */
  readonly write: (node: string, value: string) => Effect.Effect<void, OpFailure>
  /** ONE PROPERTY, TAKEN OFF — the same door, spelled the op's own removal
   *  way: an empty value removes the key exactly as `null` does. Refuses,
   *  like any removal of a key that is not there, when no tie exists. */
  readonly remove: (node: string) => Effect.Effect<void, OpFailure>
  /**
   * THE SLEEPING MARK, WRITTEN — a third kind, one field over from the tie
   * and the same door: `on` marks this chat, and an empty value takes the mark
   * off, which is what "off" means (`./agents.ts`'s `sleeps` reads the absence).
   */
  readonly mark: (node: string, value: string) => Effect.Effect<void, OpFailure>
  /** A NOTE'S TEXT AS THE GATE HOLDS IT NOW, or `null` for a path the
   *  directory no longer holds — a FRESH read, which is what makes the one
   *  retry below see the write that beat it. */
  readonly text: (path: string) => Effect.Effect<string | null, OpFailure>
  /** ...AND THE DOCUMENT, WRITTEN WHOLE, conditional on the text it was derived
   *  from: the same `{ op: "doc" }` an editor's save goes through, so a file
   *  that moved under this gesture refuses rather than losing somebody's words. */
  readonly doc: (path: string, text: string, was: string) => Effect.Effect<void, OpFailure>
}

/** WHAT SLEEP IS NOT OFFERED ON — the one sentence the three sleeping verbs
 *  refuse a note with, said once so a person reads the same words whichever
 *  one they reached for. A note IS the memory of its chat: there are no rows
 *  under it to consolidate, and tidying it would be olai rewriting a file
 *  somebody keeps by hand. */
export const NO_SLEEP_ON_A_NOTE =
  "a note's chat keeps its memory in the note itself, so olai never tidies it or puts it to sleep"

/**
 * THE TIE, WRITTEN OR TAKEN OFF, on whichever of the two things carries it —
 * the one place the branch is spelled.
 *
 * `null` is the removal, and on a NOTE it takes the *opens* switch with it: the
 * switch says where that note's chat opens, and a note with no chat has no
 * answer to give. A node's removal is the property op's own, which refuses a
 * key that is not there.
 */
const tied = (
  binding: Binding,
  item: string,
  value: string | null,
): Effect.Effect<void, OpFailure> => {
  const at = itemOf(item)
  if (at.kind === "node") return value === null ? binding.remove(at.id) : binding.write(at.id, value)
  return matterWritten(
    binding,
    at.path,
    value === null
      ? [[binding.key(), null], [binding.opensKey(), null]]
      : [[binding.key(), value]],
  )
}

/**
 * ONE NOTE'S FRONT MATTER, REWRITTEN — read what the gate holds, set or remove
 * the keys, write the whole document back against the text it was derived from.
 *
 * THE WRITE THAT CHANGES NOTHING IS NOT MADE: `matterWith` is total, so a tie
 * being removed from a note that has not got one composes the text that is
 * already there — and a document write with the same bytes would be a revision,
 * a commit and a reader's "this file changed" for nothing.
 *
 * THE RETRY IS GUARDED BY THE RE-READ rather than by the sentence a refusal
 * carries: if the file still says what this write expected, the refusal was
 * about something else (a door, a validation) and is the answer; if it says
 * something else, the edit is re-derived from what it says NOW and tried once.
 *
 * EXPORTED for the one-time move (`./move.ts`), which writes a tie into a note
 * the same way for the same reasons and must not grow a second spelling of
 * this read-compose-write.
 */
export const matterWritten = (
  binding: Pick<Binding, "text" | "doc">,
  path: string,
  changes: ReadonlyArray<readonly [key: string, value: string | null]>,
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const was = yield* binding.text(path)
    if (was === null) {
      return yield* new UsageFailure({ reason: `olai no longer holds \`${path}\`` })
    }
    const next = matterWith(was, changes)
    if (next === was) return
    const wrote = yield* Effect.result(binding.doc(path, next, was))
    if (wrote._tag === "Success") return
    const now = yield* binding.text(path)
    if (now === null || now === was) return yield* wrote.failure
    const again = matterWith(now, changes)
    if (again === now) return
    yield* binding.doc(path, again, now)
  })

/** RELEASE an item's agent: take the tie off. Nothing else happens —
 *  no supersession is recorded (releasing is not fresh-starting), the memory is
 *  untouched, and the conversation becomes a chat nobody claims. The seat the
 *  tie justified closes by the same revision-driven reading that opened it, so
 *  this needs no chat handle at all.
 *
 * Refuses when nothing is tied there: a close that would write the removal of
 * a key that is not there is a gesture on something that is not on the item. */
export const closeAgent = (
  binding: Binding,
  input: { readonly node: string },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    const at = binding.boundAt(input.node)
    if (at === null) {
      return yield* new UsageFailure({ reason: `no node agent is bound to this node to close` })
    }
    yield* tied(binding, input.node, null)
  })

/**
 * SAY WHETHER THIS CHAT IS TIDIED ON ITS OWN — the mark *Sleep when idle* sets
 * and *Stop sleeping when idle* takes off.
 *
 * ONE ACT, like {@link closeAgent}: the property IS the state, so there is
 * nothing to open and nothing to record, and a write that then failed would
 * leave the mark exactly where it was. Taking it off is the key REMOVED rather
 * than written as `off`, because the reading treats the two as one answer and a
 * drawer with one spelling of "no" is one thing for a person to find.
 *
 * Refuses when nothing is tied there, for {@link closeAgent}'s reason: a
 * mark on a row with no conversation is a promise about a chat that is not
 * there — and a person who pressed the verb would be told so rather than left
 * wondering which row the mark landed on.
 *
 * ...AND IT REFUSES A NOTE OUTRIGHT ({@link NO_SLEEP_ON_A_NOTE}): there is
 * nothing under a note to tidy, so a mark saying olai may tidy it would be a
 * promise with no pass behind it.
 */
export const setSleeping = (
  binding: Binding,
  input: { readonly node: string; readonly on: boolean },
): Effect.Effect<void, OpFailure> =>
  Effect.gen(function*() {
    if (itemOf(input.node).kind === "note") {
      return yield* new UsageFailure({ reason: NO_SLEEP_ON_A_NOTE })
    }
    if (binding.boundAt(input.node) === null) {
      return yield* new UsageFailure({ reason: `no node agent is bound to this node to mark` })
    }
    yield* binding.mark(input.node, input.on ? "on" : "")
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
        yield* tied(binding, input.node, sessionValue(now.agent, now.session))
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
      yield* tied(binding, input.node, sessionValue(input.agent, null))
      expected = { engine: input.agent, session: null, title: "" }
    }))
    return now
  })
