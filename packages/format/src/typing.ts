/**
 * TYPED PROPERTIES: what a key may DECLARE, and what a value has to be.
 *
 * `./custom.ts` is the one open field, and it is open all the way — any key,
 * and olai gives none of them a meaning. That is still true and is what makes
 * this file a fence rather than a schema: a key with no declaration is `text`,
 * so typing is OPT-IN PER KEY and a vault that declares nothing behaves exactly
 * as it did before this module existed. Nothing here gives a key a meaning
 * either. **Typing constrains the value; it grants no meaning** — a `date`-typed
 * property still does not put its node on a day page, because a property is not
 * a mark (docs/format.md's standing rule).
 *
 * What it buys is the sentence the whole feature is named after. A live lane
 * node used to say
 *
 * ```
 * merge       AUTO: grok review folded + CI green; gate = index≡scan …
 * dispatched  2026-08-25 10:06 (sweep queue #5; the slot freed by #387's merge)
 * ```
 *
 * where `merge` is a word a driver switches on and `dispatched` is a date with
 * a story stapled to it. THE VALUE IS THE VALUE; the story belongs in the note.
 * Declaring the two keys is what makes that a refusal instead of a convention
 * somebody remembers (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/typed-properties.md).
 *
 * ## The seven kinds this format owns, and the ones it does not
 *
 * `text`, `date`, `int`, `path`, `doc`, `ref`, `node` ({@link PropType}). There
 * is deliberately no `sum`: AN ENUM IS A REF. `merge`'s declaration has
 * children titled `auto` and `human`, and a ref value is the ID of one of the
 * parent's children — so adding a variant is adding a child row rather than
 * editing a pipe-separated string inside a property, which is exactly the
 * sloppiness this feature refuses. `agent`'s roster happens to live elsewhere
 * (`{kind: "ref", under: "agents-roster"}`) and is the same mechanism pointed
 * at a different place.
 *
 * **A ref value is an ID** — the pin and mirror rule, for the pin and mirror
 * reason: names rename, ids don't. Variant ids are chosen short at declaration
 * time (`auto`, `human`), which is safe because the duplicate-id fence makes any
 * clash loud at add-time. The id is the STORED truth; what a chip DRAWS is the
 * variant's title, resolved where the set is and shipped to the tab as an answer
 * ({@link ./meaning.ts}) — so a variant may be renamed without a single value
 * moving, which is the whole of what "names rename, ids don't" buys.
 *
 * ## AN EIGHTH ARM, AND THE VOCABULARY BEHIND IT IS A PARAMETER
 *
 * A `terminal` is not one of the seven and neither is a `worktree`, and this
 * package may not learn either word: `@olai/format` imports no plugin, because
 * the registry that knows the plugins imports this. So the eighth arm carries
 * a WORD rather than being one — `{kind: "contributed", word}` — and what that
 * word may be is handed IN, as {@link KindVocabulary}, by the composition root
 * that already holds the enabled manifests. It is the same move the vault
 * walks make in the other direction: the judgement is the plugin's, the walk
 * is olai's, and what crosses is data.
 *
 * ONE ARM AND NOT AN OPEN STRING, which is the whole reason this is cheap. The
 * kind vocabulary is closed in five type-coupled places — the union, its two
 * tables ({@link PROP_KINDS}, {@link PROP_KIND_TAKES}), the switch that refuses
 * a value ({@link wrongOne}) and the switch that draws one
 * ({@link ./meaning.ts}'s `declaredly`) — and every one of them stays
 * exhaustive, because a contributed kind is ONE arm the compiler counts rather
 * than a `default` it does not. The two tables are keyed by
 * {@link BuiltInKind}, so an eighth BUILT-IN kind is still a type error in
 * four other places, and a contributed kind cannot silently stop being handled
 * anywhere.
 *
 * THE READING TAKES NO TABLE, which is what keeps {@link declarationsOf}'s memo
 * keyed by the view alone: a word the seven do not claim reads as
 * `contributed` whatever any plugin says, and only the two places a REFUSAL is
 * worded consult the vocabulary. Which of them consults WHICH vocabulary is
 * the one asymmetry worth carrying in the head, and {@link KindVocabulary}
 * argues it: a declaration is refused against what this BINARY was built with,
 * and a value is held to what this SERVE is running.
 *
 * ## Where the declarations are
 *
 * `_olai/Properties.org`, read BY NAME like the shelf and the inbox
 * ({@link ../node.ts}'s `propertiesIn`). One node per key, the TITLE is the
 * key, the type is spelled in that node's own props, and an enum's variants are
 * its children:
 *
 * ```jsonl
 * {"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}
 * {"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}
 * {"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}
 * {"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}
 * {"id":"prop-agent","ord":"a2","title":"agent","custom":{"type":"ref","under":"agents-roster"}}
 * ```
 *
 * DATA, NOT CONFIG, which is the olai way and is load-bearing rather than
 * stylistic: editing the vocabulary is editing an outline, there is no file
 * format to learn and no restart, and the declarations page is readable in olai
 * like anything else. Per-outline declarations were considered and rejected —
 * props are ONE namespace across the vault, and `merge` on a lane and `merge`
 * anywhere else should mean one thing, or a key's meaning depends on where the
 * reader is standing.
 *
 * ## Where the recursion grounds
 *
 * A declaration is itself a node carrying properties (`type`, `under`, `base`),
 * so the obvious question is what types THOSE. {@link BOOTSTRAP} does, and it is the
 * one place this stops: a built-in table, in code, checked against the records
 * of the declarations file and nowhere else. A vault cannot re-declare `type`,
 * and a `Properties.org` that says something the table does not know is a
 * broken file naming the key — which is how every other validation rule
 * reports.
 *
 * ## Two doors, one rule
 *
 * The check is asked at the PLAN — every door that writes a property, which is
 * `set_prop`, `add_node`'s `props` (children included), `apply`, `update` and
 * `capture` — and again by the VALIDATOR over what is on disk. A live write is
 * REFUSED, with the allowed values named; a hand edit that lands a bad value
 * makes the file broken, naming the key. Exactly the arrangement `after`
 * cycles, unknown targets and `doc` already have, and for the same reason: a
 * person moving between a refusal in a tool result and an error on a page must
 * read one sentence, so the sentence is written once, here
 * ({@link wrongValue}), and both callers wrap it.
 *
 * `duplicate_node` of an ordinary subtree has no value-refusal of its own: a
 * copy is isomorphic to something the validator has already approved, so it
 * can carry no value the set did not already hold. A copy of a Properties
 * ROOT is a declaration, and is the same existing-values fence every other
 * write that mints one is. The gate re-validates either way.
 *
 * ## What it costs
 *
 * One node's props against one small map. `ref` and `node` read indexes the
 * validator already builds (`byId`, `children`); `doc` reads the `.md` set the
 * `doc` FIELD's rule already carries. Nothing here walks the corpus, which is
 * what lets the check ride every write rather than joining the whole-set sweep.
 *
 * ONE READER ABOVE DOES WALK, and it is named here so the sentence above stays
 * true rather than nearly true: a `ref` or `node` value is a REFERENCE, so the
 * two ops that take records OUT of the set have to ask who still names what is
 * going (`@olai/ops`' `namingByProp`). No index can answer that — which keys
 * are references is a fact about what the vault DECLARES, not about the format,
 * so `namedBy` structurally cannot hold it. That walk is per REMOVAL, guarded on
 * the vault declaring such a key at all, and never on the write path.
 */

import { Result } from "effect"

import { type CustomValue, customOrder, type HasCustom } from "./custom.ts"
import type { Derived } from "./derive.ts"
import { resolveRelative } from "./documents.ts"
import {
  isRegular,
  type Located,
  type LocatedRegular,
  propertiesIn,
  type RegularNode,
  shadowFor,
} from "./node.ts"
import { didYouMean, didYouMeanDeclared } from "./suggest.ts"

// ── the vocabulary ─────────────────────────────────────────────────────

/**
 * WHAT A KEY MAY DECLARE ITSELF TO BE.
 *
 * A discriminated union rather than a bare string, because exactly one arm
 * carries anything: `ref` may name the place its variants live. Everything else
 * is a word.
 *
 * `doc` and `path` STAY TWO KINDS (human, 2026-08-25) — a served document is a
 * different promise from a path-shaped string, and collapsing them would make
 * `brief` and `worktree` one thing that is true of neither.
 */
export type PropType =
  /** The default — every key today, and every key nobody declared. A DECLARED
   *  `text` is not the same as an undeclared one: it is the durable blessing
   *  ("this prose is deliberate") in the one place a future tidier will look,
   *  which is what `from` was declared for. */
  | { readonly kind: "text" }
  /** An ISO day or instant, and nothing else — the story goes in the note. */
  | { readonly kind: "date" }
  /** A number, not a string that has one in it: `records: 193`. */
  | { readonly kind: "int" }
  /** Path-shaped, and it may point anywhere — `worktree`. WHERE a relative one
   *  resolves from is the key's own to say ({@link PathBase}). */
  | { readonly kind: "path"; readonly base?: PathBase }
  /** A path that names a document this directory SERVES — `brief`. It carries
   *  the same declared basis, for a sharper reason: this kind PROMISES the
   *  value resolves to something served, and where it resolves FROM is half of
   *  that promise. */
  | { readonly kind: "doc"; readonly base?: PathBase }
  /** One of a parent's children, BY ID. Absent `under` means the declaration's
   *  own children, which is what makes an enum a ref with no extra machinery. */
  | { readonly kind: "ref"; readonly under?: string }
  /** Any node in the set — `item`, `superseded-by`. */
  | { readonly kind: "node" }
  /**
   * A WORD A PLUGIN TAUGHT THIS VAULT — `terminal`, `worktree` — carried as
   * data rather than spelled as an arm, because this package names no plugin
   * (the module header argues the direction).
   *
   * The word is the DECLARED one, verbatim, and is kept whether or not
   * anything answers to it: a kind whose plugin this serve is not running is
   * still a declaration somebody wrote, and reading it as `text` instead would
   * lose the fact that {@link sameTyping} has to compare.
   */
  | { readonly kind: "contributed"; readonly word: string }

/** The seven this FORMAT owns — every arm but the eighth, which owns no word
 *  of its own. The two tables below are keyed by this rather than by
 *  `PropType["kind"]`, which is what keeps them honest in both directions: an
 *  eighth built-in kind is a type error in both, and neither has a row for
 *  `contributed`, which has nothing to say without a vocabulary. */
