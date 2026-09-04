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
 * shape `manifest` and `git` already are. It is seeded at the composition root,
 * out of the flag and the rows, and REPUBLISHED from every re-compose
 * (`@olai/server`'s `runtime.ts`): a plugin is a fiber, so a register or a
 * dispose moves the roster and the word on a row is read live.
 *
 * It therefore has both of the things it was once documented as needing
 * neither of. A CONNECTOR, because a cell that is only seeded goes on saying
 * what the flag said while rows change state underneath it — the connector
 * hands the cell to the runtime and `recompose` is the one clock that moves it.
 * And an `equals` ({@link sameRoster}): a republish used to be a thing that
 * never happened, so a comparator would have been dead weight with a comment
 * explaining why it was there. The fiber ended that, and the TAB following the
 * roster made it load-bearing — an identical republish costs a `redial` and a
 * rebuilt page unless something says the two rosters are one. {@link
 * sameRoster} carries the whole of that argument.
 *
 * ## STILL READ-ONLY, and the panel is no longer frozen
 *
 * Those two used to be one sentence — *read-only on the wire because `--plugins`
 * is CLI/nix ONLY, no settings file, no browser toggle* — and the loader surface
 * separated them. There IS a browser verb now (`plugins.set`, on the root spec),
 * and this cell still carries no write verb, because the two are about different
 * things: a flip is an ACT with a subject and a refusal, and what comes back
 * from it is this cell moving. A `set` on the cell would be "make the roster say
 * this", which is a browser telling a serve what its own fibers are doing.
 *
 * That is the arrangement `git` already has one member over — a cell that says
 * what git is doing, and procedures that ask it to do something — and it is why
 * the two names collide on purpose.
 *
 * WHAT A BROWSER DOES WITH IT is draw a row per plugin, with a switch, naming
 * what is in force and for how long (`@olai/web`'s `client/plugins/Panel.tsx`).
 *
 * ## NOTHING HERE SPELLS A PLUGIN'S NAME
 *
 * The names are DATA. They arrive from the registry at the composition root and
 * travel as strings; this file — a general one — declares that there ARE names
 * and knows none of them, which is the same fence `@olai/bundle`'s
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
   * WHY, IN ONE WORD — the seven states {@link pluginState} narrows to, and the
   * one thing `running` cannot say.
   *
   * A plugin is a fiber now, and `false` covers six different mornings:
   * the operator's flag left it out, the BUILD leaves it out until somebody
   * asks, a PERSON turned it off at the panel, its `apply` DIED, it is still
   * waiting on a service that has not arrived, or — for a plugin the VAULT
   * defines — nobody has yet approved the version that is written down. Those
   * want six different
   * sentences under the row, and one of them wants an alarm — so the word
   * travels rather than being guessed at the far end from a boolean that has
   * already thrown the distinction away.
   *
   * `running` STAYS, and is not redundant: it is the boolean the tab follows
   * its roster by — which plugins to load a chunk for, dial, and mount a fiber
   * for (`@olai/web`'s `client/wire.ts`) — and that reading must not have to
   * know seven words to answer one question. The two cannot disagree: the
   * composition root writes `running` from what actually registered a sibling
   * and derives this from the same reading.
   *
   * A PLAIN STRING, and OPTIONAL, for the two reasons `wake` is: a tab left
   * open across a downgrade is talking to a serve that declares none, and a
   * serve may one day name an eighth word this build has never heard of. Neither
   * may fail the roster's DECODE, because the roster is what every plugin's
   * mount hangs off. {@link pluginState} is the one reading, and it answers an
   * absent or unknown word out of `running` — which is exactly what this field
   * refines and never contradicts.
   */
  state: Schema.optionalKey(Schema.String),
  /**
   * ...AND THE PLUGIN'S OWN WORDS, when its start died — verbatim, with core
   * composing nothing around them.
   *
   * Only on a row whose state is `failed`. The panel draws it under the row's
   * sentence and quotes it as the plugin's; a serve that failed a plugin with
   * no message to give sends none, and the row says a start failed without
   * inventing what it said. That is the same rule the delivery doors keep:
   * failure prose is the plugin's, and core's job is to carry it.
   */
  fault: Schema.optionalKey(Schema.String),
  /**
   * WHAT A `waiting` ROW IS SHORT OF — the service tags nobody is behind, by
   * the words this tree spells them with.
   *
   * The half of `waiting` that is worth reading. A row waits because it named a
   * service and no row offers it; a panel that says only *waiting for something
   * it needs* is telling a person that something is wrong and nothing about
   * what, on the one screen whose whole job is to say what to do next. Under
   * `--plugins=kolu` the answer is `deliveries`, and the answer to THAT is
   * "compose the chat row" — which is a sentence somebody can act on.
   *
   * CORE'S OWN VOCABULARY, unlike {@link fault}, which is why core names these
   * and composes no clause of that one: a tag is a key in this tree's table
   * rather than anybody's prose.
   *
   * OPTIONAL, for {@link state}'s two reasons: a serve too old to send it, and
   * a fiber PENDING with nothing named yet — a settle still in flight, where
   * naming nothing is the honest answer and an empty list would be a row
   * claiming to wait on no one.
   */
  missing: Schema.optionalKey(Schema.Array(Schema.String)),
  /**
   * WHICH ROWS GO `waiting` IF THIS ONE IS TURNED OFF — the other end of
   * {@link missing}, and the one thing a switch owes a person BEFORE it is
   * pressed.
   *
   * `missing` is a row saying what it is short of, after the fact. This is the
   * row that HAS what somebody else is short of, saying so while there is still
   * a decision to make: turning the chat row off takes the four doors it stands
   * behind with it, and every engine and both tenants name one. A panel that
   * drew a switch and let a person find that out afterwards would be a control
   * that hides its own blast radius.
   *
   * ## NAMES ROWS, where its counterpart names KEYS, and the asymmetry is exact
   *
   * `missing` may not name a plugin: which row WOULD provide a key is the
   * bundle's business, and a general package holding that answer would be
   * holding a list that can disagree with the fibers. This one names rows
   * because it is not answering that question — it is reporting a JOIN the
   * composition root made between two live readings, who stands behind what and
   * who names what, neither of which anybody keeps by hand.
   *
   * ## ONLY ON A RUNNING ROW, and ABSENT rather than empty
   *
   * A row that is off carries nobody: what it stood behind is already revoked,
   * and every row that named it is already `waiting` and already says so. And a
   * running row that nothing names sends nothing at all — an empty list would
   * be a row claiming to carry no one, which is a sentence, where absence is the
   * ordinary state of every plugin in this build but one.
   *
   * OPTIONAL, for {@link state}'s two reasons: a serve too old to send it, and a
   * roster whose decode may not fail, because every plugin's mount hangs off it.
   */
  carrying: Schema.optionalKey(Schema.Array(Schema.String)),
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
  /**
   * THE ROW'S CONFIG, as data — what `olai.yml` and the CLI patch left on it.
   *
   * Core draws the values with no knowledge of any plugin's words. Optional
   * for the same two reasons `state` is: a serve too old to send it, and a
   * row that has no config at all. Absent rather than empty, because an
   * empty record would be a row claiming to have been configured as nothing.
   */
  config: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  /**
   * WHERE THIS ROW CAME FROM, when it came from the VAULT rather than the build
   * — the whole of what a dynamic plugin adds to this member.
   *
   * ABSENT on every compiled-in row, and its presence IS the distinction: a row
   * with a source is one somebody wrote into the directory this serve is about,
   * and the four things that are true only of such a row all hang off it.
   *
   * `server` and `browser` are the SOURCE ITSELF, and they travel because
   * approving a plugin is reading it. That is the one gesture in this product
   * where a person is deciding about code rather than about a setting, and a
   * panel that asked them to say yes to a content hash would be asking them to
   * approve something they cannot see. It is the one member on this spec whose
   * size is a person's own writing rather than a bound olai keeps — which is the
   * honest reading of the cost rule (`@olai/server`'s `faces.ts`) rather than an
   * exemption from it: what is on the wire is what somebody put in their vault
   * for the express purpose of being read here.
   *
   * `approved` is whether THIS VERSION is the one a person said yes to — the
   * derived answer, so a browser never re-implements what `always` means or how
   * a hash is compared.
   *
   * `chunk` is where the browser half is served from, and it is present only on
   * a row that is RUNNING with a face: it is the URL the tab loads instead of
   * the compiled-in chunk a built row has (`@olai/bundle`'s `rows.ts`). The
   * version is in the path, so a re-approved edit is a different URL and no
   * cache can hand back the code somebody approved before it.
   *
   * OPTIONAL, like every other addition to this row and for the reasons `state`
   * gives: a tab left open across a downgrade must not fail the roster's decode,
   * because every plugin's mount hangs off it.
   */
  source: Schema.optionalKey(Schema.Struct({
    /** The node the definition hangs off, and the outline it is in — what the
     *  panel links to, so a person can go and read it where it lives. */
    node: Schema.String,
    file: Schema.String,
    /** The content hash of both halves — what an approval names. */
    version: Schema.String,
    /** Whether {@link version} is the version a person approved. */
    approved: Schema.Boolean,
    /** The two halves, verbatim. `browser` is absent for a plugin with no
     *  face. */
    server: Schema.String,
    browser: Schema.optionalKey(Schema.String),
    /** Where the built browser half is served — only while it is running. */
    chunk: Schema.optionalKey(Schema.String),
  })),
})
export type BuiltPlugin = typeof BuiltPlugin.Type

/**
 * WHERE A DYNAMIC PLUGIN'S BROWSER HALF IS SERVED FROM — the prefix both ends
 * spell, and neither invents.
 *
 * The same arrangement `ASSET_PREFIX` has one member over: the server answers
 * under it and the tab imports from it, so a rename is one constant rather than
 * two strings that agree until they do not. Under `/_olai/` with the hashed
 * assets, because it is the same kind of thing — code this server built, named
 * by its content, and immutable at the name it is served under.
 */
export const PLUGIN_CHUNK_PREFIX = "/_olai/plugins/"

/**
 * THE SEVEN WORDS A ROW CAN BE IN, and each is a different morning.
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
 *   - `switched` A PERSON TURNED IT OFF HERE, at the panel, on this serve. Also
 *                total absence, and the third author of it — which is the whole
 *                reason it needed a word. Absence used to have exactly two
 *                authors, the flag and the build, and `pinned` told them apart;
 *                the switch is a third, and without this the panel told a person
 *                who had just pressed the switch that the BUILD ships this off
 *                by default and named a flag they should type. It is the one of
 *                the four absences that undoes itself: a restart brings the row
 *                back to whatever the flag and the file say, and pressing the
 *                switch again brings it back now.
 *   - `failed`   its `apply` DIED, which the registry records as a throw out of
 *                the mount. The one word that is a FAULT: it was asked
 *                for, it is absent, and nothing else on screen says so.
 *   - `pending`  A PERSON HAS NOT DECIDED. Only ever a row the VAULT defines
 *                ({@link BuiltPlugin.source}): the source is written, this
 *                version is not the one anybody approved, and nothing of it has
 *                been imported, compiled or run. The fifth absence and the only
 *                one that is a QUESTION rather than an answer — the other four
 *                are states somebody or something already settled, and this one
 *                is waiting on a reader. It is the state phase 12 exists to
 *                draw: the panel shows the source under it and the verb beside
 *                it, which is the one place in this product where a person
 *                approves code rather than changes a setting.
 *   - `waiting`  the plugin is waiting on a service that has not arrived. Not
 *                reachable while every service a plugin NAMES is provided before
 *                the bundle is, and declared here because the runtime that can
 *                produce it is already the one running.
 *
 * ## The LIST is the declaration, and the type is derived from it
 *
 * It was the other way round: a union, and a `Set` built from it. Those are two
 * spellings of one vocabulary, and only one of them was checked — `new
 * Set<PluginState>([…])` does not demand exhaustiveness, so a sixth word added
 * to the union and to the composition root would compile clean while the set
 * still held five, and the new word would fall silently through
 * {@link pluginState}'s narrowing to `running`/`off`.
 *
 * That is the exact failure the narrowing exists to prevent, arriving through
 * the narrowing's own vocabulary. One `as const` array, the type read off it,
 * and a seventh word is one edit that cannot be half-made.
 */
const STATES = ["running", "off", "optIn", "failed", "waiting", "switched", "pending"] as const

export type PluginState = (typeof STATES)[number]

/** The seven, as a set — what {@link pluginState} asks. */
const KNOWN: ReadonlySet<string> = new Set<string>(STATES)

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
  if (word !== undefined && KNOWN.has(word)) {
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
 * Registry order rather than sorted, because the registry is a FILE
 * (`@olai/bundle`'s `olai.yml`) and the order a build lists its plugins in is
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
 * `olai-plugin-chat`'s `Chat.faults`). Spelled twice, the day they drift is the day
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

/**
 * TWO ROSTERS THAT SAY THE SAME THING ARE ONE — and this cell needs an `equals`
 * now, where for its whole life it did not.
 *
 * It moved at most once per serve: the flag was read at the composition root
 * and nothing afterwards could change what it said, so a republish was a thing
 * that never happened and an `equals` would have been dead weight with a
 * comment explaining why it was there.
 *
 * That stopped being true in two steps. A plugin is a FIBER, so the roster is
 * republished from the re-compose — every register and every dispose — and the
 * word on a row is read live. And the TAB now MOVES on it: a roster change is a
 * `redial`, which builds a new wire, tears down every standing subscription on
 * the old one and rebuilds the page's whole tree. A republish that carries the
 * identical value would do all of that for nothing, and it is not a rare case:
 * a reconnect republishes, and so does any re-compose that ended where it
 * started.
 *
 * `Schema.toEquivalence` rather than a hand-written walk, for the reason every
 * other `equals` on this spec takes it: the shape is the schema's, so a
 * comparison written out here would be a second reading of it, free to miss the
 * field somebody adds. The optional keys are part of that — a row whose `state`
 * moved from `waiting` to `running` is a different roster, and a hand-rolled
 * comparison of `name` and `running` would have called it the same one.
 */
export const sameRoster: (a: PluginRoster, b: PluginRoster) => boolean = Schema
  .toEquivalence(PluginRoster)
