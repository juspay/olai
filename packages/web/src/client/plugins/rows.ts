/**
 * WHICH PLUGINS THIS SERVE RUNS, read as the plugins panel reads it.
 *
 * ## THE ROWS ARE NOT READ-ONLY ANY MORE, and this file's whole shape moved
 * with that
 *
 * It said: *a plugin's enablement is not a preference. It is CLI/nix only —
 * `--plugins`, or the nix module that passes the same flag — with no settings
 * file and no browser toggle, so these rows draw the server's answer and are
 * always read-only.* Every clause of that was true and the conclusion is
 * overturned (the human, 2026-09-04): the panel gets a SWITCH, and
 * `plugins.set` is the verb behind it.
 *
 * What did NOT move is the first half. There is still no settings file, still
 * no CLI verb against a running serve, and `--plugins` and the nix module are
 * still the only way a serve STARTS with a plugin on or off. A flip here is the
 * INSTANCE's, for as long as this process runs, and a restart comes back to how
 * the server was started. So the row still owes a reader the boot default —
 * which is what {@link pluginSetBy} says now, having stopped saying the half
 * that is no longer true.
 *
 * That is also why these rows no longer share `../settings/instance.ts` with
 * the two git rows. Both of that module's sentences END with *it cannot be
 * changed from a browser*, which is the whole doctrine it exists to keep in one
 * copy — and it is still exactly right for git policy, which is still the
 * server's alone. A plugin row that borrowed the sentence and then drew a live
 * switch under it would be the panel contradicting itself, and softening the
 * shared sentence to fit would soften it for the rows that still mean it. Two
 * doctrines, two spellings; the git rows keep theirs untouched.
 *
 * ## A ROW WITH NOTHING TO SAY SAYS NOTHING, and that took a screenshot
 *
 * Both readings here used to answer a string, always. On a serve started with
 * `--plugins=claude,codex,chat,kolu,odu` that drew, under every one of eight
 * rows, the same two blocks: *Running — its chips, panels and delivered
 * messages all work*, and the flag, quoted in full, wrapped over three lines,
 * eight times. Roughly nine tenths of the panel was one paragraph repeated. The
 * human, 2026-09-04, with the picture: *portrait spammy*.
 *
 * The old header called that arrangement a feature — no panel-wide line was
 * needed *because every row already says so on its own line* — which is the
 * repetition noticed and then argued for. It is not a per-row fact if it is
 * byte-identical on every row; it is a panel fact drawn N times. So:
 *
 *   - What is the SAME for every row is said ONCE, at the foot
 *     ({@link pluginsStarted}): how this serve was started, and how long a flip
 *     lasts.
 *   - What DIFFERS is per row, and only then. Both readings answer `null` for a
 *     row with nothing to add, and the ordinary running row is exactly that —
 *     the switch already reads On, and a sentence under it saying so is the
 *     control announcing itself.
 *
 * WHAT SURVIVES PER ROW is the list the old argument was actually built for:
 * a `failed` row (the plugin's own words), a `waiting` row (which door, and so
 * which plugin would offer it), an absent row (what to type so it starts at
 * boot — and that names THIS row, so it is not the same line twice), and a
 * `running` row that carries others (what stops with it). Every one of those is
 * different on the row beside it.
 *
 * **THE ROWS ARE A WALK, and this module spells no plugin's name.** What
 * arrives on the `plugins` cell is a row per plugin the BUILD has, each saying
 * whether this serve runs it — so a third plugin reaches this panel without a
 * line here or in `./Panel.tsx` moving, and nothing in `@olai/web` can be the
 * place a plugin's name is hardcoded. The fence one package over holds that as
 * an equality per package (`@olai/bundle`'s `fence.test.ts`); this module is
 * written so there is nothing for it to catch.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else** — the shape `../settings/policy.ts`
 * keeps and for the same reason. There is no state here, no store, and no
 * subscription: the one reader is `./Panel.tsx`, which holds the cell and the
 * one signal a press needs, and a unit test asks these with a roster built by
 * hand. {@link pluginSwitch} is the newest of them and is the reason the press
 * did not drag state in here with it: what a strip SHOWS and whether it may be
 * pressed are a function of the row and one boolean, so they are asked here and
 * proved here rather than read off a rendered panel.
 *
 * ## TWO QUESTIONS PER ROW, and they were one
 *
 * A row used to draw one sentence off a boolean and share a second sentence
 * with every other row. That was exact while a plugin's presence was decided
 * once, by one flag, before anything ran. A plugin is a fiber now, and
 * `running: false` covers five different mornings — the flag left it out, the
 * BUILD leaves it out until somebody asks, a PERSON switched it off here, its
 * `apply` died, or it is waiting on a service — of which exactly one is a fault
 * and exactly one is something a person can act on.
 *
 * So the two questions were split, and both were per row. ONE of them stayed
 * there:
 *
 *   - {@link pluginHint} is WHAT THIS ROW ADDS to what the switch beside it
 *     already says — the why of an absence, the plugin's own failure words,
 *     the door a wait is short of, what stops if this one is turned off, and
 *     what to type so it starts at boot. `null` where the switch has said it
 *     all.
 *   - HOW THIS SERVE STARTED is {@link pluginsStarted} and is the PANEL's, not
 *     the row's, because under a given flag the answer is one string for every
 *     row. It was per row on the argument that an opt-in row and its neighbour
 *     have different built-in defaults — which is true, and is why THAT
 *     difference is still drawn per row, in the hint, where it names the flag
 *     value a person would type. What moved is only the part that was the same
 *     everywhere.
 *
 * The word itself is narrowed by `@olai/surface`'s `pluginState`, which is
 * where an absent or unknown one is answered — a serve too old to send one, or
 * newer than this tab. Nothing here re-derives it.
 */