export type BuiltInKind = Exclude<PropType["kind"], "contributed">

/** Every built-in kind's word, in the order this module documents them. Read by
 *  {@link BOOTSTRAP} and by the sentence a bad `type` is refused with, so a
 *  kind added to the union above and forgotten here is a type error rather than
 *  a word the declarations file quietly stops accepting. */
export const PROP_KINDS = [
  "text",
  "date",
  "int",
  "path",
  "doc",
  "ref",
  "node",
] as const satisfies ReadonlyArray<BuiltInKind>

/**
 * What each kind TAKES, as the clause a refusal names it with — the legal
 * word and the shape it requires, in one phrase per kind.
 *
 * Read by {@link BOOTSTRAP} so a kind added to the union above and forgotten
 * here is a type error rather than a word the declarations file quietly stops
 * explaining. The order is {@link PROP_KINDS}' so the sentence a bad `type` is
 * refused with cannot drift from the list the table accepts.
 */
export const PROP_KIND_TAKES = {
  text: "`text` (anything)",
  date: "`date` (an ISO day or instant)",
  int: "`int` (a digit run)",
  path: "`path` (no whitespace; optional `base`)",
  doc: "`doc` (a served `.md`; optional `base`)",
  ref: "`ref` (a child's id; `under` names the parent)",
  node: "`node` (any node id)",
} as const satisfies Record<BuiltInKind, string>

/**
 * ONE KIND A PLUGIN TEACHES THIS VAULT — the word, the clause a refusal names
 * it with, and whether a value fits.
 *
 * THREE FIELDS AND ONE ENTRY, which is the invariant rather than the shape: the
 * gate that refuses a value and the reading that decides whether the value
 * wears the plugin's own face ({@link ./meaning.ts}) ask THIS entry, so there
 * is no second table for either of them to disagree with. That is the bug
 * family `./meaning.ts`'s header names, met before it can start — two opinions
 * about one value is how every one of those three defects was born.
 *
 * `takes` is the clause, in {@link PROP_KIND_TAKES}' own shape (`` `terminal`
 * (a padi terminal id)``), and it is spent at three doors: the list of legal
 * words a bad `type` is refused with, the live write's refusal of a bad value,
 * and the broken file's error about the same one. The plugin's words, because
 * only the plugin knows what its kind means — core composing a sentence about
 * somebody else's vocabulary is the thing this whole interface exists to stop.
 *
 * DECLARED HERE STRUCTURALLY and again in `@olai/plugin-api`'s `PropKind`, and the
 * two spellings are the arrangement rather than a duplication to tidy away:
 * this package sits a floor BELOW the plugin system and a plugin may not import
 * the registry at all, so the agreement is proved where the two ends meet — at
 * the composition root that assembles the table. It is `NotHere`'s trade, one
 * subject over.
 */
export interface ContributedKind {
  /** The word a declaration writes: `{"type":"sprocket"}` — an example, and a
   *  made-up one on purpose: this package has no opinion about which words a
   *  plugin contributes and could not name a real one without acquiring one. */
  readonly kind: string
  /** What a refusal calls it — the plugin's own clause. */
  readonly takes: string
  /** Does this value fit. `false` is refused at the plan and reported by the
   *  validator, in one sentence, {@link ContributedKind.takes}'. */
  readonly admits: (value: string) => boolean
  /**
   * THE KEY THIS KIND CLAIMS BY CONVENTION — the built-in declaration, so a
   * person who turns a plugin on gets its faces without editing a file.
   *
   * A vault that says nothing about `terminal` is DECLARING it this kind, and
   * that is the whole of what this field buys: the alternative was every user
   * hand-writing a row in `_olai/Properties.org` before an enabled plugin
   * would draw anything, which the human rejected as the model. **Nothing ever
   * writes a user's vault**; the default is data, read at the same moment the
   * rows are.
   *
   * IT IS THE PLUGIN'S OWN FACT and sits beside its kind for that reason: which
   * key an appliance conventionally owns is exactly as much the plugin's
   * business as which word it teaches. This package still knows neither — a
   * claim arrives here as a string on a table handed down, like everything else
   * about a contributed kind.
   *
   * THE VAULT ALWAYS WINS ({@link withClaims}), including winning by declaring
   * the key something else entirely: a board that writes `{"type":"path"}` on
   * its `worktree` column has said what it means, and the plugin's claim does
   * not argue. That is the one precedence rule in the system and it is spelled
   * once.
   *
   * Absent is a kind that claims no key — a whole kind, and the state of any
   * word a vault is expected to hang wherever it likes.
   */
  readonly claims?: string
}

/**
 * WHAT WORDS A DECLARATION MAY NAME BEYOND THE SEVEN — handed in, because this
 * package imports no plugin.
 *
 * TWO MAPS, AND THE DISTANCE BETWEEN THEM IS WHAT `--plugins` MEANS. It is not
 * a redundancy: the two are asked by two questions that must answer
 * differently, and collapsing them breaks one or the other.
 *
 *   - {@link built} is what this BINARY knows how to mean, and it is what a
 *     DECLARATION is refused against. A vault that names `terminal` while this
 *     serve runs `--plugins=odu` wrote a legal word; refusing it would make one
 *     directory's `Properties.org` broken on one machine and clean on the
 *     next, which is the one thing a file's verdict may not depend on.
 *   - {@link enabled} is what this SERVE actually runs, and it is what a VALUE
 *     is held to. A kind nobody is answering for cannot say whether a value
 *     fits — so it does not, and the value is plain text: still a name, still
 *     stored, wearing no face. That is the state every vault that never heard
 *     of the plugin is already in, which is why it costs no mechanism.
 *
 * `enabled` is a subset of `built` by construction (both are assembled from
 * one registry, the second filtered), and nothing here asserts it because
 * nothing here could: the assembly is the composition root's.
 */
export interface KindVocabulary {
  /** Every kind this binary was BUILT with — the legal words. */
  readonly built: ReadonlyMap<string, ContributedKind>
  /** ...and the ones this serve RUNS — the words that judge a value. */
  readonly enabled: ReadonlyMap<string, ContributedKind>
}

/** A build that composed no plugin — which is not a fallback but a serve
 *  somebody can ask for (`--plugins=`), and is what every reader below one
 *  answers with when nobody hands it a vocabulary. One value rather than a
 *  fresh pair of empty maps per call, for {@link NO_TYPING}'s reason. */
export const NO_KINDS: KindVocabulary = { built: new Map(), enabled: new Map() }

/** Every legal `type` word, as the clause each is named with — the seven this
 *  format owns and then whatever the build taught it. Read by
 *  {@link BOOTSTRAP}, so the sentence a bad `type` is refused with and the
 *  words the reading accepts cannot drift. */
const kindsTaken = (kinds: KindVocabulary): string =>
  [
    ...PROP_KINDS.map((kind) => PROP_KIND_TAKES[kind]),
    ...[...kinds.built.values()].map((kind) => kind.takes),
  ].join(", ")

/** ...and the same list as bare words, for the did-you-mean. */
const kindWords = (kinds: KindVocabulary): ReadonlyArray<string> =>
  [...PROP_KINDS, ...kinds.built.keys()]

/**
 * WHERE A RELATIVE `doc` OR `path` VALUE RESOLVES FROM — the key's own answer,
 * declared beside its type.
 *
 * THE AMENDMENT THIS FACT IS, said plainly, because it settles a fight that ran
 * in code for a month. Two premises about one value were both true and neither
 * was written down: the validator resolved a `doc` BESIDE THE WRITING FILE (a
 * node names a file beside itself, which is what `doc` the FIELD means), and
 * the board wrote every `brief` VAULT-ROOT-RELATIVE (`brief briefs/tp.md` on a
 * record of `roadmap/features.org`, ~101 of them). So the display drew a door
 * onto `roadmap/briefs/tp.md`, which the directory does not serve, and every
 * one of those chips was dead — while the gate, asking the same question the
 * same way, was quietly refusing them too. The fix is not to pick a winner: it
 * is to make the premise a DECLARED FACT on the key's own row, so the two sides
 * read one answer and cannot drift apart again.
 *
 * `file` IS THE DEFAULT, and that is a compatibility rule rather than a
 * preference. A vault that declared nothing new keeps resolving exactly where
 * it did, so no value in any directory changes meaning because this field
 * arrived; a vault whose convention is the root says so, once, in one row.
 *
 * THE MARKDOWN `doc` FIELD IS NOT TOUCHED and never will be — it keeps
 * beside-the-writer as its only premise, because a note has no key to declare
 * on ({@link ./documents.ts}'s `docOf`). This fact is about a PROPERTY, whose
 * key is a row somebody can write a second word on.
 */
export type PathBase =
  /** From the served directory's root — the board's own convention, and what a
   *  value written by a convention rather than by somebody standing in a file
   *  means. */
  | "root"
  /** Beside the file the value was written in, exactly as a note's relative
   *  markdown link resolves. THE DEFAULT. */
  | "file"

/** Both bases, in the order this module documents them — read by
 *  {@link BOOTSTRAP} and by the sentence a bad `base` is refused with, for
 *  {@link PROP_KINDS}' reason. */
export const PATH_BASES = ["root", "file"] as const satisfies ReadonlyArray<PathBase>

/** What a key that declares no base takes. Stated as a value rather than as a
 *  `??` at each reader, because there are two readers — the gate and the
 *  display — and the whole point of this field is that they cannot differ. */
export const BASE_BY_DEFAULT: PathBase = "file"

/**
 * ONE KEY'S DECLARATION: what it is, and WHERE it was said.
 *
 * The declaring node's id is carried because `ref` needs it and nothing else
 * does: a ref with no `under` takes its variants from the declaration's own
 * children, so "which node's children" is a fact about where the declaration
 * SITS rather than about what it says. Resolving it into `under` at read time
 * would have been shorter and would have thrown away the one thing a refusal
 * needs to word itself well — whether the reader wrote a roster's name or an
 * enum inline ({@link wrongValue} says the two differently).
 */
export interface Declared {
  readonly type: PropType
  /** The id of the node in `_olai/Properties.org` that declares this key. */
  readonly at: string
}

/** A vault's declarations, by key. Absent from this map is `text`, which is
 *  the whole of what "typing is opt-in per key" means: nobody could capture
 *  anything until the vocabulary was declared otherwise. */
