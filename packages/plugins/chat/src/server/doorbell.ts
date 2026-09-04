/**
 * A SCOPE ITS DOORBELL CANNOT WATCH — found here, said by the plugin whose
 * doorbell it is, once.
 *
 * ## Why this end is the one that detects
 *
 * Chat owns the PICKS (`../scopes.ts`), the vault's revision reaches it on the
 * `Vault` door, and the KINDS a doorbell can watch are a declaration the ringing
 * plugin made into `Wakes`. All three are in hand here and in no other one
 * place. A doorbell asked to notice its own file had gone would be a doorbell
 * deriving from a file it cannot find, which is precisely the state that
 * produces no signal at all — that is the defect, not a place to fix it.
 *
 * ## TWO CAUSES, ONE WALK
 *
 * The file is not in the set at all — renamed, moved, deleted — or it is in the
 * set and is not one of the kinds that doorbell declared. The second is the
 * state the picker used to be able to produce: every served file was offered, so
 * a person could scope a conversation to a `.md`, and a wake that derives its
 * set from a file's NODES then watched the empty set for ever while the
 * heartbeat went on reporting a live watcher. The picker offers only the
 * declared kinds now; this arm answers for the picks stored before it did, and
 * for a stale tab or a hand-edited record.
 *
 * GONE IS ASKED FIRST, because a file that is not served has no kind and
 * "renamed" is the more actionable of the two things to be told.
 *
 * ## `served` IS THE SET, NOT THE RECORDS
 *
 * "Still served" is asked of every file the directory holds a place for. A
 * grouping of PARSED RECORDS has no entry for a file that is present and EMPTY —
 * or present and torn — and a scope pointed at one would read as gone: a person
 * who emptied their lane file for a minute would be told their doorbell had
 * broken, and told again never, because the mark is a once.
 *
 * ## A ROW WHOSE TENANT CANNOT SPEAK IS NOT MARKED
 *
 * The declarations hold an entry only for a plugin this serve COMPOSED and that
 * made one, so a serve run without a tenant leaves its rows alone rather than
 * burning their one signal unheard. A name with no entry gets nothing said, and
 * there is no sentence here for core to reach for on its behalf.
 */

import type { Wake } from "@olai/plugin-api/services"
import { watchable } from "@olai/surface"
import { Effect } from "effect"

import type { Chat } from "../scoped.ts"

/** What a walk needs about the world — the two readings this module does not
 *  take for itself, so a bench can hand it both. */
export interface World {
  /** Is this file still one the directory serves? */
  readonly served: (file: string) => boolean
  /** ...and what each ringing plugin declared, keyed by its name. */
  readonly declared: ReadonlyMap<string, Wake>
}

/**
 * MARK EVERY SCOPE THIS REVISION BROKE, and say so once into each conversation.
 *
 * The SENTENCE is indexed by the cause the walk recorded on the row, never
 * chosen between arms here: the declaration is keyed by the fault's own word, so
 * this cannot answer for a cause nobody wrote a sentence for — a third one is a
 * type error in every plugin that rings, where a ternary would have fallen
 * through and told somebody their file was renamed while it sat in front of
 * them.
 *
 * THE BODY IS A THUNK, ASKED WHEN THE WORDS GO IN, which is the whole reason
 * `deliver` takes one: it may wait out a running turn, or wait for somebody to
 * open the conversation at all, and by then the file may be back. A scope that
 * healed is on its plugin's door again, so its absence from that list is what
 * "still broken" means — and answering `null` keeps the sentence out of the
 * transcript rather than telling a person their doorbell is broken over a strip
 * that is already drawing it fine.
 *
 * NO COALESCING KEY. A held body with one replaces the last body under it, which
 * is right for a digest that re-derives itself and wrong for this: two faults on
 * one conversation are two separate things that happened, and the second must
 * not swallow the first.
 *
 * THE PAIR AND NOT THE ROW. A delivery is addressed to a conversation, and
 * handing the whole scope over would put the plugin's own `plugin` and `file`
 * columns on an address — the caller's question answered a second time, in the
 * one place the keying is the safety property.
 */
export const faultedIn = (chat: Chat, world: World): Effect.Effect<void> =>
  Effect.flatMap(
    chat.faults(
      (plugin, file) => {
        if (!world.served(file)) return "gone"
        // THE DECLARATION, ASKED THE WAY THE PICKER ASKS IT — `watchable` is the
        // wire member's own reading, shared rather than spelled here because
        // these two are the ends that must agree: a serve judging by a rule of
        // its own would fault on a pick the browser had just offered.
        const kinds = world.declared.get(plugin)?.kinds
        if (kinds === undefined) return null
        return watchable(kinds, file) ? null : "unwatchable"
      },
      (plugin) => world.declared.has(plugin),
    ),
    (fell) =>
      Effect.forEach(fell, (row) => {
        const wake = world.declared.get(row.plugin)
        if (wake === undefined) return Effect.void
        const words = wake.faults[row.fault]
        const healed = (): boolean =>
          chat.doorFor(row.plugin).scopes().some((one) =>
            one.agent === row.agent && one.session === row.session && one.file === row.file
          )
        const still = (): string | null => healed() ? null : words
        return chat.doorFor(row.plugin)
          .deliver({ agent: row.agent, session: row.session }, still)
      }, { discard: true }),
  )

/**
 * WHOSE DOORBELL A CONVERSATION MAY BE POINTED AT — the gate on the one member
 * that writes a pick.
 *
 * ## Why the check is HERE and nowhere below
 *
 * This is the only place that has the composed list. A name this serve did not
 * compose, or one whose half declares no wake, would store a row nothing will
 * ever read — kept against the cap of a record that has one — and the doorbell
 * that would have read it does not exist. Refused in words, the same treatment
 * `chooseAgent` gives an agent id this machine does not have: a stale tab is not
 * a fault.
 *
 * ## TWO REFUSALS, one sentence, and the arms are different facts
 *
 * A BUILT plugin left out of `--plugins` is one of them — the roster still
 * carries its row so preferences can say it is off, and a picker drawn from a
 * stale tab could still name it — so the refusal is about THIS SERVE rather than
 * about the build. The other is a plugin that IS composed and declares no wake,
 * which is a whole plugin: no strip row, no picker, no sentence. Both land here
 * because both mean the same thing to the person who pressed: nothing will read
 * what you just asked for.
 *
 * ## THE CONVERSATION GOES STRAIGHT THROUGH
 *
 * As the pair it arrived as. What this end must NOT do is substitute "whichever
 * conversation is open": the panel's session can move under a picker somebody
 * left open, and the chat is where that race is answered.
 */
export const scopeThrough = (
  chat: Chat,
  declared: ReadonlyMap<string, Wake>,
  input: {
    readonly agent: string
    readonly session: string
    readonly plugin: string
    readonly file: string | null
  },
): Effect.Effect<void, { readonly reason: string }> =>
  declared.has(input.plugin)
    ? chat.scope({ agent: input.agent, session: input.session }, input.plugin, input.file)
    : Effect.fail({
      reason: `no plugin called \`${input.plugin}\` rings a conversation here`,
    })