import type { BuiltPlugin, PluginRoster } from "@olai/surface"
import { pluginState } from "@olai/surface"

/** The rows to draw, in the order the build lists its plugins. A build with no
 *  plugins, and a page that has not heard from the server yet, both draw none —
 *  see `@olai/surface`'s `NO_ROSTER` for why those two are one value. */
export const pluginRows = (roster: PluginRoster): ReadonlyArray<BuiltPlugin> => roster.built

/** The two words a plugin's strip can read, and what each of them asks for. */
export type PluginPick = "on" | "off"

/**
 * WHAT THE STRIP SHOWS AND WHETHER IT MAY BE PRESSED — the whole of the switch's
 * state, as a function of the row and one fact this tab owns.
 *
 * ## The value is the BOOLEAN, never the six-word state
 *
 * `running` is the field the two ends have always agreed on and the one every
 * mount licence is read from (`@olai/surface`'s `pluginState` argues it from
 * the other side). A strip that showed On for `waiting` — a plugin that was
 * asked for and has not arrived — would be a control claiming a fact the rest
 * of the page is drawn from the negation of. The WHY of an absence is the
 * hint's job and it has six words for it; the switch has two, and it answers
 * the question the switch is asking.
 *
 * ## A FAILED ROW STILL DRAWS ONE, which is a ruling rather than a leftover
 *
 * A plugin whose `apply` died is off, and pressing On is exactly the gesture a
 * person has for *try that again* — the second half of it is the loader
 * re-importing the module and re-running the apply, which is the only retry
 * this product has. Hiding the switch there would leave the one row on the
 * panel that is a FAULT as the one row with nothing to do about it.
 *
 * ## FROZEN IS THIS TAB'S OWN REQUEST, and nothing else
 *
 * `flipping` is true between the press and the server's answer. It is not a
 * fact about the serve — it is about the button under this reader's finger,
 * which must not be pressed twice — which is precisely the distinction
 * `../commit/state.ts` draws for Commit and Push, and it is a signal in
 * `./Panel.tsx` for the same reason.
 *
 * **The roster's own republish cannot stand in for it.** The serve does not
 * move the roster until the bundle has SETTLED — a flip disposes a row, and
 * every row that named one of its doors unloads with it — so between the press
 * and the settle the cell still carries the value the strip already shows.
 * Without this the strip would sit there reading On, live, inviting the second
 * press that starts a second flip across the first one.
 *
 * The value STAYS PUT while frozen rather than jumping to what was pressed: an
 * optimistic strip is this tab asserting a fact it has not been told, on the one
 * panel whose entire job is to say what is actually running.
 */
export const pluginSwitch = (
  plugin: BuiltPlugin,
  flipping: boolean,
): { readonly value: PluginPick; readonly frozen: boolean } => ({
  value: plugin.running ? "on" : "off",
  frozen: flipping,
})