export type PropDeclarations = ReadonlyMap<string, Declared>

/** A vault that declares nothing — the answer for a directory with no
 *  `Properties.org`, and the default every reader that has none passes. One
 *  value rather than a fresh empty map per call, for `NO_PINS`' reason. */
export const NO_TYPING: PropDeclarations = new Map()

/**
 * WHAT A KEY A RECORD ACTUALLY WROTE DECLARES — the map read the way its keys
 * were put in ({@link keyOf}: trimmed and folded).
 *
 * Every reader on the WRITE side goes through this rather than through a bare
 * `.get`, and that is the whole of what makes the fence agree with the query
 * grammar: a record carrying `PR` is asking about the key a vault declared as
 * `pr`, exactly as `prop:PR` is. A `get` on the raw key would have made those
 * two words one thing to a search and two things to the gate.
 */
/** Trimmed and folded — the reconciliation {@link keyOf}, {@link declaredFor}
 *  and {@link unfitHeld} all have to make, and one spelling of it. */
const foldedKey = (word: string): string => word.trim().toLowerCase()

export const declaredFor = (
  declarations: PropDeclarations,
  key: string,
): Declared | undefined => {
  const folded = foldedKey(key)
  return folded === "" ? undefined : declarations.get(folded)
}

/**
 * The property key a declaration node's own `type` is written under, and the
 * one its `under` is.
 *
 * Values rather than literals at the four sites that read them, for the reason
 * every convention in this package is a value: the bootstrap table, the
 * declarations reading, the rule that checks a declaration and the doc that
 * teaches the file are four places one rename would have to reach.
 */
export const TYPE_KEY = "type"
export const UNDER_KEY = "under"
export const BASE_KEY = "base"

/**
 * THE FILE A RELATIVE VALUE OF THIS KEY RESOLVES AGAINST — the basis, applied.
 *
 * The ONE thing both arms of the consult share, and it is deliberately the
 * smallest thing that could be shared: the gate ({@link wrongDoc}) and the
 * display ({@link ./meaning.ts}'s `meaningOf`) each do their own arithmetic
 * with their own refusals, and what they may not do is disagree about where
 * they are standing.
 *
 * The empty string IS the root, which is not a sentinel but the arithmetic:
 * {@link ./documents.ts}'s `resolveRelative` takes the DIRECTORY of `from`, and
 * the directory of "" is the served root.
 *
 * Every other kind answers the default, and none of them asks: a `ref` names no
 * path, so what it would resolve against is not a question.
 */
export const basedAt = (declared: Declared | undefined, from: string): string =>
  baseOf(declared) === "root" ? "" : from

/**
 * WHERE A `doc` VALUE LANDS — the whole resolution, or `undefined` for a value
 * that is not a path at all.
 *
 * THE WHOLE RESOLUTION AND NOT JUST THE BASIS, which is the correction grok's
 * review forced and it is the sharper reading of the same law. `doc` is the one
 * kind that PROMISES its value names something served, so the gate and the
 * display are not two rules that happen to agree — they are one question asked
 * twice, and anything either does on its own is a second answer waiting to
 * happen. Sharing `basedAt` alone left two: `isPathShaped` accepts a leading
 * `/` and a `%20` where `pathedOf` refuses the first and decodes the second, so
 * a `doc` value spelled either way was accepted by the validator and drawn as
 * plain text — the family again, in the quieter direction.
 *
 * So the display asks THIS, and then asks the same corpus ({@link Typed}'s
 * `documents`, which is `./rules.ts`'s `markdownPaths`). What remains its own
 * is the sentence: a refusal has to say which half went wrong, and a chip has
 * only to know whether there is a door.
 *
 * `path` DOES NOT COME THROUGH HERE, and that asymmetry is the argued call
 * rather than an oversight: `path` promises a SHAPE and may point anywhere, so
 * its gate never claimed the value names anything and its display asks the
 * wider question — does this directory happen to serve what it resolves to,
 * whatever kind of file that is. Two arms of one consult can differ about what
 * they PROMISE; they may not differ about the same promise.
 */
export const resolvedDoc = (
  declared: Declared | undefined,
  from: string,
  value: string,
): string | undefined =>
  isPathShaped(value) ? resolveRelative(basedAt(declared, from), value) : undefined

/** WHAT THIS KEY'S ROW SAYS its paths resolve from — the fact itself, where
 *  {@link basedAt} is the fact applied. Read by the two callers that compare
 *  vocabularies rather than resolve a value ({@link sameTyping}). */
export const baseOf = (declared: Declared | undefined): PathBase => {
  const type = declared?.type
  return type?.kind === "doc" || type?.kind === "path"
    ? type.base ?? BASE_BY_DEFAULT
    : BASE_BY_DEFAULT
}

/**
 * One built-in type: what the key takes, and WHAT IS WRONG with a value that
 * does not — the sentence, not a boolean.
 *
 * A pair rather than a predicate, for {@link ./errors.ts}'s reason one layer
 * up: a rule and the sentence it says are two facts about the same thing, and
 * one declared in one place and worded in another is a pair that drifts. It
 * ANSWERS WITH THE SENTENCE rather than with a yes, which is the half `under`
 * needed — an id that exists and is a MIRROR is wrong for a reason a generic
 * "not a node in the set" would misreport, and a branch outside the table
 * would be the drift this shape exists to prevent.
 */
interface Grounded {
  /** What this word takes, as the clause that teaches it — a FUNCTION of the
   *  vocabulary, because exactly one of the three words has an answer that
   *  grew: `type` takes the seven kinds this format owns plus whatever the
   *  build taught it ({@link KindVocabulary}), where `under` and `base` say the
   *  same thing on every machine and ignore the argument. */
  readonly takes: (kinds: KindVocabulary) => string
  /** What is wrong with this value — or `undefined`, which is nearly every
   *  value. The clause completes "`under` is `x`, which …". */
  readonly wrong: (
    value: string,
    derived: Derived,
    kinds: KindVocabulary,
  ) => string | undefined
  /**
   * Does the check above RESOLVE A BARE ID in the set — so a file that did not
   * parse could have made it fail?
   *
   * Exactly one of the three words does (`under`), and it decides whether the
   * finding it produces is withheld while any file is unreadable
   * (`./errors.ts`'s `isGuessWhileUnreadable`, asked of the finding). It is a
   * field on the word rather than a list of words somewhere else for this
   * table's own reason: `type`, `under` and `base` are grounded HERE, and a
   * fourth word added without answering this would inherit the wrong answer
   * silently.
   */
  readonly resolves: boolean
}

/**
 * THE ONE PLACE THE RECURSION GROUNDS — the built-in types of a declaration's
 * own two properties.
 *
 * A declaration is a node carrying properties, so the obvious question is what
 * types THOSE, and the obvious answer — declare them in the file — is the
 * regress this table cuts. It is code, it is applied to the records of
 * `_olai/Properties.org` and to nothing else, and a vault cannot re-declare
 * either word: a property called `type` on an ordinary node is somebody's own
 * vocabulary and none of this format's business.
 *
 * `type` is a CLOSED WORD LIST ({@link PROP_KINDS}) rather than a `ref`,
 * because a ref's variants are nodes and the nodes that would hold these are
 * the very ones being declared. `under` is a NODE — any id in the set — which
 * is exactly what the field means, and is the one of the three that has to read
 * the set to answer. `base` is a second closed word list ({@link PATH_BASES}),
 * for `type`'s reason exactly: the two bases are a fact about this format, so
 * a vault cannot add a third by writing a node.
 *
 * THREE RESERVED WORDS, and that is what the table costs. A vault may not
 * declare a key called `type`, `under` or `base` ({@link keyOf}), because those
 * are what a declaration says about ITSELF; a node anywhere else is free to
 * carry all three, and none of this is any of that node's business.
 */
export const BOOTSTRAP: ReadonlyMap<string, Grounded> = new Map<string, Grounded>([
  [TYPE_KEY, {
    takes: kindsTaken,
    resolves: false,
    // THE BUILT VOCABULARY AND NOT THE ENABLED ONE, which is the asymmetry
    // {@link KindVocabulary} argues: a declaration is a fact about the vault
    // and a serve's `--plugins` is a fact about the machine, so a word this
    // binary knows how to mean is a legal word whether or not this process is
    // answering for it. The alternative — refusing here — makes one file
    // broken on one host and clean on the next, off a flag the file cannot see.
    wrong: (value, _derived, kinds) =>
      isBuiltInKind(value) || kinds.built.has(value)
        ? undefined
        : `is not a property type — write ${kindsTaken(kinds)}${
          didYouMean(value, kindWords(kinds))
        }.`,
  }],
  [UNDER_KEY, {
    takes: () => "the id of a node in the set — where a `ref`'s variants live",
    // THE ONE WORD THAT READS THE SET, which is why a finding about it is a
    // guess while any file is unreadable and the other two never are.
    resolves: true,
    // A MIRROR IS NOT A PLACE VARIANTS LIVE, and it is the one wrong value here
    // that would otherwise pass. A placement has no children of its own
    // ({@link ./node.ts}: children hang off the node a mirror points at), so a
    // declaration pointed at one would be accepted, produce an EMPTY variant
    // list, and then refuse every value of that key with "nothing is declared
    // under it YET" — a sentence naming the wrong problem, about a mistake in a
    // file nobody was looking at. So it is refused where it is made, in the
    // words every op that names a node already uses ({@link wrongNode}).
    wrong: (value, derived) => {
      const located = derived.byId.get(value)
      if (located !== undefined && isRegular(located)) return undefined
      return located !== undefined
        ? "is a mirror — a second placement rather than a node of its own, so " +
          "nothing hangs under it. Name the node it points at."
        : `no node declares${didYouMeanDeclared(value, derived.byId)}`
    },
  }],
  [BASE_KEY, {
    takes: () => `\`root\` or \`file\` — where a \`doc\` or \`path\` value resolves from`,
    resolves: false,
    // NO SET READING at all, which is what makes this the cheapest of the
    // three: the two bases are words this format knows, not nodes a vault
    // supplies, so the answer is the same in every directory.
    wrong: (value) =>
      isPathBase(value) ? undefined : "is not a base — write `root` (from the " +
        "served directory's root, which is what a value written by a convention " +
        "means) or `file` (beside the file the value was written in, which is " +
        `what a note's own relative link means)${didYouMean(value, PATH_BASES)}`,
  }],
])

// ── reading the declarations ───────────────────────────────────────────

