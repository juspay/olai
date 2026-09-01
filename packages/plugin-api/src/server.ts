/**
 * THE SERVER DOOR — what a composition root reads to COMPOSE a runtime, and the
 * third of this package's three.
 *
 * ## Why a third door rather than a field on the manifest
 *
 * {@link ./wire.ts} is what a composition root and the browser reach, and its whole
 * discipline is what is NOT on its graph: no UI runtime, no appliance client, no
 * `node:` builtin. {@link ./index.ts} is the manifest, and a manifest carries a
 * plugin's CHROME and its DRESSINGS — SolidJS components, and in kolu's case a
 * terminal emulator behind them. A server that reached a runtime half through
 * the manifest would pull all of that onto the graph of a process that renders
 * nothing, which is the exact hazard `@olai/kolu-client/wire`'s fence was
 * written for one floor down and the exact hazard this package's own split was
 * written for one floor up.
 *
 * So the runtime halves are reached HERE, through each plugin's own `./server`
 * subpath, and {@link ./fence.test.ts} walks this door's closure and asserts
 * that no browser face is on it rather than trusting this paragraph.
 *
 * ## Three doors means three lists, and that is the cost of the split
 *
 * {@link WIRES}, `PLUGINS` and {@link SERVERS} each enumerate the same two
 * plugins, so a third one is three lines rather than one. That is worth naming
 * as a cost rather than presenting as a design: a single list would be one edit,
 * and it is not available, because the three lists are what the three GRAPHS
 * are. A registry that named every plugin once and re-exported the halves would
 * put every door's closure on every door — which is not a tidier version of this
 * arrangement, it is the absence of it.
 *
 * What the split does buy is that no line in a general package outside this one
 * spells a plugin's name at all, and every one of the three lists is checked
 * against the others: a plugin missing from `SERVERS` is a sibling the runtime
 * cannot implement deps for, and `implementSurfaces` refuses at boot naming the
 * key ("missing deps for surface").
 *
 * ## What core does with this
 *
 * Iterates. For each enabled entry it calls {@link PluginServerHalf.serve} with
 * the SAME services blob, keys the result by {@link PluginServerHalf.name}, and
 * hands the record to `implementSurfaces` — which walks each sibling's spec at
 * `surface/<name>/` and returns one group, one handler record and a ctx per key.
 * Core never opens `deps`, never spells a member, and knows a plugin's name and
 * nothing else about what is behind it.
 *
 * ## ...and the OTHER thing on this door, which runs on a different clock
 *
 * {@link probesOf} is the second half: whether each plugin's tool is on this
 * host, asked per chat session rather than once per process. It is here and not
 * on the manifest for the door's own reason made sharper — a probe starts a
 * SUBPROCESS, so a manifest that carried one would put `node:child_process` in
 * the tab's bundle — and it is a separate call from {@link PluginServerHalf.serve}
 * because the two are asked at different moments by different callers
 * ({@link PluginServerHalf.probe} argues it).
 */

import * as kolu from "olai-plugin-kolu/server"
import * as odu from "olai-plugin-odu/server"

import type { PluginServer, PluginServices, Probed, PropKind } from "./plugin.ts"
import { kindWordOf, type PluginWire } from "./surfaces.ts"

/** The halves of the contract, re-exported so this door is the whole of what a
 *  composition root imports: what core hands every plugin, what it gets back,
 *  and what a probe answers. Declared in {@link ./plugin.ts} beside the rest of
 *  the interface, because they are part of what a plugin IS and not part of how
 *  it is reached. */
export type {
  Deliveries,
  NotHere,
  PluginServer,
  PluginServices,
  Probed,
  PropKind,
  StdioServer,
} from "./plugin.ts"

