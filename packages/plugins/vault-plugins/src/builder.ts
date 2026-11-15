/**
 * THE CONVERSATION THAT BUILDS A PLUGIN — reached through a key, never through
 * an import.
 *
 * ## `vault-plugins` must not import chat, and this is how it does not
 *
 * Starting a builder, speaking into it and docking it are three things chat
 * owns. This row names them with `serviceTag("chat.conversations")` — a KEY,
 * which is a name and not a build edge — declares it on a COMPONENT of its
 * own, and holds what the component is handed in the module below. Three
 * consequences, and all three are the point:
 *
 * - **With chat off, this row keeps running.** A `needs` on the row would take
 *   the whole of vault-plugins away with chat, which would mean a vault with
 *   no agent could not mount a plugin somebody already approved. The component
 *   waits; the row serves.
 * - **The plugins panel can say which key.** A component held `waiting` names
 *   the key it is waiting on, so *New plugin* with chat off is a sentence a
 *   person can act on rather than a button that does nothing.
 * - **A replacement is a fresh activation.** Switching chat off and on again
 *   withdraws this hold and installs the new door, by identity, so a stopped
 *   activation cannot take a live one's value away.
 *
 * ## The hold is this package's and crosses no wall
 *
 * `@olai/effect-cordis/fence`'s `live-state` claim is about modules another
 * package can OPEN. This one is not in this package's `exports`: the value
 * arrives where the dependency is declared, which is an `apply`, and is spent
 * inside a surface procedure three levels in. That is the consumer-side holder
 * the rule explicitly allows — held by the activation that declared the key,
 * released by identity, and read as `undefined` when nothing is behind it.
 */
import { serviceTag } from "@olai/plugin-api/services"
import type { Effect } from "effect"
import type { OpFailure } from "@olai/format"

/**
 * What chat offers for conversations another row starts and speaks into.
 *
 * SPELLED HERE, structurally, and satisfied by chat's own type — the same
 * arrangement every plugin-owned key in this tree has (`docs/dynamic-plugins.md`'s
 * *Sharing a plugin-owned service*). The key names a dependency; it does not
 * check a shape, so the two authors agree on one and this is this side's half
 * of the agreement.
 */
export interface Conversations {
  /**
   * Mint a conversation, start it on an engine, and send `say` as its first
   * message with `teach` riding chat's own teaching seam.
   *
   * It answers the node EVEN WHEN THE START REFUSES, because the node is the
   * durable half: a conversation that exists and could not be opened is
   * something a person can open later, and one that was never minted is a
   * plugin with nobody building it.
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

export const conversations = serviceTag<Conversations>("chat.conversations")

/** The hold — see this file's header for why it is allowed to exist and why it
 *  is not in this package's door. */
let held: Conversations | undefined

export const holdConversations = (door: Conversations): (() => void) => {
  held = door
  return () => { if (held === door) held = undefined }
}

/** `undefined` is *chat is not mounted*, and every caller draws its own absent
 *  arm for it rather than failing. */
export const builderDoor = (): Conversations | undefined => held