/**
 * A VAULT'S DECLARATIONS, read off the set — the top level of whichever outline
 * is called `Properties.org`, one entry per key.
 *
 * THE TOP LEVEL ONLY, and it is the same rule the shelf keeps one convention
 * over: what hangs under a declaration is that declaration's own business, and
 * for a `ref` it is precisely the variants. A nested node is never a key.
 *
 * A RECORD THIS CANNOT READ IS SKIPPED rather than guessed at — a missing
 * `type`, a word the bootstrap does not know, an `under` on something that is
 * not a `ref`, a title that is not a usable key, a second declaration of a key
 * already declared. Every one of those is reported by the validator against the
 * declarations file itself ({@link wrongDeclaration}); making them ALSO refuse
 * every value of that key would answer one mistake with a hundred findings, in
 * the file nobody edited.
 *
 * FIRST DECLARATION WINS among duplicates, which is `byId`'s rule for a
 * duplicate id and is the same argument: the second claim is the mistake, so
 * the first is what every reader means.
 *
 * A MIRROR IS NOT A DECLARATION and is left out, because a placement carries no
 * title of its own — there is no key to name.
 */
export const declarationsOf = (
  derived: Derived,
  kinds: KindVocabulary,
): PropDeclarations => {
  const held = DECLARED.get(derived)
  // THE VOCABULARY IS PART OF THE ANSWER now ({@link withClaims}), so it is part
  // of what the memo may reuse. It is one value for the life of a serve — the
  // composition root assembles it once — so the identity check is a hit every
  // time in production and a correctness guard in a bench that hands two
  // different tables to one revision.
  if (held !== undefined && held.kinds === kinds) return held.declarations
  const declarations = declaringIn(derived, kinds)
  DECLARED.set(derived, { kinds, declarations })
  return declarations
}

/**
 * ONE READING PER VIEW AND VOCABULARY, and it is a memo rather than a cache: a
 * `Derived` is one revision of the set, so what that set declares cannot move
 * under it — and since a declaration is two layers now ({@link withClaims}), the
 * table it was folded with is part of the answer and therefore part of the key.
 *
 * IT IS ONE ENTRY, NOT A TABLE PER VOCABULARY, which is the honest shape rather
 * than a limitation to apologise for: a serve assembles its vocabulary once at
 * the composition root and never again, so the identity check below is a hit
 * every time in production. What it is FOR is a bench that hands two different
 * tables to one revision — there the entry is replaced rather than shared, which
 * costs a re-walk and answers correctly, where a memo keyed on the view alone
 * would answer the second caller with the first one's fold.
 *
 * A `WeakMap` for the reason `./validate.ts`'s ledger table is one, and that is
 * the only other table in this package keyed by a view: a revision nobody kept
 * takes its entry with it, and nothing above learns that anything is
 * remembered. What it buys is that the readers of this — the validator's two
 * arms, every search, and the write planner, which asks once per op of a batch
 * — pay one walk of the declarations file between them rather than one each. The walk
 * itself is small; the `propertiesIn` in front of it is `O(files)`, and that
 * one was worth not paying a hundred times for a hundred-op batch.
 */
const DECLARED = new WeakMap<
  Derived,
  { readonly kinds: KindVocabulary; readonly declarations: PropDeclarations }
>()

/** The walk itself — {@link declarationsOf} with the memo taken off, and the
 *  convention still asked of the derivation's own file list. */
const declaringIn = (derived: Derived, kinds: KindVocabulary): PropDeclarations =>
  declarationsIn(derived, propertiesIn(derived.byFile.keys()), kinds)

/**
 * THE SAME READING WHEN THE CALLER ALREADY KNOWS WHICH FILE DECLARES — the
 * walk with the convention taken off as well.
 *
 * ONE CALLER, and it is the reason this is a door rather than a private step:
 * the doors table a page ships ({@link ./page.ts}'s `doorsFor`) is a STANDING
 * VIEW, re-asked on every published revision and reused when nothing it read
 * moved (`@olai/format`'s `tape.ts`). Finding the file by walking
 * `derived.byFile.keys()` is taped as a dependency on the WHOLE index, so every
 * open page would rebuild for a keystroke in any file in the vault — where the
 * answer plainly depends on ONE file's records. The page knows which file from
 * the SET's own paths (which it is already holding, and which a record edit
 * does not move), and hands it here; what is read then is that file's records
 * and nothing else.
 *
 * `undefined` is a vault with no declarations file, which declares no key —
 * and is the answer for a directory that has none at all.
 */
export const declarationsIn = (
  derived: Derived,
  file: string | undefined,
  kinds: KindVocabulary,
): PropDeclarations => {
  if (file === undefined) return withClaims(NO_TYPING, kinds)
  const declarations = new Map<string, Declared>()
  for (const located of declaringIn0(derived, file)) {
    const key = keyOf(located.node.title)
    if (key === undefined || declarations.has(key)) continue
    const type = typeIn(derived, located.node)
    if (type === undefined) continue
    declarations.set(key, { type, at: located.node.id })
  }
  return withClaims(declarations, kinds)
}

/**
 * THE TWO LAYERS, FOLDED — and the ONE place precedence is decided.
 *
 * A vault's `_olai/Properties.org` is one source of declarations. An enabled
 * plugin's {@link ContributedKind.claims} is the other: the key it owns by
 * convention, declared for a vault that has said nothing about it, so turning a
 * plugin on is the whole of turning its faces on. Nothing writes anybody's
 * vault to do it.
 *
 * **THE VAULT WINS**, always, and in both directions:
 *
 *   - a row that declares the claimed key the SAME kind changes nothing;
 *   - a row that declares it something else — `{"type":"path"}` on `worktree`,
 *     which is what one real board says — wins, and the plugin's face goes
 *     dark. That is a vault stating what it means, and a default that argued
 *     back would be the plugin overruling the person.
 *
 * WHY IT IS ONE FUNCTION. Precedence is the kind of rule that gets restated: a
 * second reader that folded the other way, or forgot a layer, would be two
 * answers to "what is this key" — the bug family {@link ./meaning.ts}'s header
 * is a list of, arrived at from a new direction. Every reader in the tree gets
 * declarations through {@link declarationsOf} or this function, so there is one
 * fold and no consumer can tell which layer a row came from. That is the point:
 * the validator, the write gate, the licence consult and the dressing table all
 * keep taking THE DECLARATIONS as one value.
 *
 * IT RIDES `enabled`, NOT `built`, and that is what makes a disabled plugin
 * free. A serve running `--plugins=odu` has no `terminal` kind in `enabled`, so
 * no claim, so the key is undeclared — byte-identical to a vault that never
 * heard of kolu. Built ≠ enabled needed no new rule to say so.
 *
 * THE KEY IS FOLDED on the way in ({@link keyOf}, the same reconciliation every
 * other reader of this map makes), so a plugin that claims `Terminal` and a
 * vault that writes `terminal` are talking about one key rather than two.
 *
 * TWO PLUGINS CLAIMING ONE KEY is refused where the vocabulary is ASSEMBLED
 * (`@olai/plugin-api`'s `kindsOf`), beside the refusal for two plugins claiming one
 * word — not here. This is a pure fold over a table somebody else has already
 * proved well-formed, and a fold that also validated would be a second sentence
 * about one mistake, in a function tests call with tables they built themselves.
 */
export const withClaims = (
  vault: PropDeclarations,
  kinds: KindVocabulary,
): PropDeclarations => {
  const claimed: Array<readonly [string, Declared]> = []
  for (const kind of kinds.enabled.values()) {
    if (kind.claims === undefined) continue
    const key = keyOf(kind.claims)
    if (key === undefined) continue
    // `at` is EMPTY, and it is the honest answer rather than a placeholder:
    // there is no node, because there is no row. The one reader that spends it
    // looks the id up in the set and draws nothing when it finds nothing
    // (`./rules.ts`'s `judgedFrom`, which already has that arm for a
    // declaration whose node has since been removed), so a finding about a
    // claimed key is its own sentence with no "declared here" to follow.
    claimed.push([key, { type: { kind: "contributed", word: kind.kind }, at: "" }])
  }
  // The claims go in FIRST and every vault row lands on top. Spelled as one
  // `Map` construction rather than a copy-then-overwrite because that IS the
  // precedence — reading it any other way requires reading two statements.
  return claimed.length === 0 ? vault : new Map([...claimed, ...vault])
}

/**
 * THE DECLARATIONS FILE'S TOP-LEVEL RECORDS, IN LINE ORDER — and the line order
 * is the reconciliation rather than an implementation detail.
 *
 * `rootsOf` would give them in SIBLING order (by `ord`), and the rule that
 * reports a duplicate key walks the file's records as they are ON DISK
 * ({@link ./rules.ts}'s `reportDeclarations`, which has to, since it also asks
 * about the variants). Two orders is two answers to one question the moment a
 * hand-written file has an `ord` that disagrees with its line order: the
 * reading would keep one declaration and the rule would report the other as the
 * second claim, so a vault could be told to fix the very line its values were
 * being checked against.
 *
 * LINE ORDER wins because it is the one the REPORT is anchored in — a finding
 * names `file:line`, findings sort by line, and "the second claim is the
 * mistake" is a sentence about what a reader is looking at. It is also the
 * duplicate-id rule's own order one level up, which is the same rule about the
 * same kind of clash.
 */
const declaringIn0 = (
  derived: Derived,
  file: string,
): ReadonlyArray<LocatedRegular> =>
  (derived.byFile.get(file) ?? [])
    .filter((at): at is LocatedRegular => isRegular(at) && at.node.parent === undefined)

/**
 * THE KEY A DECLARATION'S TITLE NAMES — trimmed and FOLDED — or `undefined` for
 * a title that names no usable key.
 *
 * FOLDED is the other reconciliation, and it is the same one `prop:` already
 * made: the query grammar folds its tokens and the key scan folds the map's
 * keys, because a property is something somebody typed into a map that gives no
 * key a spelling ({@link ./filter.ts}'s `propKeyOf`). A vault declaring `pr`
 * and a record carrying `PR` are one key to a reader and to a search, so they
 * have to be one key to the fence as well — otherwise `prop:RECORDS=190..200` is a
 * span while `set_prop {"key":"PR"}` is untyped, which is the grammar and the
 * gate disagreeing about the same word.
 *
 * ONE FUNCTION, for the reason everything else here is one: the reading, the
 * rule that reports a duplicate and every lookup on the write path all have to
 * fold the same way, and three spellings of `.trim().toLowerCase()` is three
 * places for one of them to stop.
 */