/**
 * WHAT THIS ROW ADDS TO WHAT THE SWITCH ALREADY SAYS — one short line, or
 * NOTHING.
 *
 * ## SHORT, and that is a ruling rather than a preference
 *
 * These were paragraphs. Each absent arm recited the four things a missing
 * plugin costs — no member served, no probe, no face drawn, a property
 * validated as plain text — and every one of those is TRUE and is a claim the
 * code keeps. None of them is what a person opening this panel wants. The human
 * (2026-09-02): *users are not going to read novels*.
 *
 * So the long account moved to where long accounts belong — this comment, the
 * package READMEs, `docs/running.md` — and what is on screen is the state and
 * the ONE thing a reader can act on. A hint that is not read is worth nothing,
 * however true it is.
 *
 * ## ...AND THE SHORTEST LINE IS NO LINE
 *
 * The ordinary running row said *Running — its chips, panels and delivered
 * messages all work*, under a switch reading On, on every row of a serve
 * running six plugins. That is the control announcing itself, six times, and it
 * is most of what made this panel a scroll (the human, 2026-09-04, with the
 * screenshot: *portrait spammy*).
 *
 * So this answers `null` wherever the switch has already said everything true
 * about the row, and the panel draws no paragraph at all there. Which leaves
 * exactly the arms that carry something the switch cannot:
 *
 *   - `failed`  the plugin's OWN words, verbatim, because core composes no
 *               clause of a plugin's failure prose. A throw with nothing to say
 *               says so. The one arm that is a FAULT.
 *   - `waiting` WHICH DOOR nobody is behind. "Something it needs" is the
 *               sentence that sends a person nowhere; a service is another
 *               ROW's to offer, so naming the door is naming the plugin to
 *               compose, one step removed.
 *   - `optIn` / `off`  WHAT TO TYPE so it starts that way at boot. The switch
 *               starts it NOW; the flag is how it comes back after a restart,
 *               and both name THIS row's word, so no two of these lines are the
 *               same.
 *   - `running` + `carrying`  WHAT ELSE STOPS if this is turned off.
 *
 * ## THE CARRYING ARM IS THE OTHER END OF THE WAIT
 *
 * A row that stands behind doors carries the rows that named them
 * ({@link BuiltPlugin}'s `carrying`), and the moment it is worth saying is the
 * moment somebody is about to press Off. The panel drew nothing about it while
 * the rows were frozen — there was no press to warn about — and a switch that
 * took chat down and left kolu, odu and every engine `waiting` with no warning
 * would be the most expensive control in the product.
 *
 * `waiting` names the DOORS a row is short of; this names the ROWS that would
 * go short. One fact from either side, both read live off the serve, so neither
 * can be the copy that rots.
 *
 * UNBOUNDED IN LENGTH, exactly as `waiting`'s is, and for the same reason: the
 * names are the serve's and core caps neither list. A build whose chat row
 * carried a dozen plugins would draw a dozen names, which is a longer sentence
 * and a true one — where a cap would be this panel deciding which of somebody's
 * plugins was worth telling them about.
 */
export const pluginHint = (plugin: BuiltPlugin): string | null => {
  switch (pluginState(plugin)) {
    case "running":
      // NOTHING, on the ordinary row: the switch reads On and there is no
      // second thing to know. A row that carries others has one, and it is
      // about the press rather than about the state.
      return carries(plugin) === undefined
        ? null
        : `Turning it off also stops ${carries(plugin)}.`
    case "optIn":
      // THE BUILD'S OWN DEFAULT, and the flag value that changes it. This is
      // the row the per-row line was always for: under no flag its neighbour's
      // built-in default is ON and this one's is OFF, so a panel-wide sentence
      // could only ever name one of them.
      return `Off by default — --plugins=${plugin.name} starts it at boot.`
    case "switched":
      // THE PRESS A PERSON JUST MADE, and the one absence that undoes itself.
      // The other three all send a reader somewhere else — a flag to type, a
      // build to rebuild, a plugin to compose — and this one is answered by the
      // switch beside the sentence, so what it owes is not an instruction but
      // the fact a reader might not have: it does not survive the serve. Without
      // this arm the row read `optIn` and told a person who had just pressed it
      // that the BUILD ships this off by default.
      return `Switched off here. A restart brings it back.`
    case "failed":
      return `Failed to start. ${said(plugin.fault)}`
    case "waiting":
      // NAMED WHERE THE ROW NAMES THEM, because "something it needs" is the
      // sentence that sends a person to the source. A service with nobody
      // behind it is another ROW's to offer, so what this line is really saying
      // is which plugin to compose — and it can only say it by naming the door.
      return plugin.missing === undefined || plugin.missing.length === 0
        ? `Starting — waiting for something it needs.`
        : `Waiting for ${plugin.missing.join(", ")} — no plugin in this build offers `
          + `${plugin.missing.length === 1 ? "it" : "them"}.`
    default:
      // ADDED TO the flag rather than replacing it: this arm is only reachable
      // under a flag that was given (`@olai/server`'s `stateOf` answers `optIn`
      // where none was), and the panel's foot quotes that flag in full — so the
      // useful thing here is the row's own word and where to put it.
      return `Off — it was not asked for. Add ${plugin.name} to --plugins at boot.`
  }
}

