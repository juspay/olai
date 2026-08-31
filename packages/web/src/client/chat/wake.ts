/**
 * WHAT THIS CONVERSATION WAKES ON — the join, over values, for the strip that
 * draws it.
 *
 * A doorbell is TWO facts arriving on two different members, and this is where
 * they are put together. What the wake IS — the subject, the lead-in to the
 * file, and the plugin's own word for a sentence it is holding — is compiled in
 * and rides the `plugins` cell (`@olai/surface`'s `BuiltPlugin`'s `wake`),
 * because it moves at most once per serve. WHICH FILE a person picked and HOW
 * MANY sentences this end is holding ride `ChatState.wake`, because they move
 * per conversation and per turn. A row on screen needs both, and neither cell
 * can answer for the other.
 *
 * ## NOTHING HERE SPELLS A PLUGIN'S NAME
 *
 * Every word in a row comes off the wire. Core supplies the arrangement, the
 * numeral and the punctuation, and not one noun — which is why the sentence
 * arrives in three pieces rather than as one string with a hole in it: a hole
 * would make core the author of everything around it. The same restraint the
 * settings panel's rows keep (`../settings/plugins.ts`), for the same reason —
 * `@olai/plugins`' `fence.test.ts` holds it as an equality per package, and this
 * module is written so there is nothing for it to catch.
 *
 * ## A ROW IS OFFERED ONLY FOR A PLUGIN THAT IS RUNNING
 *
 * The roster carries a row per plugin the BUILD has, running or not, and a
 * picker offered for one this serve did not compose would store a pick nothing
 * will ever read: the half that rings is not on the wire at all. So `running`
 * gates the row here as well as on the server that copies `wake` onto it — the
 * server's gate is what keeps the pick from being stored, and this one is what
 * keeps it from being offered.
 *
 * ## AND `off` IS A ROW, not an absence
 *
 * A conversation nobody has scoped has no `ChatState.wake` entry, which is the
 * honest default and the state nearly every conversation is in — see the
 * dispatch ruling this feature was built under: manual, per conversation, no
 * serve-level default. The row is still drawn, saying so, because the whole
 * point of a control is that a person can find it before they have used it.
 * What is absent is the STRIP, and only where there is no conversation to be
 * scoped ({@link ./Wake.tsx}).
 *
 * A module rather than a ternary in the component, for {@link ./busy.ts}'s
 * reason: this is a small join over two wire members, and reaching it through a
 * browser is not how anybody should have to check that a plugin that is off
 * offers no picker.
 */

import type { BuiltPlugin, ChatState } from "@olai/surface"

/** One conversation's scope as the server holds it — `ChatState.wake`'s own
 *  element, named here rather than re-declared, so the two cannot drift. */
type Scoped = ChatState["wake"][number]

/**
 * ONE DOORBELL, as a row is drawn from it: whose it is, what it says, what it
 * is pointed at, and what it is holding.
 *
 * The plugin's three strings are copied in flat rather than nested, because
 * what a row wants off this is words — `ringer.subject`, not
 * `ringer.wake.subject` — and the two halves it was joined out of are of no
 * further interest to anything downstream.
 */
export interface Ringer {
  /** WHOSE — the plugin's own `name`, as data. What the scope verb is called
   *  with, and what a scenario reads off `data-plugin`. */
  readonly name: string
  /** What the wake is ON, in the plugin's words. It leads the row. */
  readonly subject: string
  /** ... and its lead-in to the file, drawn only where there is a file. */
  readonly from: string
  /** The file a person picked, root-relative and `/`-spelled — or `null`, which
   *  is the doorbell OFF and is what a fresh conversation reads. */
  readonly file: string | null
  /** How many of this plugin's sentences this end is holding. Zero nearly
   *  always: it is nonzero while a turn is running, and while nobody is in the
   *  conversation at all. */
  readonly waiting: number
  /**
   * ... and what those are, in the plugin's own words with core's numeral in
   * front — `2 fleet events waiting`. `null` where nothing is held, so a row
   * that has nothing to report draws nothing rather than a zero.
   *
   * CORE OWNS THE NUMERAL AND NOTHING ELSE. Which of the two forms to use is
   * arithmetic and belongs here; what is being counted is a word only the
   * plugin has.
   */
  readonly held: string | null
}

/**
 * The rows to draw, in the order the build lists its plugins.
 *
 * ROSTER ORDER, and not the order the scopes arrived in: the roster is a source
 * file (`@olai/plugins`' `surfaces.ts`) and the order it lists plugins in is the
 * order `--help` names them in, while `ChatState.wake` is written as people
 * pick — so ordering by the scopes would move a row somebody was reading when
 * an unrelated one was scoped.
 *
 * A scope naming a plugin the roster has no running row for is DROPPED rather
 * than drawn nameless: it is a pick made before this serve was started without
 * that plugin, and there is nothing to say about it here — no subject, no
 * word for what is waiting, and no half alive to ring. The stored pick is not
 * lost by it; it is simply not offered.
 */
export const ringersOf = (
  built: ReadonlyArray<BuiltPlugin>,
  scoped: ReadonlyArray<Scoped>,
): ReadonlyArray<Ringer> => {
  const picked = new Map(scoped.map((one) => [one.name, one]))
  const rows: Array<Ringer> = []
  for (const plugin of built) {
    const wake = plugin.wake
    if (!plugin.running || wake === undefined) continue
    const mine = picked.get(plugin.name)
    const waiting = mine?.waiting ?? 0
    rows.push({
      name: plugin.name,
      subject: wake.subject,
      from: wake.from,
      file: mine?.file ?? null,
      waiting,
      held: waiting > 0
        ? `${waiting} ${waiting === 1 ? wake.waiting.one : wake.waiting.many}`
        : null,
    })
  }
  return rows
}