/**
 * ONE PLUGIN, AS A COMPOSITION ROOT SEES IT — its wire half and its server half
 * in one value, so a root reads ONE list.
 *
 * It extends {@link PluginWire} rather than sitting beside it because the two
 * halves are keyed by the same word and that word has one spelling: each
 * plugin's `./server` re-exports `name` from its own `./wire`, so the surface a
 * root composes and the deps it composes it with cannot come to be filed under
 * two different keys. `surfacesOf` and `exposeMapsOf` take a `PluginWire` and
 * therefore take one of these unchanged.
 *
 * `Revision` is PARAMETRIC and is never named in this package, for the reason
 * `@olai/format` is not a dependency of it: the vocabulary of a vault record
 * belongs downstairs. What that costs is that the agreement about the revision
 * ARGUMENT cannot be proved on {@link SERVERS} below — it is proved at the
 * composition root, which is the one place the concrete reading exists
 * (`@olai/server`'s `runtime.ts`, on the line that annotates this list).
 */
export interface PluginServerHalf<Revision> extends PluginWire {
  readonly serve: (services: PluginServices) => PluginServer<Revision>
  /**
   * IS THIS PLUGIN'S TOOL ON THIS HOST — asked per chat session, and answered
   * with both halves at once ({@link Probed}).
   *
   * Optional, and a plugin without one is a whole plugin: odu has nothing to
   * hand a chat session, so it declares no probe and no session ever waits on
   * one. That is the ABSENT arm, and it is the state every machine without the
   * tool is already in.
   *
   * ONE FIELD WHERE THERE WERE THREE. It replaces a `probe` beside an
   * `mcpServer` beside a `failures` table, and each of the two it absorbed was
   * wrong in its own way rather than merely redundant. A server BESIDE a probe
   * is two readings of one moment, which is the invariant {@link Probed} exists
   * to hold: a caller that asked once for the entry to hand over and again for
   * the sentence would start somebody's daemon twice per conversation and could
   * answer the two questions about two different instants. And a
   * `Record<tag, string>` of failure sentences cannot hold the sentences that
   * exist: three of kolu's five carry a deadline, a cause or the daemon's own
   * refusal, none of which is knowable before the failing, so a table core
   * looked a tag up in would leave core composing what it may not compose.
   *
   * IT IS ON THIS DOOR AND NOT ON THE MANIFEST, and the reason is sharper than
   * {@link kinds}': a probe STARTS A SUBPROCESS, and the manifest is the door a
   * BROWSER opens. It was named there as an `unknown` for one PR window — a
   * ghost of a field, unreadable and unwritable — and naming a hook whose value
   * is elsewhere turned out to buy nothing but a place to look for it.
   *
   * IT TAKES THE ENVIRONMENT AND NOT {@link PluginServices}, which is the one
   * place this door narrows what it offers, and the narrowing is a fact about
   * WHEN rather than a second vocabulary. A runtime half is made once, when the
   * surface binds, with a clock, a served directory and two log channels the
   * bound runtime owns; a probe is asked before any of that exists — the chat is
   * built before the surface is bound (`@olai/server`'s `serve.ts` fixes that
   * order and says why) — so handing it the runtime's blob would mean the
   * composition root fabricating log channels for a caller that does not log.
   * WHAT THE PROCESS CAN SEE is the whole of what finding a tool depends on, and
   * it is handed in for the reason `PluginServices.env` is: a probe that read
   * `process.env` itself would answer a different question than the one the
   * session's spawn will ask.
   */
  readonly probe?: (env: Record<string, string | undefined>) => Promise<Probed>
  /**
   * WHAT THIS PLUGIN TEACHES THE VAULT'S VOCABULARY — the kinds a
   * `_olai/Properties.olai` may declare and this plugin will answer for
   * ({@link PropKind}).
   *
   * ON THIS DOOR rather than on the manifest, for {@link probe}'s reason and
   * not a weaker one: the vocabulary is spent by the VALIDATOR and the WRITE
   * PLANNER, which live in a process that renders nothing, and the manifest is
   * where this plugin's SolidJS faces hang. A composition root that reached a
   * kind table through the manifest would put a UI runtime on the graph of the
   * thing that judges files.
   *
   * The browser is not missing anything by that, and it gets the WORD without
   * the vocabulary: declarations do not travel, so the page carries the licence
   * as an ANSWER per drawn value (`@olai/format`'s `Licence`) and the dressing
   * table one floor up is keyed by the same word this table is
   * ({@link ./plugin.ts}'s `Dressing`).
   *
   * Absent is a plugin that teaches no word, which is a whole plugin.
   */
  readonly kinds?: ReadonlyArray<PropKind>
  /**
   * THE DOORBELL'S SENTENCE, when this plugin wakes conversations — in PIECES,
   * because core draws the control between them.
   *
   * The strip row reads `<subject> · <from> <the picker>`, and with nothing
   * picked it reads `<subject> · off`. Core owns the row, the picker and the
   * numeral; it composes no clause of its own, which is why the drawn half of
   * this is three strings and not one. A single sentence with a hole in it
   * would make core the author of everything around the hole, and the four ways
   * a wake could be described have nothing in common but that they are wakes —
   * the same argument {@link probe}'s `missing.why` makes one hook over, and the
   * third time this tree has spent it.
   *
   * The FOURTH field is the same rule read from the other end: {@link wake.gone}
   * is drawn nowhere, so it is one whole sentence rather than pieces, and core
   * carries it into a conversation without joining anything to it.
   *
   * SUBJECT FIRST. What is being woken ON is the subject, and the file is the
   * FILTER over it — a control that led with the file would be describing its own
   * mechanism to somebody who wants to know what it does.
   *
   * `waiting` is the same rule where a COUNT is involved: core holds the bodies,
   * so core knows the number and only the number. The plugin says what its
   * bodies ARE, in both grammatical numbers, because a tree that stored one form
   * and added an `s` would be a tree that had decided what the noun is.
   *
   * ON THIS DOOR and not on the manifest, for {@link kinds}' reason: the
   * declaration has a SERVER reader — the member that writes a scope refuses a
   * plugin that declares no wake, and it reads this field off the enabled halves
   * — and a composition root that reached a manifest would put a UI runtime on
   * the graph of a process that renders nothing.
   *
   * Absent is a plugin that wakes nobody, which is a whole plugin. odu is one:
   * no strip row, no picker, no doorbell, which is the state every machine
   * without the tool is already in.
   */
  readonly wake?: {
    /** What the wake is ON. "wake on terminal activity". */
    readonly subject: string
    /** What the file IS, as a lead-in to the picker. "terminals from". */
    readonly from: string
    /** What this plugin's held bodies are, in the plugin's own words and in both
     *  numbers — core supplies the numeral and joins them, and that is the whole
     *  of core's authorship on the strip. */
    readonly waiting: { readonly one: string; readonly many: string }
    /**
     * WHICH KINDS OF SERVED FILE THIS WAKE CAN BE SCOPED TO — `@olai/format`'s
     * own file-kind words (`kinds.ts`: `outline`, `document`, `hypertext`,
     * `csv`, `image`, `pdf`), as data.
     *
     * ## Why the plugin answers this and core does not
     *
     * A scope is a FILTER, and only the thing doing the filtering knows what it
     * reads out of a file. kolu derives its claimed set from the `kolu-terminal`
     * values on a file's un-done NODES, so a file that holds no nodes derives
     * the empty set for ever — a doorbell that never rings, never digests, and
     * goes on being beaten for, which is quiet-because-broken wearing
     * quiet-and-fine's face. That is the plugin's fact about the plugin's own
     * derivation; core stores a path and never opens it.
     *
     * So the picker offers the kinds named here and no others (`@olai/web`'s
     * `chat/scopable.ts`), and a scope already stored on some other kind is a
     * FAULT rather than a silence ({@link unwatchable}). Before this field the
     * picker offered every file the directory served, `.md` included, and the
     * human's screenshot of it is what this member exists for.
     *
     * ## Words rather than a predicate, because it has to TRAVEL
     *
     * `PropKind.admits` is a function because its one reader is in this process.
     * The picker is in a browser, so what crosses is DATA — the same move
     * everything else on this member makes, carried on the roster
     * (`@olai/surface`'s `BuiltPlugin`'s `wake.kinds`) and read against the same
     * registry at the other end.
     *
     * NON-EMPTY, because a wake that admits no kind is a control nobody could
     * ever point at anything: the picker would draw, open, and offer nothing.
     * The words are plain strings HERE — this package declares no dependency on
     * the format, the way it declares none on the wire — and a plugin that can
     * see `@olai/format` is expected to type its own list against `FileKind`, as
     * kolu's does.
     */
    readonly kinds: readonly [string, ...Array<string>]
    /**
     * ...AND WHAT A CONVERSATION IS TOLD WHEN THE FILE IT WOKE ON STOPS BEING
     * SERVED — one WHOLE sentence, because there is no control to draw between
     * its halves.
     *
     * ## Why this one is not in pieces when the three above are
     *
     * The three above are pieces because core draws a PICKER between them: the
     * row is `<subject> · <from> <the picker>`, and core owns the arrangement.
     * This is not drawn anywhere. It is a MESSAGE, put into a conversation
     * through the door core already built for this plugin, and a message is
     * whole authored paragraphs or it is core writing prose
     * (`@olai/chat`'s `deliveries.ts`, whose `joined` joins them and composes
     * none). So core carries this string and delivers it: no lead-in, no
     * count, no naming of the file, no abbreviation.
     *
     * It NAMES NO FILE for that reason, which is the one thing a reader will
     * notice is missing. Core knows the path — it stores it — but a sentence
     * with core's hole punched in it is the shape this whole field exists to
     * refuse, and the person reading is looking at a strip that draws the path
     * beside the words. What the sentence has to say is what the plugin knows
     * and core does not: that nothing is being watched now.
     *
     * ## Why it is REQUIRED where {@link PluginServerHalf.wake} itself is not
     *
     * A plugin that wakes nobody declares no `wake` at all and is a whole
     * plugin. A plugin that DOES wake has scoped conversations, and a scoped
     * conversation's file can be renamed out from under it — so there is no
     * plugin for which this is inapplicable, and an optional field would be a
     * plugin that rings and then, on the one day it matters, says nothing.
     *
     * ## IT USED TO BE NOTHING AT ALL, and the silence was the defect
     *
     * A person scopes a conversation to `lanes.olai`; somebody renames the
     * file. The doorbell's derivation is a pure function of the revision and
     * finds no such file, so it derives nothing — forever — while the strip
     * goes on drawing the control as ON. That silence is byte for byte the
     * silence of a fleet with nothing standing, on every channel there is, and
     * this PR retires the hand-run fleet watch that was the second opinion. A
     * quiet doorbell and a broken one must not look alike, so the broken one
     * says so, once, in the conversation it stopped ringing
     * (`@olai/chat`'s `Chat.faults`).
     */
    readonly gone: string
    /**
     * ...AND WHAT IT IS TOLD WHEN THE FILE IS RIGHT THERE AND IS NOT A KIND
     * THIS WAKE CAN WATCH — {@link kinds}' other half, on the same terms as
     * {@link gone} and for the same reason.
     *
     * ## Two causes, two sentences, and never one sentence with an *or* in it
     *
     * The consequence is identical — nothing is watched, nothing is derived, and
     * the row leaves this plugin's door so that no heartbeat can go on claiming
     * a live watch over it — but WHAT HAPPENED is not, and a person reading
     * either one has a different thing to do about it. A single sentence
     * covering both would say *renamed, or moved, or deleted, or not an
     * outline* on every rename for ever, which is the message paying, in the
     * common case, for a state that only a stored pick can be in.
     *
     * ## How a conversation gets into this state at all, now the picker cannot
     *
     * The picker offers only {@link kinds}, so nothing a person presses today
     * can reach it. What can: a pick stored before that filter existed (the
     * `2026-09-01.md` in the human's screenshot), a tab left open from an older
     * serve, and a record edited by hand. All three are a row on disk that
     * outlives a picker-only fix, which is why this is a fault the serve
     * DERIVES per revision rather than a refusal at the write.
     *
     * REQUIRED for {@link gone}'s reason exactly: a plugin that rings has stored
     * picks, and a stored pick can name any path at all.
     */
    readonly unwatchable: string
  }
}