/** THE PLUGIN'S OWN SENTENCE, verbatim — or the honest nothing. */
const said = (fault: string | undefined): string =>
  fault === undefined ? `It gave no message.` : `It said: “${fault}”.`

/**
 * THE ROWS THAT STOP WITH THIS ONE, as one phrase — or nothing at all.
 *
 * ABSENT AND EMPTY ARE ONE ANSWER HERE, which is the opposite of the rule
 * `waiting`'s list keeps one arm up, and the difference is what each absence
 * MEANS. A `waiting` row with no `missing` is a settle still in flight — it IS
 * waiting on something and cannot yet say what — so the sentence has to survive
 * having no names. A `running` row with no `carrying` is a row nothing depends
 * on, which is a whole answer and the ordinary one: most rows carry nobody, and
 * the honest thing to draw about them is the sentence that was always there.
 *
 * A serve too old to send the field at all lands on the same arm, and correctly:
 * it is telling this tab nothing about what depends on what, and a panel that
 * invented a warning out of that silence would be worse than one that kept
 * quiet.
 */
const carries = (plugin: BuiltPlugin): string | undefined =>
  plugin.carrying === undefined || plugin.carrying.length === 0
    ? undefined
    : plugin.carrying.join(", ")

/**
 * HOW THIS SERVE STARTED, AND HOW LONG A FLIP LASTS — ONE line, for the whole
 * panel.
 *
 * ## It was per row, and being per row was the defect
 *
 * `pluginSetBy` answered a string per plugin, and under a given flag every one
 * of those strings was BYTE-IDENTICAL: *Set by the server:
 * `--plugins=claude,codex,chat,kolu,odu`. It cannot be changed from a browser.*
 * — wrapped over three lines, under eight rows. The panel's own header called
 * that an argument for having no panel-wide line, on the grounds that every row
 * already said it. That is a repetition noticed and then defended.
 *
 * A fact is per row when the rows DIFFER. This one does not: `pinned` is one
 * value for the serve, so the sentence about it is one sentence for the serve.
 * What genuinely differs — the opt-in row's own built-in default, and the flag
 * value that changes it — stayed per row, in {@link pluginHint}, which is the
 * case the old argument was actually built for.
 *
 * ## The two sentences, and why they are one string
 *
 * WHERE IT CAME FROM and HOW LONG A CHANGE LASTS are two facts and they are
 * read together: *this is what the serve was started with; what you do here
 * does not outlive it.* Split into two paragraphs they would be the panel's
 * foot growing back into the thing this replaced.
 *
 * `--plugins=` — an empty value — is somebody saying NONE out loud, and it is
 * spelled as itself rather than described. It is a different answer from saying
 * nothing, and every row is Off in both cases: this line is the only place the
 * two are told apart.
 *
 * ## Why a reading and not a constant
 *
 * For the reason every other sentence on this panel is a reading: it is read
 * off the same `pinned` the rows are, so the flag it quotes and the rows it
 * sits under cannot come from two different frames — the pairing the old
 * per-row line kept, moved rather than dropped.
 */
export const pluginsStarted = (roster: PluginRoster): string =>
  `${startedWith(roster.pinned)} ${PLUGINS_SESSION_ONLY}`

/** WHAT THE SERVE WAS STARTED WITH — the flag as an operator would type it, or
 *  the built-in defaults, with the flag still NAMED where nobody gave one: the
 *  door is worth naming even when there is no value to quote, and it cannot be
 *  read as a claim that somebody gave it, because the sentence says nobody did.
 *  (`../settings/instance.ts` made that argument first, for the rows that still
 *  borrow it.) */
const startedWith = (pinned: ReadonlyArray<string> | null): string =>
  pinned === null
    ? `Started with the built-in defaults: no --plugins given.`
    : pinned.length === 0
    ? `Started with --plugins= (none).`
    : `Started with --plugins=${pinned.join(",")}.`

/**
 * ...AND HOW LONG A FLIP LASTS — the half of {@link pluginsStarted} that does
 * not depend on the roster.
 *
 * Exported so a case can hold it on its own: it is the whole of the
 * session-only ruling (the human, 2026-09-04), and the one thing a person needs
 * before they close the tab believing they have configured something.
 */
export const PLUGINS_SESSION_ONLY =
  `On or off here lasts as long as this server runs; a restart comes back to this.`