export const keyOf = (title: string): string | undefined => {
  const key = foldedKey(title)
  if (key === "" || shadowFor(key) !== undefined || BOOTSTRAP.has(key)) return undefined
  return key
}

/**
 * What one declaration node SAYS, or `undefined` for one that says nothing this
 * module can read.
 *
 * NO VOCABULARY REACHES HERE, and that is the load-bearing shape rather than a
 * convenience. {@link declarationsOf} memoises this walk under a `WeakMap`
 * keyed by the VIEW, and a reading that varied with a table handed in per call
 * would make that key insufficient — one revision, two answers, filed under
 * one entry. So an unknown word reads as `contributed` whatever any plugin
 * says, and every question that needs the table is asked where a REFUSAL is
 * worded ({@link wrongOne}, {@link wrongDeclaration}).
 *
 * WHICH MAKES THIS READING WIDER THAN THE RULE, deliberately, and the pair is
 * the SAME arrangement an unknown word already had rather than a new
 * divergence: `type: banana` used to be skipped here and reported by
 * {@link wrongDeclaration}, leaving the key untyped and its values plain text
 * with ONE finding in the file somebody actually got wrong. It is read as a
 * contributed kind nobody answers for now, which is that same untyped-and-
 * reported state reached by the other road — and it carries the word, which is
 * the one thing the old reading threw away and {@link sameTyping} needs.
 *
 * Shared by the reading above and the rule that reports a declaration so the
 * two cannot disagree about which records are DECLARATIONS — a key the reading
 * skipped and the rule accepted would be a key that is silently untyped and
 * reported clean.
 */
const typeIn = (derived: Derived, node: RegularNode): PropType | undefined => {
  const said = customText(node, TYPE_KEY)
  const under = customText(node, UNDER_KEY)
  const base = customText(node, BASE_KEY)
  if (said === undefined) return undefined
  // THE TWO PATH KINDS take the second word, and only they: `base` on anything
  // else is the same mistake `under` on anything else is, refused the same way
  // and reported by the same rule ({@link wrongDeclaration}'s pair rules).
  if (said === "doc" || said === "path") {
    if (under !== undefined) return undefined
    if (base === undefined) return { kind: said }
    return isPathBase(base) ? { kind: said, base } : undefined
  }
  if (base !== undefined) return undefined
  if (said !== "ref") {
    if (under !== undefined) return undefined
    // A CONTRIBUTED KIND TAKES NEITHER SECOND WORD, which is `int`'s and
    // `node`'s rule and not a new one: `under` names where a `ref` finds its
    // variants and `base` names where a path resolves from, and a word this
    // format does not own promises neither.
    return isBuiltInKind(said) ? { kind: said } : { kind: "contributed", word: said }
  }
  if (under === undefined) return { kind: "ref" }
  // THE TABLE DECIDES, not a second test spelled here — which is the whole of
  // what {@link Grounded} is for: a declaration this reading ACCEPTED and the
  // rule REPORTED would be a key that is silently untyped and reported clean,
  // and a declaration the reading accepted and the rule did not would be worse
  // still (a mirror as `under`, an empty variant list, and every value of the
  // key refused for a reason nobody could act on).
  //
  // {@link NO_KINDS} because the `under` word reads the SET and nothing else
  // — the vocabulary is `type`'s question, and handing this one a table would
  // be the per-call fact the header above says may not reach this walk.
  return BOOTSTRAP.get(UNDER_KEY)?.wrong(under, derived, NO_KINDS) === undefined
    ? { kind: "ref", under }
    : undefined
}

/** One of the declaration node's own two properties, as text — `undefined` for
 *  a key it does not carry AND for one holding a list, which is a shape neither
 *  of them has an answer for. */
const customText = (node: HasCustom, key: string): string | undefined => {
  const held = node.custom?.[key]
  return typeof held === "string" && held !== "" ? held : undefined
}

/** Is this word one of the seven this FORMAT owns? A type guard, so the branch
 *  above is one the compiler checks rather than a cast — and it says nothing
 *  about a contributed word, which is a fact about the BUILD and is asked of
 *  {@link KindVocabulary} instead. */
const isBuiltInKind = (word: string): word is BuiltInKind =>
  (PROP_KINDS as ReadonlyArray<string>).includes(word)

/** ...and is this one of the two bases. Its sibling above's shape, for its
 *  sibling above's reason. */
const isPathBase = (word: string): word is PathBase =>
  (PATH_BASES as ReadonlyArray<string>).includes(word)

/**
 * Whether two readings DECLARE THE SAME THING — what tells a write that moved
 * the vocabulary from one that did not.
 *
 * Written out rather than derived from a schema (which is how the wire's
 * readings compare themselves, `./shelf.ts`) because this is not a wire value:
 * it is a `Map` of a union, so there is no schema to derive from, and the
 * comparison is four fields deep at most. Its one caller is the narrowed
 * validator ({@link ./incremental.ts}), and what it decides there is whether
 * every value in the directory is back in question.
 *
 * WHERE a key is declared is compared too (`at`), and that is not
 * over-strictness: a `ref` with no `under` takes its variants from the
 * declaring node's own children, so the same key declared by a different node
 * is a different set of legal values.
 */
export const sameTyping = (one: PropDeclarations, other: PropDeclarations): boolean => {
  if (one.size !== other.size) return false
  for (const [key, declared] of one) {
    const against = other.get(key)
    if (against === undefined) return false
    if (declared.at !== against.at) return false
    if (declared.type.kind !== against.type.kind) return false
    const here = declared.type.kind === "ref" ? declared.type.under : undefined
    const there = against.type.kind === "ref" ? against.type.under : undefined
    if (here !== there) return false
    // ...and WHICH CONTRIBUTED WORD, which is the same argument as `under`
    // one arm over and is the quietest thing in this file to get wrong. The
    // eighth arm is the only kind whose identity is not its `kind` field: two
    // declarations both reading `contributed` may name two different plugins'
    // vocabularies, so a key retyped from `terminal` to `worktree` moves every
    // value of it — and a narrowed validator that compared only the arm would
    // go on approving those values against a premise the vault has retired,
    // with nothing on any screen to say so.
    const said = declared.type.kind === "contributed" ? declared.type.word : undefined
    const meant = against.type.kind === "contributed" ? against.type.word : undefined
    if (said !== meant) return false
    // ...and WHERE ITS PATHS RESOLVE FROM, for `under`'s reason one kind over: a
    // `doc` key that moved from `file` to `root` is every value of that key back
    // in question, and a narrowed validator that missed it would keep on
    // approving values against a premise the vault has retired.
    if (baseOf(declared) !== baseOf(against)) return false
  }
  return true
}

/**
 * THE IDS A `ref` MAY HOLD — the children of the place it points at, which is
 * `under` when it was named and the declaration's own node when it was not.
 *
 * Read off {@link Derived.children}, the index `checkTargets` and the validator
 * already build, so a roster stays DATA: add a node under `agents-roster` and
 * the sum grows, with no declaration to edit. A mirror filed there is left out
 * — a placement is not a variant, and a ref value naming one would be a value
 * pointing at a second view of something rather than at the thing.
 */
export const variantsOf = (
  derived: Derived,
  declared: Declared,
): ReadonlyArray<string> => {
  if (declared.type.kind !== "ref") return []
  const under = declared.type.under ?? declared.at
  return (derived.children.get(under) ?? [])
    .filter(isRegular)
    .map((child) => child.node.id)
}

// ── what a contributed kind licences ───────────────────────────────────

/**
 * DOES THIS VAULT DECLARE ANY KEY OF THIS KIND — the licence, asked once per
 * revision rather than once per record.
 *
 * The cheap half of the pair below, and the reason it is its own function: a
 * plugin's walk over the set is `O(records)` and almost every vault names no
 * `terminal` at all, so the walk asks this first and allocates nothing.
 *
 * A WORD RATHER THAN A `PropType`, because the callers are plugins and a plugin
 * knows its own kind's word and nothing about this union.
 */
export const declaresKind = (
  declarations: PropDeclarations,
  word: string,
): boolean => {
  for (const declared of declarations.values()) {
    if (declared.type.kind === "contributed" && declared.type.word === word) return true
  }
  return false
}

/**
 * WHAT THIS RECORD SAYS UNDER A KEY OF THIS KIND — the value, found by the
 * DECLARATION rather than by the key's name.
 *
 * THIS IS THE REVERSAL, and it is worth saying what it replaces: a plugin's
 * walk used to read one hardcoded key (`terminal`, `worktree`), so a vault got
 * a terminal door because somebody happened to name a property `terminal` and
 * a checkout was probed because somebody named one `worktree` — while `brief`
 * and `worktree`, both declared `path`, were indistinguishable to anything that
 * wanted to tell them apart. The vault now says which key means what, in the
 * one place it says everything else about its keys, and a key called anything
 * at all wears the face its DECLARATION names.
 *
 * IT WALKS THE RECORD'S OWN KEYS rather than looking one up, which is what
 * makes the folding right: a declaration's key is trimmed and folded
 * ({@link keyOf}), a record may have written `Terminal`, and those are one key
 * to `prop:` and to the fence — so the reconciliation is {@link declaredFor}'s,
 * asked of each key the record actually holds. A custom map is a handful of
 * entries, so this is cheaper than it looks and is only reached at all on a
 * vault {@link declaresKind} said yes about.
 *
 * THE FIRST IN THE RECORD'S OWN ORDER WINS where a record carries two keys of
 * one kind, which is `byId`'s rule for a duplicate claim and is the same
 * argument: a node naming two terminals has named neither, and picking by any
 * other rule would make two tabs draw two different rows off one record.
 *
 * A LIST IS NOT ONE VALUE. `custom` holds text or a list of it, and a kind
 * whose face is a door onto one thing has no reading of several — so a list is
 * stepped over here exactly as it is at every other single-value reader.
 */
export const textDeclaredAs = (
  declarations: PropDeclarations,
  node: HasCustom,
  word: string,
): string | undefined => {
  const custom = node.custom
  if (custom === undefined) return undefined
  for (const key of customOrder(custom)) {
    const type = declaredFor(declarations, key)?.type
    if (type?.kind !== "contributed" || type.word !== word) continue
    const held = customText(node, key)
    if (held !== undefined) return held
  }
  return undefined
}

