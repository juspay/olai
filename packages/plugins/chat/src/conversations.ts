/**
 * `chat.conversations` — STARTING ONE, SPEAKING INTO IT, AND WHAT CAN BE
 * STARTED AT ALL, as a row that is not chat may ask for them.
 *
 * ## Why a declared key and not an import
 *
 * Another row wanting a conversation had exactly two ways to get one before
 * this door, and both were wrong in the way `docs/architecture/cordis.md`'s
 * *imports are not live dependencies* is about. It could reach the surface
 * procedure (`conversation.newChat`), which is a BROWSER face: a person
 * pressing a button, with a tab, a wire and a session behind it — nothing a
 * server-side row can spell. Or it could import this package and call the
 * scheduler, which hands a module's code to a consumer that never declared it
 * needs chat, keeps nothing alive, and goes on answering out of a plugin
 * somebody has switched off.
 *
 * So this is a KEY. A consumer mints the same name with `serviceTag`, declares
 * it on a COMPONENT of its own, and is handed the live value by the runtime —
 * which means three things, and all three are the reason the door is shaped
 * this way:
 *
 *   - **With chat off, the consumer waits.** A component held `waiting` names
 *     the key it is waiting on, so a panel can say *chat.conversations* rather
 *     than drawing a button that does nothing. Absence is a STATE here, never
 *     a failure, and never a silent no-op.
 *   - **A replacement is a fresh activation.** Chat off and on again withdraws
 *     the old value and installs the new one, so a consumer holding the first
 *     cannot speak into a scheduler that has stopped.
 *   - **The caller is NAMED without saying its name.** Every verb below is
 *     stamped with the consuming plugin's own word by the runtime
 *     (`@olai/plugin-api`'s `Offers.own`, which reads it off the asking
 *     fiber), so a message a plugin delivers carries that plugin as its
 *     `rang` and no row can sign another's name to one.
 *
 * ## STATIC, and that is the whole of this module
 *
 * No live value, no import of this package's runtime, nothing here that holds
 * state: one interface and one key, exactly as {@link ./attention.ts} and
 * {@link ./browser-engines.ts} are on the browser's side of the same fence.
 * A consumer's walk through this door reaches a type and a string.
 *
 * ## The shape, and why each verb is the shape it is
 *
 * {@link Conversations.open} is the three-act mint a person's *New chat* makes
 * — a node, a binding, a session — and it answers the NODE even when the start
 * refuses, because the node is the durable half: a conversation that exists
 * and could not be opened is something somebody can open later, while one that
 * was never minted is a thing with nobody doing it.
 *
 * {@link Conversations.say} is WRITE-ONLY, and the absence of a reading verb is
 * the interesting half of this door. A row that could read a transcript would
 * be a row with a copy of somebody's conversation in it, outliving the chat it
 * came from and answerable to nothing; what a plugin legitimately needs is to
 * SPEAK, which lands the way `@olai/plugin-api`'s `Deliveries.deliver` lands —
 * an idle agent takes it as a turn, a running one takes it at the boundary —
 * and which arm it took is deliberately not reported back.
 *
 * {@link Conversations.engines} is the machine's answer rather than the
 * vault's: which engines are MOUNTED and can actually be started here, best
 * first. A caller that has to choose one needs the list the panel's own picker
 * draws from, and an empty list is a serve with nothing to talk to — on which
 * {@link Conversations.open} refuses in chat's own words.
 */
import type { OpFailure } from "@olai/format"
import { serviceTag } from "@olai/plugin-api/contracts"
import type { Effect } from "effect"

/** What chat offers for conversations another row starts and speaks into. */
export interface Conversations {
  /**
   * Mint a conversation, start it on an engine, and send `say` as its first
   * message with `teach` riding chat's own teaching seam.
   *
   * `parent` is the node the conversation is filed under, or `null` for the
   * Inbox's own Chats container — the same default a person's *New chat* takes.
   * `teach` is sentences, not lines: they are spelled onto the `[olai] ` seam
   * here ({@link ./teaching.ts}), ride UNDER the first message beside the
   * standing contract a node agent is taught, and are delivered exactly ONCE
   * per conversation, on the mark that already decides that question. A
   * conversation reopened later is a conversation that has been taught, so it
   * never hears the preamble twice.
   *
   * It answers the node EVEN WHEN THE START REFUSES, and `refusal` is then the
   * sentence to show beside it: no engine of that name, an agent this machine
   * cannot run, a first message the agent would not take.
   */
  readonly open: (input: {
    readonly parent: string | null
    readonly title: string
    readonly engine: string
    readonly say: string
    readonly teach: ReadonlyArray<string>
  }) => Effect.Effect<{ readonly node: string; readonly refusal: string | null }, OpFailure>
  /** Say something into the conversation seated on `node`. `false` when there
   *  is none — which a roster that moved between a draw and a press can mean. */
  readonly say: (input: { readonly node: string; readonly text: string }) => Effect.Effect<boolean>
  /** The engines this machine can actually start, best first. */
  readonly engines: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}

/** The local word chat offers it under. Composed with the row's own name by the
 *  runtime, so the whole key is spelled once, below. */
export const CONVERSATIONS = "conversations"

export const conversations = serviceTag<Conversations>("chat.conversations")