/**
 * ONE PLUGIN'S PROBE, WITH THE ENVIRONMENT ALREADY IN IT — what a chat session
 * is handed a list of.
 *
 * The name rides along because it is the one word core knows about a plugin, and
 * a caller that has probed four things and is about to say something about one
 * of them has nothing else to call it. It is NOT what the answer is filed
 * under: a `Probed`'s two halves each carry their own name, minted by the
 * plugin, because the name on a roster row is a SERVER's and a plugin may hand
 * over a server called something else.
 */
export interface Probe {
  readonly name: string
  /** Ask this host. One call, one answer, both halves ({@link Probed}) — and
   *  it NEVER REJECTS: every way of failing is an arm of that answer, because
   *  "not here" is a state and "here and broken" is a sentence somebody reads.
   *  A caller cannot honestly recover from a rejection, since the only two
   *  moves left to it are silence and composing a sentence it may not
   *  compose. */
  readonly ask: () => Promise<Probed>
}

/**
 * ...AND THE LIST, out of the plugins this serve runs — the one place the
 * environment meets a probe.
 *
 * A composition root filters {@link SERVERS} with `enabled` and passes the
 * result: a plugin left out of `--plugins` contributes no probe here, so it
 * never spawns anything and no session ever waits on it, which is what the
 * registry's header already claims that absence means.
 *
 * It reads two fields and asks for nothing else, which is the same discipline
 * `enabled` keeps one file over: a helper that took `PluginServerHalf<Revision>`
 * would drag the vault's vocabulary into a signature about finding executables,
 * and this package names no revision.
 */