// ── the canonical spellings ────────────────────────────────────────────

/**
 * A `date` VALUE'S ONE STORED SPELLING, or `undefined` for text that is not a
 * date at all.
 *
 * TWO WIDTHS, and only two: a DAY (`2026-08-25`) and an INSTANT written the way
 * `set_done` writes one (`2026-08-25T10:06:00-04:00` — local ISO, seconds, the
 * offset spelled out). That pair is the format's own, not this module's: a
 * date-only value that round-tripped through an instant would come back a
 * datetime, which is the reason `./parse.ts` validates dates as TEXT, and
 * inventing a clock face for a value that named a day would be that same lie
 * told by a different door.
 *
 * WHAT NORMALISING MEANS is one name, one spelling (the divergence sweep's
 * lesson). The obvious variants are accepted and folded into the canonical one:
 * surrounding space, a single-digit month or day, a SPACE where ISO writes `T`,
 * a missing `:00` of seconds, a fraction after them. A value carrying prose is
 * not a variant and is refused — `2026-08-25 10:06 (sweep queue #5)` is a date
 * with a story stapled on, and the story is what the note is for.
 *
 * `offset` IS WHAT A VALUE WITH A CLOCK FACE AND NO ZONE IS GIVEN, and passing
 * `null` is how a reader asks whether the text is ALREADY canonical. A door
 * hands the offset the write is being stamped with — the same clock `set_done`
 * reads, so a property and a mark written in one gesture agree about where the
 * writer is standing. The VALIDATOR hands `null`, because a rule about bytes on
 * disk may not consult a clock: it would make one file two verdicts depending
 * on which machine loaded it.
 */
export const canonicalDate = (
  value: string,
  offset: string | null,
): string | undefined => {
  const match = DATE_SHAPE.exec(value.trim())
  if (match === null) return undefined
  const [, year, month, day, hour, minute, second, zone] = match as unknown as [
    string,
    string,
    string,
    string,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ]
  const date = `${year}-${pad(month)}-${pad(day)}`
  if (!isRealDay(date)) return undefined
  if (hour === undefined || minute === undefined) return date
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? "0") > 59) {
    return undefined
  }
  const said = zone ?? offset
  if (said === null || said === undefined) return undefined
  // `Z` AND `+00:00` ARE ONE OFFSET AND TWO SPELLINGS, which is exactly the
  // thing this function exists to stop having. `./stamp.ts` writes the numeric
  // form for every offset including zero (`offsetOf(0)` is `+00:00`), so that
  // is the one this format holds — and a hand-written `…Z` is folded into it at
  // a door, and named as a broken file when it arrives on disk. Left alone, UTC
  // would have been the single zone in which two files meaning the same thing
  // differ byte for byte.
  return `${date}T${pad(hour)}:${minute}:${second ?? "00"}${said === "Z" ? "+00:00" : said}`
}

/**
 * The SHAPES a date value may arrive in — one regex, deliberately wider than
 * what comes out of {@link canonicalDate} and no wider than "obvious".
 *
 * Anchored at both ends, which is the whole fence: prose after a date does not
 * match, so `2026-08-25 10:06 (sweep queue #5)` is refused rather than trimmed
 * down to the part that parses. A refusal that silently kept half a value would
 * be worse than the sloppiness it was aimed at.
 */
const DATE_SHAPE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

/** Zero-padded to two, for a month, a day or an hour somebody wrote short. */
const pad = (value: string): string => value.padStart(2, "0")

/**
 * Is this `YYYY-MM-DD` a day that exists? Shape is not enough — `2026-02-30`
 * matches every date regex ever written and is still not a day — and this is
 * `./parse.ts`'s own calendar check, asked of a day rather than of an instant
 * so that both widths above reach it.
 */
const isRealDay = (date: string): boolean => {
  const utc = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(utc.getTime())) return false
  const [, month, day] = date.split("-") as [string, string, string]
  return utc.getUTCMonth() + 1 === Number(month) && utc.getUTCDate() === Number(day)
}

/**
 * THE ZONE OFFSET A STAMP CARRIES, read back off it — what a door hands
 * {@link canonicalDate}.
 *
 * `undefined` for a `now` with none, which is not a shape this app mints
 * (`./stamp.ts` always writes one) and is a shape a test or a caller can hold:
 * the honest answer there is that a value with a clock face and no zone cannot
 * be normalised, which is what {@link canonicalDate} does with `undefined`.
 */
export const offsetIn = (now: string): string | undefined =>
  /(Z|[+-]\d{2}:\d{2})$/.exec(now)?.[1]

/**
 * AN `int` VALUE: a digit run, and nothing else.
 *
 * No sign, no leading zeros, no separators, no unit — `193`, never `#193`,
 * `+193`, `0193`, `1_000` or `193 (merged)`. Leading zeros are out because two
 * spellings of one number are two files that mean the same thing and differ
 * byte for byte, which is the bet the whole format is arranged around; a sign
 * is out because nothing this vocabulary counts is negative, and admitting one
 * would make `-1` and `- 1` a question somebody has to answer.
 *
 * `0` IS A DIGIT RUN and is legal — it has no leading zero, it is the zero.
 */
export const isDigitRun = (value: string): boolean => /^(?:0|[1-9]\d*)$/.test(value)

/**
 * A `path` VALUE: segments separated by `/`, and no whitespace anywhere.
 *
 * THE TRADE IS NAMED RATHER THAN HIDDEN. A path with a space in it is a real
 * path, and this refuses one — because nothing structurally tells
 * `.worktrees/doc-backlinks-index (resumed)` from a directory somebody named
 * with spaces, and the whole of what this key kind is for is refusing the first.
 * A vault whose paths carry spaces declares that key `text` and keeps its
 * prose; the escape hatch is a declaration away, and it is the only rule in
 * this module a reader could be surprised by.
 *
 * Everything else a path can be is allowed: absolute or relative, `.` and `..`,
 * a dotfile, a trailing extension, a Windows drive letter. This is a SHAPE
 * rather than a resolution — `path` may point anywhere, which is what
 * distinguishes it from `doc` next door.
 */
export const isPathShaped = (value: string): boolean =>
  value !== "" && !/\s/.test(value) && !value.includes("//")

// ── what a value has to be ─────────────────────────────────────────────

/**
 * EVERYTHING A VALUE HAS TO BE CHECKED AGAINST that is not the value itself.
 *
 * One parameter rather than four, because these four are one thing — the vault
 * a value is being read in — and because both callers already hold all of them:
 * the validator builds the declarations and the `.md` set for its own rules,
 * and the planner holds the reading it is planning against.
 */
export interface Typed {
  readonly declarations: PropDeclarations
  readonly derived: Derived
  /** WHAT WORDS BEYOND THE SEVEN MEAN ANYTHING HERE — the fifth fact, and the
   *  one that is not a reading of the set at all ({@link KindVocabulary}). It
   *  travels with the other four because it is asked of the same value at the
   *  same moment, and a caller holding a reading without it would be a caller
   *  deciding for itself what a `terminal` is. */
  readonly kinds: KindVocabulary
  /** The `.md` paths a `doc` may point at — {@link ./rules.ts}'s
   *  `markdownPaths`, the same set the `doc` FIELD's rule is asked about, so a
   *  property and a field cannot disagree about what is served. */
  readonly documents: ReadonlySet<string>
}

/**
 * WHAT IS WRONG WITH THIS VALUE UNDER THIS KEY — one sentence, or `undefined`,
 * which is the answer for every undeclared key and nearly every declared one.
 *
 * THE SENTENCE IS WRITTEN ONCE AND WORN TWICE. A refused write quotes it and a
 * broken file reports it, so a person moving between a tool result and an error
 * on a page reads one wording. What each caller adds is its own frame — an
 * `OpFailure` with a `usage` tag, an `OutlineError` at a `file:line` — and
 * neither adds a word.
 *
 * IT TEACHES, in this package's own two ways: the ALLOWED VALUES are named
 * where there is a list short enough to read, and a value close enough to be a
 * typo of one of them is offered ({@link ./suggest.ts}'s budget, the same one
 * an unknown id gets). The commentary case gets a sentence of its own, because
 * it is the mistake this whole feature is aimed at and "got a date plus prose"
 * is the half a reader acts on.
 *
 * A LIST IS CHECKED MEMBER BY MEMBER. `custom` holds text or a list of it — a
 * fact can be several — so a typed key holding several is several values of
 * that type, and the first bad member is what the sentence quotes. No door
 * writes a list (`set_prop` and `add_node`'s map are text), so this arm is
 * reached by a hand-edited file alone.
 *
 * `from` is the outline the record lives in, which only `doc` reads — and what
 * it is resolved AGAINST is the key's own declared basis ({@link basedAt}): the
 * naming outline's directory by default, exactly as the `doc` FIELD is, or the
 * served root for a key whose row says `base: root`. The arithmetic itself is
 * one place either way ({@link ./documents.ts}).
 */
export const wrongValue = (
  typed: Typed,
  from: string,
  key: string,
  value: CustomValue,
): string | undefined => {
  const declared = declaredFor(typed.declarations, key)
  if (declared === undefined) return undefined
  if (typeof value !== "string") {
    for (const member of value) {
      const wrong = wrongOne(typed, declared, from, key, member)
      if (wrong !== undefined) return wrong
    }
    return undefined
  }
  return wrongOne(typed, declared, from, key, value)
}

/** One value of one declared key — {@link wrongValue} with the list arm and the
 *  lookup taken off, so the eight kinds are one switch the compiler checks. */
const wrongOne = (
  typed: Typed,
  declared: Declared,
  from: string,
  key: string,
  value: string,
): string | undefined => {
  const named = `\`${key}\``
  switch (declared.type.kind) {
    case "text":
      return undefined
    case "date":
      return canonicalDate(value, null) === value ? undefined : canonicalDate(value, "") === value
        ? `${named} is a date — write the offset too, the way a mark records ` +
          `its instant: \`2026-08-25T10:06:00-04:00\`, or a bare day ` +
          `\`2026-08-25\`. Got ${quoted(value)}.`
        : `${named} is a date — got ${quoted(value)}. Write ` +
          `\`2026-08-25T10:06:00-04:00\` or \`2026-08-25\`; the story goes in the note.`
    case "int":
      return isDigitRun(value) ? undefined : `${named} is a whole number — got ${
        quoted(value)
      }. Digits alone: no sign, no leading zeros, no separators, and nothing ` +
        `after them.`
    case "path":
      return isPathShaped(value) ? undefined : `${named} is a path — got ${
        quoted(value)
      }. A path is one run of characters with no spaces in it; the remark ` +
        `belongs in the note.`
    case "doc":
      return wrongDoc(typed, declared, from, named, value)
    case "ref":
      return wrongRef(typed, declared, named, value)
    case "node":
      return wrongNode(typed, named, value)
    case "contributed":
      return wrongContributed(typed, declared.type.word, named, value)
  }
}

