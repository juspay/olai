/**
 * WHICH PLUGINS THIS BUILD HAS, and which this SERVE runs — the two lists as
 * one value, because the distance between them is the whole of what `--plugins`
 * means and a browser that held only one of them could not draw it.
 *
 * ## Why this is CORE'S member and not a plugin's
 *
 * A disabled plugin is ABSENT FROM THE RECORD (`@olai/plugin-api`'s README): no
 * sibling surface is composed, no tag is minted, no handler is bound, no expose
 * row is granted, and the wire carries no `surface/<name>/` at all. So the one
 * member that could answer *is kolu running* is the member kolu does not have
 * when the answer is no. The question outlives its subject, which is exactly
 * what makes it core's — the same way core owns what git policy is in force
 * rather than asking the repository.
 *
 * The alternative that lost is a `running` cell contributed by each plugin,
 * always composed and hollow when off. That is the arrangement the extraction
 * RETIRED (`@olai/server`'s `runtime.ts`, on `wiring.plugins: null`): a member
 * that is present-and-empty cannot be told apart from a member that is present
 * and has nothing to say, and it would put a tag on the wire for a plugin whose
 * whole promise is that it puts none there.
 *
 * ## A CELL, and read-only
 *
 * One value about the served INSTANCE rather than about any file in it — the
 * shape `manifest` and `git` already are. It is read once, at the composition
 * root, out of the flag and the registry; it moves at most once per serve,
 * which is why it has no connector and needs no `equals` (`@olai/server`'s
 * `runtime.ts` seeds it and nothing republishes it).
 *
 * Read-only on the wire because `--plugins` is CLI/nix ONLY — no settings file,
 * no browser toggle, the git policy's shape one setting over. What a browser
 * does with it is draw a row per plugin, frozen, naming where it is changed
 * (`@olai/web`'s `client/settings/`).
 *
 * ## NOTHING HERE SPELLS A PLUGIN'S NAME
 *
 * The names are DATA. They arrive from the registry at the composition root and
 * travel as strings; this file — a general one — declares that there ARE names
 * and knows none of them, which is the same fence `@olai/plugin-api`'s
 * `fence.test.ts` holds as an equality per package. A row is drawn by walking
 * what the cell carries, so a third plugin reaches the panel without a line of
 * this or of the panel moving.
 */

import { fileKind } from "@olai/format"
import { Schema } from "effect"

/**
 * ONE PLUGIN THIS BUILD HAS, and whether this serve runs it.
 *
 * Both halves on one row rather than two lists — the built names and the
 * running names — because two lists are two things to keep in step and a name
 * in the second that is not in the first is a state nothing on screen could
 * draw. A row that says `false` is the row the panel exists for: a plugin left
 * out of `--plugins` has no surface, no face and no probe, and an absent row
 * would be indistinguishable from a build that never had it.
 */