export const probesOf = (
  plugins: ReadonlyArray<{
    readonly name: string
    readonly probe?: (env: Record<string, string | undefined>) => Promise<Probed>
  }>,
  env: Record<string, string | undefined>,
): ReadonlyArray<Probe> =>
  plugins.flatMap((plugin) => {
    const ask = plugin.probe
    return ask === undefined ? [] : [{ name: plugin.name, ask: () => ask(env) }]
  })

/**
 * WHAT THIS BINARY CAN SERVE — the same two plugins {@link WIRES} lists, with
 * their runtime halves on them.
 *
 * `satisfies` against `PluginServerHalf<never>` and not against a concrete
 * revision, which is the weakest constraint that still checks everything this
 * package can check: the name, the surface, the face maps, the SERVICES a half
 * asks for (a parameter is contravariant, so a plugin that asked for a field
 * core does not offer is a type error on this line), and the shape of what comes
 * back. `never` is the one thing left unchecked here and it is checked there —
 * `@olai/server` re-states this list against the reading it actually passes, and
 * a plugin that wanted something the vault does not carry fails at the root
 * naming this list.
 *
 * A tuple (`as const`), for `WIRES`' reason: a widened array would take the key
 * types of anything derived from it along with it.
 */
/** The two filters, re-exported beside the halves they filter — so a
 *  composition root reaches ONE door for "which plugins run and what do they
 *  need", rather than one for the list and another for the test that narrows
 *  it. They are declared in `./surfaces.ts` because the question is about
 *  NAMES and the wire door answers it too. */