/**
 * A KIND A PLUGIN TAUGHT THIS VAULT: the plugin's own question, asked of the
 * plugin's own entry.
 *
 * `undefined` FOR A WORD NOBODY IS ANSWERING FOR, and that is the whole of what
 * a disabled plugin costs a vault: the value is still a name, it is still
 * stored, and nothing here has an opinion about it. Refusing instead would make
 * a directory that serves fine under `--plugins=kolu,odu` come up broken under
 * `--plugins=odu` — a verdict on a file decided by a flag on the machine, which
 * is what {@link KindVocabulary} exists to keep from happening.
 *
 * THE ENABLED MAP AND NOT THE BUILT ONE, for the same reason from the other
 * end: a kind whose plugin is not running has no `admits` anybody is standing
 * behind. It has a `takes` — the binary knows the word — and that is exactly
 * what the DECLARATION is refused against and nothing more.
 *
 * THE SENTENCE IS THE PLUGIN'S ({@link ContributedKind.takes}), because core
 * has nothing true to say about a terminal id. What this adds is the frame the
 * other seven arms wear — the key, and the value quoted at both ends so the
 * commentary that made it wrong is visible.
 */
const wrongContributed = (
  typed: Typed,
  word: string,
  named: string,
  value: string,
): string | undefined => {
  const kind = typed.kinds.enabled.get(word)
  if (kind === undefined || kind.admits(value)) return undefined
  return `${named} is ${kind.takes} — got ${quoted(value)}.`
}

/**
 * `doc`: path-shaped first, then RESOLVED — two sentences, because "that is not
 * a path" and "no such document is served" are two different things to go and
 * do, and the second names what the path resolved to the way the `doc` field's
 * own error does.
 *
 * THE RESOLUTION IS SHARED WHOLE ({@link resolvedDoc}) and so is the corpus it
 * is asked of, which is the gate half of the pair the whole amendment is about.
 * The display runs the same expression over the same set ({@link ./meaning.ts}),
 * so a value this refuses cannot be drawn as a live door and a value this
 * accepts cannot be drawn as dead text — structurally, rather than because two
 * rules were written to match.
 */
const wrongDoc = (
  typed: Typed,
  declared: Declared,
  from: string,
  named: string,
  value: string,
): string | undefined => {
  const resolved = resolvedDoc(declared, from, value)
  if (resolved === undefined) {
    return `${named} names a document — got ${quoted(value)}, which is not a path.`
  }
  if (typed.documents.has(resolved)) return undefined
  return `${named} names a document — \`${value}\` resolves to \`${resolved}\`, ` +
    `and no such \`.md\` file is served${didYouMean(resolved, typed.documents)}`
}

/**
 * `ref`: the id of one of the parent's children.
 *
 * TWO SENTENCES, and which one is said is decided by whether the declaration
 * NAMED a place. An enum reads as a sum — "`merge` is `auto` | `human`" — and a
 * roster reads as what it is — "`agent` names a node under `agents-roster`" —
 * because those are the two things a reader is actually looking at, and a
 * single sentence covering both would be true of neither.
 *
 * A PLACE WITH NOTHING IN IT gets its own clause. A declaration whose children
 * are all gone, or a roster that was emptied, cannot be satisfied by any value
 * at all, and "is  — got x" is a sentence that teaches nothing.
 */
const wrongRef = (
  typed: Typed,
  declared: Declared,
  named: string,
  value: string,
): string | undefined => {
  const variants = variantsOf(typed.derived, declared)
  if (variants.includes(value)) return undefined
  const under = declared.type.kind === "ref" ? declared.type.under : undefined
  const said = variants.length === 0
    ? `nothing is declared under \`${under ?? declared.at}\` yet, so it has no legal value`
    : under === undefined
    ? `is ${listed(variants, " | ")}`
    : `names a node under \`${under}\` — those are ${listed(variants, ", ")}`
  // The DID-YOU-MEAN is over every variant, capped or not: the cap is about
  // what a sentence can carry, and the one id worth reading may well be the
  // hundredth. Which is the same split `./suggest.ts` already makes for an
  // unknown node id — offer the near miss, do not list the id space.
  return `${named} ${said} — got ${quoted(value)}${didYouMean(value, variants)}`
}

/**
 * HOW MANY VARIANTS A REFUSAL SPELLS OUT before it stops counting.
 *
 * An enum is two or three words and reads whole; a ROSTER is data, and a vault
 * is entitled to grow one to two hundred nodes — at which point "those are …"
 * is a paragraph with the one id worth reading somewhere in the middle of it.
 * That is the failure `@olai/ops`' `notFound` already names about node ids ("a
 * vault of a few thousand put its whole id space in one refusal"), met here by
 * the other road: the values ARE a list this module holds, so it can say the
 * first of them and then say how many more there are.
 *
 * Eight, because the enums this is really for have two to four members and the
 * cap should never fire on one — a refusal that says "and 0 more" would be a
 * cap that had started deciding things.
 */
const NAMED_AT_MOST = 8

/** The variants a refusal shows, capped — the first few and a count, never a
 *  wall. `join`ed with the separator the sentence is built around, since a sum
 *  reads as `a | b` and a roster as a list. */
const listed = (all: ReadonlyArray<string>, between: string): string =>
  all.slice(0, NAMED_AT_MOST).map((one) => `\`${one}\``).join(between) +
  (all.length > NAMED_AT_MOST ? `, and ${all.length - NAMED_AT_MOST} more` : "")

/** `node`: any node in the set, by id — and a MIRROR is not one, which is the
 *  sentence every op that names a node already says ({@link
 *  ../../ops/src/refusals.ts}'s `notANode`): a placement is a second view of
 *  something, and a property pointing at one points at a view rather than at
 *  the thing. */
const wrongNode = (
  typed: Typed,
  named: string,
  value: string,
): string | undefined => {
  const located = typed.derived.byId.get(value)
  if (located !== undefined && isRegular(located)) return undefined
  if (located !== undefined) {
    return `${named} names a node — \`${value}\` is a mirror, which is a second ` +
      `placement rather than a node of its own.`
  }
  return `${named} names a node — \`${value}\` is not one this set declares${
    didYouMeanDeclared(value, typed.derived.byId)
  }`
}

/** A value as a sentence quotes it: in double quotes, so the spaces and the
 *  commentary that made it wrong are visible at both ends. Backticks are what
 *  this package quotes a NAME with, and a value that is prose is not a name. */
const quoted = (value: string): string => `"${value}"`

// ── what a door writes ─────────────────────────────────────────────────

/**
 * THE VALUE A DOOR STORES, or the sentence it refuses with — the whole of what
 * the plan seam asks.
 *
 * NORMALISE THEN CHECK, in that order and in one function, which is what makes
 * "a door writes only what the validator accepts" structural rather than a pair
 * of rules kept in step by hand: the stored value is whatever came out of the
 * normaliser, and it went through {@link wrongValue} on its way out.
 *
 * A TYPED VALUE IS TRIMMED and a `text` one is not, which is one rule read from
 * both ends. Surrounding space in a number, an id or a path is a slip nobody
 * means; surrounding space in prose is somebody's text, and the face that edits
 * a property already says so in those words (`@olai/web`'s `props/editor.ts`:
 * "a sentence that ends in a space is still that sentence").
 *
 * `now` is the instant the write is being stamped with, and its OFFSET is the
 * only thing read out of it ({@link offsetIn}) — for the one value shape that
 * cannot be canonicalised without a clock, a datetime somebody wrote with no
 * zone on it.
 */
export const storedValue = (
  typed: Typed,
  from: string,
  key: string,
  value: string,
  now: string,
): Result.Result<string, string> => {
  const declared = declaredFor(typed.declarations, key)
  // An undeclared key and a key declared `text` are the same value verbatim,
  // and they reach that answer by two different roads: nobody typed the first,
  // and somebody DECLARED the second to be prose. Trimming either would be this
  // function editing somebody's sentence.
  if (declared === undefined || declared.type.kind === "text") return Result.succeed(value)
  // A CONTRIBUTED KIND IS TRIMMED WHETHER OR NOT ITS PLUGIN IS RUNNING, which
  // is deliberate: the DECLARATION is what says this value is a name rather
  // than prose, and that sentence is the vault's. Trimming on one `--plugins`
  // and not on another would put a flag on the machine in charge of what gets
  // written to a file.
  const stored = declared.type.kind === "date"
    ? canonicalDate(value, offsetIn(now) ?? null) ?? value.trim()
    : value.trim()
  const wrong = wrongValue(typed, from, key, stored)
  return wrong === undefined ? Result.succeed(stored) : Result.fail(wrong)
}

// ── the declarations file's own records ────────────────────────────────

/**
 * WHAT A DECLARATION GOT WRONG, and whether reaching that answer RESOLVED A
 * BARE ID.
 *
 * The pair, because only the caller that FILES the finding can spend the second
 * half and only this function knows it: the sentence a reader acts on is the
 * first arm the checks below take, and exactly one of those arms reads the set
 * (`under`, through `Grounded.resolves`). Answering with the sentence alone
 * left the caller to re-derive which arm it came from, and re-deriving it means
 * re-running the checks in the same order — a second copy of this function's
 * own precedence.
 *
 * WHY IT MATTERS AT ALL is the per-file ruling: a finding an unreadable file
 * could have INVENTED is withheld, and a withheld finding now breaks nothing,
 * so classifying the whole `bad-prop` code as guessable washed a declaration
 * that says no `type` at all out of the report the moment any file in the
 * directory failed to parse (`./errors.ts`'s `Reach`).
 */
export interface Wrong {
  /** The sentence, written to teach — what `set_prop` refuses with and what
   *  the validator's row says. */
  readonly said: string
  /** Whether reaching it resolved a bare id that may live in any file. */
  readonly across: boolean
}

/** A fault decided by the record and this format's own tables — which is every
 *  one of them but the `under` arm. */
