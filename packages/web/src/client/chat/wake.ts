/**
 * WHAT THIS CONVERSATION WAKES ON — the join, over values, for the strip that
 * draws it.
 *
 * A doorbell is TWO facts arriving on two different members, and this is where
 * they are put together. What the wake IS — the subject, the lead-in to the
 * file, the plugin's own word for a sentence it is holding, and the KINDS of
 * file it can be pointed at — is compiled in and rides the `plugins` cell
 * (`@olai/surface`'s `BuiltPlugin`'s `wake`), because it moves at most once per
 * serve. WHICH FILE a person picked and HOW
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
 * `@olai/plugin-api`'s `fence.test.ts` holds it as an equality per package, and this
 * module is written so there is nothing for it to catch.
 *
 * ## A ROW IS OFFERED ONLY FOR A PLUGIN THAT IS RUNNING
 *
 * The roster carries a row per plugin the BUILD has, running or not, and a
 * picker offered for one this serve did not compose would store a pick nothing
 * will ever read: the half that rings is not on the wire at all. So `running`
 * gates the row here as well as on the server that copies `wake` onto it.
 *
 * TODAY THE SERVER'S GATE MAKES THIS ONE REDUNDANT, and it is kept anyway. The
 * only producer of a `PluginRoster` attaches `wake` exclusively to a row it has
 * already found to be running (`../../../../server/src/runtime.ts`'s
 * `rosterOf`), so no frame this module has ever been handed can reach the
 * `!plugin.running` half. What the guard defends is not that function: it is
 * the WIRE. This is a decoded value that arrived from somewhere, and a decoder
 * proves the shape of a row and never the agreement between two of its fields
 * — so a row that says *not running* and carries a sentence anyway is
 * well-typed, and drawing a picker off it is the exact bug the gate on the
 * server exists to prevent. A reader gating on the producer's current
 * discipline would be a reader depending on a module it does not own and cannot
 * see, and the day that discipline changes is the day nothing here fails.
 * Cheap, local, and true of what arrives rather than of who sent it.
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

import type { BuiltPlugin, ChatState, WakeFault } from "@olai/surface"

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
  /**
   * WHICH KINDS OF SERVED FILE this doorbell can be pointed at — the plugin's
   * own answer, as `@olai/format`'s kind words, and the whole of what narrows
   * the picker ({@link ./scopable.ts}).
   *
   * It is on the ROW rather than looked up where the picker is drawn for the
   * same reason every other word here is: a row is a join over two wire members,
   * and a component that reached back into the roster for one of them would be a
   * second join, in a file whose job is to draw.
   */
  readonly kinds: ReadonlyArray<string>
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
  /**
   * THIS DOORBELL IS NOT WATCHING THE FILE IT NAMES, and which of the two ways
   * — `gone` for a file renamed, moved or deleted while the doorbell was on it,
   * `unwatchable` for one that is served and is not a kind this plugin reads.
   *
   * A row in either state draws the fault instead of a live answer
   * ({@link ./Wake.tsx}), because the alternative is a control that says
   * `lanes.olai` over a conversation nothing will ever ring again — and the
   * silence underneath it is indistinguishable from the silence of a subject
   * with nothing to report. The conversation has already been told, once, in
   * the plugin's own words; this is the standing fact the strip keeps showing.
   *
   * `null` for a row nobody scoped, which is the ordinary case: a doorbell that
   * is off is not a doorbell that is broken.
   */
  readonly fault: WakeFault | null
}

/**
 * The rows to draw, in the order the build lists its plugins.
 *
 * ROSTER ORDER, and not the order the scopes arrived in: the roster is a source
 * file (`@olai/plugin-api`'s `surfaces.ts`) and the order it lists plugins in is the
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
    // NO PICK IS ZERO HELD, and that is true of the server rather than assumed
    // here: `waiting` is a field of a scope row, so a count with no pick would
    // have nowhere to be drawn — and it cannot arise, because every write to a
    // scope (a clear, a re-point, the cap evicting one) takes back the bodies
    // that scope was holding (`@olai/chat`'s `Holding.dropped`). A held body
    // therefore always has a row to be counted on.
    const waiting = mine?.waiting ?? 0
    rows.push({
      name: plugin.name,
      subject: wake.subject,
      from: wake.from,
      // NO DECLARATION IS NO OFFER, which is the honest reading of an absent
      // key: this tab is talking to a serve that never said which files its
      // doorbell can watch (`@olai/surface`'s `BuiltPlugin` argues why that is
      // possible at all). An empty list matches no path, so the picker opens
      // and offers nothing — where a missing filter would offer everything,
      // which is the defect.
      kinds: wake.kinds ?? [],
      file: mine?.file ?? null,
      waiting,
      // OFF IS NOT BROKEN. A row with no pick behind it carries `null`,
      // because there is no file for a fault to be about — the fault is a fact
      // about a scope, and a conversation nobody scoped has none.
      fault: mine?.fault ?? null,
      held: waiting > 0
        ? `${waiting} ${waiting === 1 ? wake.waiting.one : wake.waiting.many}`
        : null,
    })
  }
  return rows
}