export { enabled, isEnabled, kindWordOf, PLUGIN_NAMES } from "./surfaces.ts"

export const SERVERS = [kolu, odu] as const satisfies ReadonlyArray<PluginServerHalf<never>>

/**
 * THE KIND VOCABULARY, ASSEMBLED — the two maps `@olai/format` takes, out of
 * the two lists this composition root already holds.
 *
 * TWO ARGUMENTS AND NOT ONE FILTERED HERE, because the two halves answer two
 * questions and this module is not the one that decides which plugins run: the
 * root passes {@link SERVERS} for what the BINARY was built with and
 * `enabled(SERVERS, pin)` for what this SERVE runs, and the distance between
 * them is what `--plugins` means. A DECLARATION is refused against the first —
 * so `{"type":"kolu-terminal"}` is a legal row on a machine running only odu, and a
 * file's verdict does not depend on a flag it cannot see — and a VALUE is held
 * to the second, because {@link PropKind.admits} is a promise only a plugin
 * that is here can make (`@olai/format`'s `KindVocabulary` argues both).
 *
 * TWO PLUGINS MAY NOT CLAIM ONE WORD, and the check is here for
 * the framework's `mergeDisjointGroups` reason exactly: the assembly underneath
 * is a `Map.set`, so a collision would resolve silently in favour of whichever
 * was written last — one plugin's `admits` quietly judging another plugin's
 * values, with nothing red anywhere. The wire has `assertTagSegment` to make
 * sibling keys disjoint by construction; a kind word has nothing of the sort,
 * so it is asserted.
 *
 * It names no plugin and reads two fields, which is `probesOf`'s discipline
 * one member over: this package names no revision and no format, and what
 * crosses is a table.
 */