export const BuiltPlugin = Schema.Struct({
  /** The plugin's `name` — the namespace, the docs slug, the word `--plugins`
   *  takes and the label the row wears. One spelling, and this is it travelling
   *  (`@olai/plugin-api`'s `plugin.ts`). */
  name: Schema.String,
  /** Whether THIS serve composed it: its surface is on the wire, its faces are
   *  drawn, its probe ran, and a property declared with its kind is held to it.
   *  `false` is total absence rather than a degraded arm. */
  running: Schema.Boolean,
  /**
   * WHY, IN ONE WORD — the five states {@link pluginState} narrows to, and the
   * one thing `running` cannot say.
   *
   * A plugin is a Cordis fiber now, and `false` covers four different mornings:
   * the operator's flag left it out, the BUILD leaves it out until somebody
   * asks, its `apply` threw, or it is still waiting on a service that has not
   * arrived. Those want four different sentences under the row, and one of them
   * wants an alarm — so the word travels rather than being guessed at the far
   * end from a boolean that has already thrown the distinction away.
   *
   * `running` STAYS, and is not redundant: it is what the browser's two mount
   * licences are read out of (`@olai/web`'s `client/plugins/running.ts`), and a
   * licence must not have to know five words to answer one question. The two
   * cannot disagree — the composition root writes `running` from what actually
   * registered a sibling and derives this from the same reading.
   *
   * A PLAIN STRING, and OPTIONAL, for the two reasons `wake` is: a tab left
   * open across a downgrade is talking to a serve that declares none, and a
   * serve may one day name a sixth word this build has never heard of. Neither
   * may fail the roster's DECODE, because the roster is what every plugin's
   * mount hangs off. {@link pluginState} is the one reading, and it answers an
   * absent or unknown word out of `running` — which is exactly what this field
   * refines and never contradicts.
   */
  state: Schema.optionalKey(Schema.String),
  /**
   * ...AND THE PLUGIN'S OWN WORDS, when its start threw — verbatim, with core
   * composing nothing around them.
   *
   * Only on a row whose state is `failed`. The panel draws it under the row's
   * sentence and quotes it as the plugin's; a serve that failed a plugin with
   * no message to give sends none, and the row says a start threw without
   * inventing what it said. That is the same rule the delivery doors keep:
   * failure prose is the plugin's, and core's job is to carry it.
   */
  fault: Schema.optionalKey(Schema.String),
  /**
   * THE DOORBELL'S SENTENCE, when this plugin can wake a conversation — the
   * plugin's own words, travelling as data.
   *
   * The strip draws `<subject> · <from> <the file picker>`, and `<subject> · off`
   * where nothing is picked. Core writes no clause of it, which is why the
   * drawn half is three strings and not one: a sentence with a hole in it would
   * make core the author of everything around the hole. The fourth member is
   * not words at all — it is WHICH FILES the picker between those words may
   * offer, which is the plugin's fact for the same reason the words are.
   *
   * OPTIONAL, and that is load-bearing rather than tidy. A required field here
   * fails DECODE for a new tab talking to an older server, and the roster's
   * failed arm is what the browser's subscribe licence is read out of — so one
   * missing key would take every plugin's mount down, not just this one's.
   * Absent is also the ordinary state: a plugin that wakes nobody declares
   * none.
   *
   * ONLY ON A ROW THAT IS RUNNING. The roster carries a row per BUILT plugin,
   * and a picker offered for a plugin this serve did not compose would store a
   * pick that nothing will ever read.
   */
  wake: Schema.optionalKey(Schema.Struct({
    /** What the wake is ON — the subject, and it leads. */
    subject: Schema.String,
    /** What the file IS, as the lead-in to the picker. */
    from: Schema.String,
    /** What this plugin's held sentences are called, in both numbers. Core has
     *  the count and supplies no word for what is being counted. */
    waiting: Schema.Struct({ one: Schema.String, many: Schema.String }),
    /**
     * WHICH KINDS OF SERVED FILE THIS DOORBELL CAN BE POINTED AT —
     * `@olai/format`'s own kind words (`kinds.ts`), travelling as data.
     *
     * The one member of this struct that is not prose, and the only thing on
     * the wire that narrows the picker. A plugin derives its watched set out of
     * a file, so which files it can derive anything AT ALL from is the plugin's
     * fact and nobody else's: kolu reads the claims on a file's un-done nodes,
     * and a `.md` has none, so a conversation scoped to one watched the empty
     * set for ever while the heartbeat went on reporting a live watcher. The
     * picker offered it anyway, because core had nothing to filter by.
     *
     * The browser compares these against `fileKind`'s answer for each served
     * path (`@olai/web`'s `chat/scopable.ts`) — one table read at both ends,
     * rather than a suffix spelled at the picker.
     *
     * PLAIN STRINGS and not `FileKind` literals, though they are that: the
     * roster's decoded shape is what a browser's whole plugin mount hangs off,
     * so a serve carrying a word this build's registry does not know must
     * narrow a list rather than fail a decode. An unknown word matches no file,
     * which is a picker that offers nothing — visible, local, and nothing else
     * on the page goes down with it.
     *
     * AND OPTIONAL FOR THE SAME REASON `wake` ITSELF IS, which is the whole of
     * why it is not simply required inside a struct that is already optional. A
     * tab left open across a downgrade is talking to a serve that declared no
     * kinds at all, and a missing key there is a DECODE failure of the roster —
     * which takes every plugin's mount down, not this picker's. Absent narrows
     * to nothing instead: the strip draws, the list opens, and it offers no
     * file, which says *this control cannot be used by this tab* and cannot
     * quietly hand somebody the scope that started all this.
     */
    kinds: Schema.optionalKey(Schema.Array(Schema.String)),
  })),
})
export type BuiltPlugin = typeof BuiltPlugin.Type

/**
 * THE FIVE WORDS A ROW CAN BE IN, and each is a different morning.
 *
 *   - `running`  composed: members on the wire, faces drawn, probe run, kinds
 *                held. The ordinary state and the only one that is good news.
 *   - `off`      the operator's flag did not name it. Total absence, asked for.
 *   - `optIn`    this BUILD leaves it off until somebody asks — the row's own
 *                `disabled`, which is the built-in default living in the file
 *                the loader reads. Also total absence, and NOBODY ASKED, which
 *                is why it is not the same word as `off`: a row nobody chose is
 *                not a row somebody turned off, and only one of the two is
 *                worth a person's attention when they went looking for a chip.
 *   - `failed`   its `apply` threw. The one word that is a FAULT: it was asked
 *                for, it is absent, and nothing else on screen says so.
 *   - `waiting`  the fiber is `PENDING` on a service that has not arrived. Not
 *                reachable while everything a plugin injects is mounted before
 *                the bundle is, and declared here because the runtime that can
 *                produce it is already the one running.
 */
export type PluginState = "running" | "off" | "optIn" | "failed" | "waiting"

/** The five, as a set — the narrowing's whole vocabulary, spelled once. */
const STATES: ReadonlySet<string> = new Set<PluginState>([
  "running",
  "off",
  "optIn",
  "failed",
  "waiting",
])