const decided = (said: string): Wrong => ({ said, across: false })

/**
 * Does a value of this key's declared kind RESOLVE A BARE ID that may live in
 * any file? Two of the seven kinds do.
 *
 * The value-side twin of `Grounded.resolves`, and the reason it is a reading of
 * the KIND rather than of the finding: a value's fault is about the kind its key
 * declares, whatever the sentence says, so there is no arm order to re-derive
 * and the rule that files the finding can ask this directly.
 */
export const resolvesId = (
  declarations: PropDeclarations,
  key: string,
): boolean => {
  const kind = declaredFor(declarations, key)?.type.kind
  return kind === "ref" || kind === "node"
}

/**
 * WHAT IS WRONG WITH A RECORD OF `_olai/Properties.org` — the bootstrap, said
 * as a finding.
 *
 * Asked of every record in that file and of no record anywhere else, which is
 * the fence that stops the recursion: `type` is a word with a meaning HERE, and
 * an ordinary property called `type` on an ordinary node is somebody's own
 * vocabulary and none of this format's business.
 *
 * THE TOP LEVEL DECLARES AND THE CHILDREN ARE VARIANTS, so the two halves are
 * asked different questions. A root owes a key nobody else declares and a
 * `type` the table knows; a child owes only that it is not pretending to be a
 * declaration, because a `type` on a variant is a key that looks declared,
 * declares nothing, and would be read by nobody — the silent hole this rule
 * closes.
 *
 * `declared` is the keys already claimed by an EARLIER root, so the second
 * claim on a key is the one reported — the duplicate-id rule's own shape, for
 * the same reason: the first declaration is what every value of that key was
 * checked against, so it is not the mistake.
 */
export const wrongDeclaration = (
  derived: Derived,
  located: Located,
  declared: ReadonlySet<string>,
  kinds: KindVocabulary,
): Wrong | undefined => {
  // A placement declares nothing: it carries no title to name a key with and
  // no props to say a type in, which is the format's own shape rather than a
  // rule this file adds.
  if (!isRegular(located)) return undefined
  const node = located.node
  if (node.parent !== undefined) {
    const said = [...BOOTSTRAP.keys()].find((word) => customText(node, word) !== undefined)
    return said === undefined ? undefined : decided(
      `\`${said}\` declares a property key, and ` +
        `only a TOP-LEVEL node of this file declares one — what hangs under a ` +
        `declaration is its variants, named by their ids.`,
    )
  }
  const written = node.title.trim()
  if (written === "") {
    return decided("a declaration's title IS the property key, and this one has none.")
  }
  const shadow = shadowFor(written)
  if (shadow !== undefined) {
    return decided(
      `\`${written}\` is what a node's own fields already answer, so no property ` +
        `may be called that — ${shadow.door}.`,
    )
  }
  // The two bootstrap words are RESERVED, and this is where that is said. A
  // vault that declared `type` would be declaring the word a declaration says
  // its own type in — two answers about one key, in the one file where the
  // recursion is supposed to stop ({@link BOOTSTRAP}).
  if (BOOTSTRAP.has(written.toLowerCase())) {
    return decided(
      `\`${written}\` is what a declaration in this file says about ITSELF, so it ` +
        `cannot also be a key this vault declares — the built-in table is where the ` +
        `types of these two stop being read out of a file.`,
    )
  }
  // FOLDED, and asked through the same {@link keyOf} the reading uses: `merge`
  // and `Merge` are one key to `prop:` and to the fence, so declaring both is
  // declaring one key twice rather than two keys once. The sentence quotes both
  // spellings where they differ, because "already declared" about a word that
  // is not on the screen is a sentence nobody can act on.
  const key = keyOf(written)
  if (key !== undefined && declared.has(key)) {
    return decided(
      `\`${written}\` is already declared by an earlier node in this file${
        key === written ? "" : ` (as \`${key}\`, and a property key is folded for case)`
      }; a key has one type across the vault, or its meaning depends on where the ` +
        `reader is standing.`,
    )
  }
  // THE BOOTSTRAP, applied: each of the two words the table knows, checked
  // against the table rather than against a rule spelled here — and worded by
  // it too, which is what lets `under` say the one thing a generic sentence
  // would get wrong ({@link Grounded}).
  for (const [word, grounded] of BOOTSTRAP) {
    const value = customText(node, word)
    if (value === undefined) continue
    const wrong = grounded.wrong(value, derived, kinds)
    if (wrong === undefined) continue
    // THE ONE ARM THAT MAY BE A GUESS, and the word itself says which of the
    // three it is (`Grounded.resolves`): `under` reads the SET, so a file that
    // did not parse could have taken the id it names away with it; `type` and
    // `base` read this format's own tables and are true whatever is missing.
    return { said: `\`${word}\` is \`${value}\`, which ${wrong}`, across: grounded.resolves }
  }
  const said = customText(node, TYPE_KEY)
  if (said === undefined) {
    return decided(
      `\`${written}\` declares a property key but does not say its \`${TYPE_KEY}\` — write ` +
        `${BOOTSTRAP.get(TYPE_KEY)?.takes(kinds) ?? ""}.`,
    )
  }
  // The one rule about the PAIR, which no per-word table can hold: `under` says
  // where a `ref` finds its variants, and every other kind takes its values
  // from nowhere in particular.
  if (said !== "ref" && customText(node, UNDER_KEY) !== undefined) {
    return decided(
      `\`${UNDER_KEY}\` says where a \`ref\`'s variants live, and \`${written}\` is a ` +
        `\`${said}\` — which takes its values from nowhere in particular.`,
    )
  }
  // The same rule for the second word of the pair: `base` says where a PATH
  // resolves from, and the five kinds that name no path have nothing to
  // resolve. Reported rather than ignored for the reason the line above is —
  // the reading SKIPS such a declaration ({@link typeIn}), so a key that looks
  // typed and is silently untyped is exactly what this rule exists to name.
  if (said !== "doc" && said !== "path" && customText(node, BASE_KEY) !== undefined) {
    return decided(
      `\`${BASE_KEY}\` says where a \`doc\` or \`path\` value resolves from, and ` +
        `\`${written}\` is a \`${said}\` — which names no path to resolve.`,
    )
  }
  return undefined
}

// ── a declaration over values the set already holds ────────────────────

/**
 * WHAT THIS PROPERTIES ROOT WOULD DECLARE — the key and the type, or
 * `undefined` for a record {@link wrongDeclaration} would already refuse.
 *
 * Shared by the write planner so a `type` of `doc` on a new row and a
 * `set_prop` of `type` on an existing one ask the same question about the
 * values the vault already holds ({@link unfitHeld}). The reading
 * ({@link typeIn}) is the same one the validator uses, asked of the record
 * rather than of a fabricated site, so a declaration this accepts and the
 * rule reports cannot happen, and neither can the inverse.
 */
export const declaringOf = (
  derived: Derived,
  node: RegularNode,
): { readonly key: string; readonly declared: Declared } | undefined => {
  if (node.parent !== undefined) return undefined
  const key = keyOf(node.title)
  if (key === undefined) return undefined
  const type = typeIn(derived, node)
  if (type === undefined) return undefined
  return { key, declared: { type, at: node.id } }
}

/**
 * ONE EXISTING VALUE that would not fit a key, once that key is declared.
 *
 * `file`, the node's title and id, and the value as a reader was shown —
 * the three the declaration door names, and the sentence {@link wrongValue}
 * would say about the same value if `set_prop` had tried to write it.
 */
export interface UnfitHeld {
  readonly file: string
  readonly id: string
  readonly title: string
  /** The value as a reader was shown — a list joined, a string as stored. */
  readonly value: string
  /** The members the load walks. A string is one member; a list is the array,
   *  so a declaration door that excuses minted variants can ask per member
   *  rather than against the joined spelling. */
  readonly members: ReadonlyArray<string>
  readonly wrong: string
}

/**
 * EVERY VALUE THE SET ALREADY HOLDS under this key that would not fit what
 * `typed` now declares it as — the walk the declaration door asks, through
 * the same {@link wrongValue} `set_prop` and the validator already share.
 *
 * A MIRROR CARRIES NO PROPERTIES, so a placement is stepped over exactly as
 * {@link reportPropValues} steps over one. The trash is NOT skipped: a
 * trashed record is still in the set, and a declaration that ignored it
 * would take the next load into last-good over a value nobody can see from
 * the live tree. A list is one offender, shown the way the chip is seeded
 * (members joined); {@link UnfitHeld.members} keeps the array the load
 * walks, beside that display string.
 *
 * THE KEY IS FOLDED, because a record that wrote `Brainstorm` is asking
 * about the key a vault is declaring as `brainstorm` — {@link foldedKey}'s
 * own reconciliation, asked here of the map's keys rather than of a
 * title.
 *
 * THE WALK IS {@link heldCustoms}, the same one the validator's
 * property-value rule uses: a second walk that skipped a mirror, or a
 * list, or the trash, would be a declaration door that disagrees with
 * the next load.
 */
export const unfitHeld = (typed: Typed, key: string): ReadonlyArray<UnfitHeld> => {
  if (declaredFor(typed.declarations, key) === undefined) return []
  const folded = foldedKey(key)
  const found: Array<UnfitHeld> = []
  for (const { located, key: held, value } of heldCustoms(typed.derived.nodes)) {
    if (foldedKey(held) !== folded) continue
    const wrong = wrongValue(typed, located.file, key, value)
    if (wrong === undefined) continue
    const members = typeof value === "string" ? [value] : value
    found.push({
      file: located.file,
      id: located.node.id,
      title: located.node.title,
      value: members.join(", "),
      members,
      wrong,
    })
  }
  return found
}

/**
 * Every custom key a regular record holds, in the order the map holds
 * them. Mirrors are stepped over (they carry no properties); a list is
 * one value of that key.
 *
 * THE VALIDATOR AND THE DECLARATION DOOR both walk this, so a value
 * one reports and the other does not cannot happen.
 */
export function* heldCustoms(
  records: Iterable<Located>,
): Generator<{
  readonly located: LocatedRegular
  readonly key: string
  readonly value: CustomValue
}> {
  for (const located of records) {
    if (!isRegular(located)) continue
    const custom = located.node.custom
    if (custom === undefined) continue
    for (const key of customOrder(custom)) {
      const value = custom[key]
      if (value === undefined) continue
      yield { located, key, value }
    }
  }
}