export const kindsOf = (
  built: ReadonlyArray<{ readonly name: string; readonly kinds?: ReadonlyArray<PropKind> }>,
  running: ReadonlyArray<{ readonly name: string; readonly kinds?: ReadonlyArray<PropKind> }>,
): {
  readonly built: ReadonlyMap<string, ComposedKind>
  readonly enabled: ReadonlyMap<string, ComposedKind>
} => ({ built: tableOf(built), enabled: tableOf(running) })

/** ONE PLUGIN'S KIND, COMPOSED — its word prefixed with the plugin's name, and
 *  the KEY it claims by convention, which is that same word. What the format
 *  reads is this rather than the bare row a plugin wrote. */
export interface ComposedKind extends PropKind {
  readonly claims: string
}

/**
 * One list of plugins as one table, COMPOSED — the words a vault may declare,
 * each carrying the name of the plugin that answers for it.
 *
 * A plugin contributes a BARE word and this is where it gets its prefix
 * ({@link kindWordOf}): kolu contributes `terminal` and a vault declares
 * `kolu-terminal`. It is the same move the wire makes one member over, for the
 * same two reasons — see {@link kindsOf}'s header — and the COUNT is here for
 * `mergeDisjointGroups`' reason: the assembly underneath is a `Map.set`, so a
 * dropped word would be one plugin's `admits` quietly judging another's values
 * with nothing red anywhere. Prefixing makes that unreachable; the count is
 * what makes it a fact rather than a belief, and the message names BOTH
 * plugins because the useful half of a collision report is which two claimed it.
 *
 * `claims` IS THE COMPOSED WORD, and that equality is the whole of what a
 * built-in declaration is: enabling kolu declares the key `kolu-terminal` and
 * can never declare anything else. A vault's own `terminal` column is
 * untouchable by a flag on the machine.
 */
const tableOf = (
  plugins: ReadonlyArray<{ readonly name: string; readonly kinds?: ReadonlyArray<PropKind> }>,
): ReadonlyMap<string, ComposedKind> => {
  const table = new Map<string, ComposedKind>()
  const by = new Map<string, string>()
  for (const plugin of plugins) {
    for (const kind of plugin.kinds ?? []) {
      const word = kindWordOf(plugin.name, kind.kind)
      const already = by.get(word)
      if (already !== undefined) {
        throw new Error(
          `plugins: "${already}" and "${plugin.name}" both contribute the property `
            + `kind "${word}" — a vault declaring it would be judged by whichever `
            + `was composed last, which the assembly resolves silently.`,
        )
      }
      by.set(word, plugin.name)
      table.set(word, { ...kind, kind: word, claims: word })
    }
  }
  return table
}