/**
 * WHAT WORD A ROW IS IN — the one reading of {@link BuiltPlugin.state}, and the
 * one place an absent or unknown word is answered.
 *
 * ## Why it narrows rather than decodes
 *
 * The field is a plain optional string precisely so that neither an older serve
 * (which declares none) nor a newer one (which may name a sixth) can fail the
 * roster's decode — and a roster that fails to decode takes EVERY plugin's
 * mount down, not this row's. That decision is only worth making if somebody
 * then narrows, which is here: a word this build does not know falls back to
 * what `running` already said, so the worst a strange serve can do is draw the
 * row the way this app drew every row before the field existed.
 *
 * ## And why the fallback is `running`, not `off`
 *
 * `running` is the field the two ends have always agreed on and the one the
 * mount licences are read from. A narrowing that answered `off` for a row whose
 * `running` is `true` would put the panel and the page into two different
 * stories about the same plugin — a chip in the bar, and a row saying it is not
 * there. So this refines `running` and can never contradict it.
 */
export const pluginState = (plugin: BuiltPlugin): PluginState => {
  const word = plugin.state
  if (word !== undefined && STATES.has(word)) {
    // ...and a serve that says `running` while `running` is false, or the other
    // way round, is not a state this can carry either: the boolean wins, for
    // the reason above. Only the four ABSENT words are refinements of `false`.
    const claimed = word as PluginState
    if ((claimed === "running") === plugin.running) return claimed
  }
  return plugin.running ? "running" : "off"
}

/**
 * THE ROSTER: every plugin compiled in, in registry order, and what the
 * operator said.
 *
 * Registry order rather than sorted, because the registry is a source file
 * (`@olai/plugin-api`'s `surfaces.ts`) and the order a build lists its plugins in is
 * the order `--help` names them in — a panel that re-sorted would put the rows
 * in an order nothing else in the product uses.
 */
export const PluginRoster = Schema.Struct({
  /** Every plugin THIS RUNTIME COMPOSES OVER. Empty for a runtime handed no
   *  plugins at all — `olai surface`, the headless faces, every server test —
   *  which composes no sibling surface and so has no roster to be about. */
  built: Schema.Array(BuiltPlugin),
  /**
   * The names `--plugins` was GIVEN, or `null` when the flag was not given.
   *
   * `null` IS NOT THE EMPTY LIST, and keeping them apart is the whole reason
   * this field is here rather than derived from `built`. `null` is nobody
   * having said, which means the built-in default; `[]` is `--plugins=`,
   * somebody saying NONE out loud. Both leave the same rows on screen when a
   * build has one plugin, and the line under them says two different things:
   * one names the flag that did it, the other names the built-in default. The
   * git pin keeps exactly this distinction one setting over (`@olai/format`'s
   * `GitPin`), and for the same reason — a value that had already expanded
   * `null` into the full list could not tell a reader which of the two they
   * were looking at.
   */
  pinned: Schema.NullOr(Schema.Array(Schema.String)),
})
export type PluginRoster = typeof PluginRoster.Type

/**
 * WHETHER A DOORBELL DECLARING `kinds` CAN WATCH `file` — the one reading of
 * {@link BuiltPlugin}'s `wake.kinds`, and the whole of what either end does
 * with that member.
 *
 * ## Why it is one function and not two agreeing ones
 *
 * TWO ends ask it, about the same declaration, and they must agree or the
 * feature inverts: the browser asks it to decide what the picker OFFERS
 * (`@olai/web`'s `chat/scopable.ts`), and the serve asks it per revision to
 * decide whether a STORED pick is a fault (`@olai/server`'s `runtime.ts`, over
 * `@olai/chat`'s `Chat.faults`). Spelled twice, the day they drift is the day
 * the picker offers a file the serve faults on the instant somebody presses it
 * — a control that hands out its own error. Neither of those packages can
 * import the other; this is the member they share, so the reading lives beside
 * the field it reads.
 *
 * ## What it does with a word it does not know
 *
 * Nothing, and that is the answer to both ways a word can be strange. The kinds
 * travel as plain strings, so a serve may name one this build's registry never
 * heard of, and a browser may be handed no list at all ({@link BuiltPlugin}
 * argues both). Either way `fileKind`'s answer is not in the list and no file
 * is watchable — a picker that offers nothing, which is visible and local,
 * rather than one that offers everything, which is the defect this whole
 * mechanism exists to close.
 *
 * A path no kind claims at all — a `README`, a `.ts` — takes the same arm
 * without one of its own: it is in no plugin's list because it is in no list.
 */
export const watchable = (kinds: ReadonlyArray<string>, file: string): boolean => {
  const kind = fileKind(file)
  return kind !== null && kinds.includes(kind)
}

/**
 * NO ROSTER: no plugin to say anything about, and nobody having said anything.
 *
 * Two states in one value, deliberately, because they draw the same nothing:
 * a page that has not heard from the server yet, and a runtime that composes no
 * plugins at all. Neither has a row, and a panel drawing rows off `built` is
 * empty for both without asking which it is — where a seed that listed the
 * build's plugins as `running: false` would flash "kolu is off" at a serve
 * running kolu on its way to the truth. That is the same argument `GIT_OFF`
 * makes for seeding the git cell with the setting face rather than the fault.
 */
export const NO_ROSTER: PluginRoster = { built: [], pinned: null }
