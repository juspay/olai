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
 * somebody remembers (docs/brainstorming/typed-properties.md).
 *
 * ## The seven kinds, and the one that is missing
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
 * **A ref value is an ID, and display resolves it to the title** — the pin and
 * mirror rule, for the pin and mirror reason: names rename, ids don't. Variant
 * ids are chosen short at declaration time (`auto`, `human`), which is safe
 * because the duplicate-id fence makes any clash loud at add-time.
 *
 * ## Where the declarations are
 *
 * `_olai/Properties.olai`, read BY NAME like the shelf and the inbox
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
 * A declaration is itself a node carrying properties (`type`, `under`), so the
 * obvious question is what types THOSE. {@link BOOTSTRAP} does, and it is the
 * one place this stops: a built-in table, in code, checked against the records
 * of the declarations file and nowhere else. A vault cannot re-declare `type`,
 * and a `Properties.olai` that says something the table does not know is a
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
 * `duplicate_node` is the one door with no refusal of its own, and that is a
 * fact about the op rather than a hole: a copy is isomorphic to a subtree the
 * validator has already approved, so it can carry no value the set did not
 * already hold. The gate re-validates either way.
 *
 * ## What it costs
 *
 * One node's props against one small map. `ref` and `node` read indexes the
 * validator already builds (`byId`, `children`); `doc` reads the `.md` set the
 * `doc` FIELD's rule already carries. Nothing here walks the corpus, which is
 * what lets the check ride every write rather than joining the whole-set sweep.
 */

import { Result } from "effect"

import type { CustomValue } from "./custom.ts"
import { type Derived, rootsOf } from "./derive.ts"
import { resolveRelative } from "./documents.ts"
import {
  isRegular,
  type Located,
  type LocatedRegular,
  propertiesIn,
  shadowFor,
} from "./node.ts"
import { didYouMean } from "./suggest.ts"

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
  /** A number, not a string that has one in it: `pr: 193`. */
  | { readonly kind: "int" }
  /** Path-shaped, and it may point anywhere — `worktree`. */
  | { readonly kind: "path" }
  /** A path that names a document this directory SERVES — `brief`. */
  | { readonly kind: "doc" }
  /** One of a parent's children, BY ID. Absent `under` means the declaration's
   *  own children, which is what makes an enum a ref with no extra machinery. */
  | { readonly kind: "ref"; readonly under?: string }
  /** Any node in the set — `item`, `superseded-by`. */
  | { readonly kind: "node" }

/** Every kind's word, in the order this module documents them. Read by
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
] as const satisfies ReadonlyArray<PropType["kind"]>

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
  /** The id of the node in `_olai/Properties.olai` that declares this key. */
  readonly at: string
}

/** A vault's declarations, by key. Absent from this map is `text`, which is
 *  the whole of what "typing is opt-in per key" means: nobody could capture
 *  anything until the vocabulary was declared otherwise. */
export type PropDeclarations = ReadonlyMap<string, Declared>

/** A vault that declares nothing — the answer for a directory with no
 *  `Properties.olai`, and the default every reader that has none passes. One
 *  value rather than a fresh empty map per call, for `NO_PINS`' reason. */
export const NO_TYPING: PropDeclarations = new Map()

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

/** One built-in type: whether a value holds, and how a refusal names what the
 *  key takes. A pair rather than a predicate, for {@link ./errors.ts}'s reason
 *  one layer up — a rule and the sentence it says are two facts about the same
 *  thing, and one declared in one place and worded in another is a pair that
 *  drifts. */
interface Grounded {
  readonly takes: string
  readonly holds: (value: string, derived: Derived) => boolean
}

/**
 * THE ONE PLACE THE RECURSION GROUNDS — the built-in types of a declaration's
 * own two properties.
 *
 * A declaration is a node carrying properties, so the obvious question is what
 * types THOSE, and the obvious answer — declare them in the file — is the
 * regress this table cuts. It is code, it is applied to the records of
 * `_olai/Properties.olai` and to nothing else, and a vault cannot re-declare
 * either word: a property called `type` on an ordinary node is somebody's own
 * vocabulary and none of this format's business.
 *
 * `type` is a CLOSED WORD LIST ({@link PROP_KINDS}) rather than a `ref`,
 * because a ref's variants are nodes and the nodes that would hold these are
 * the very ones being declared. `under` is a NODE — any id in the set — which
 * is exactly what the field means, and is the one of the two that has to read
 * the set to answer.
 */
export const BOOTSTRAP: ReadonlyMap<string, Grounded> = new Map<string, Grounded>([
  [TYPE_KEY, {
    takes: `one of ${PROP_KINDS.map((kind) => `\`${kind}\``).join(", ")}`,
    holds: (value) => isPropKind(value),
  }],
  [UNDER_KEY, {
    takes: "the id of a node in the set — where a `ref`'s variants live",
    holds: (value, derived) => derived.byId.has(value),
  }],
])

// ── reading the declarations ───────────────────────────────────────────

/**
 * A VAULT'S DECLARATIONS, read off the set — the top level of whichever outline
 * is called `Properties.olai`, one entry per key.
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
export const declarationsOf = (derived: Derived): PropDeclarations => {
  const held = DECLARED.get(derived)
  if (held !== undefined) return held
  const read = declaringIn(derived)
  DECLARED.set(derived, read)
  return read
}

/**
 * ONE READING PER VIEW, and it is a memo rather than a cache: a `Derived` is
 * one revision of the set, so what that set declares cannot move under it.
 *
 * A `WeakMap` for `./shadow.ts`'s reason, which is the only other table in this
 * package keyed by a view: a revision nobody kept takes its entry with it, and
 * nothing above learns that anything is remembered. What it buys is that the
 * four readers of this — the validator, the narrowed validator beside it, every
 * search, and the write planner, which asks once per op of a batch — pay one
 * walk of the declarations file between them rather than one each. The walk
 * itself is small; the `propertiesIn` in front of it is `O(files)`, and that
 * one was worth not paying a hundred times for a hundred-op batch.
 */
const DECLARED = new WeakMap<Derived, PropDeclarations>()

/** The walk itself — {@link declarationsOf} with the memo taken off. */
const declaringIn = (derived: Derived): PropDeclarations => {
  const file = propertiesIn([...derived.byFile.keys()])
  if (file === undefined) return NO_TYPING
  const declarations = new Map<string, Declared>()
  for (const located of rootsOf(derived, file)) {
    const key = located.node.title.trim()
    if (key === "" || shadowFor(key) !== undefined || BOOTSTRAP.has(key)) continue
    if (declarations.has(key)) continue
    const type = typeIn(derived, located)
    if (type === undefined) continue
    declarations.set(key, { type, at: located.node.id })
  }
  return declarations
}

/**
 * What one declaration node SAYS, or `undefined` for one that says nothing this
 * module can read.
 *
 * Shared by the reading above and the rule that reports a declaration
 * ({@link wrongDeclaration}) so the two cannot disagree about which records are
 * declarations — a key the reading skipped and the rule accepted would be a key
 * that is silently untyped and reported clean.
 */
const typeIn = (derived: Derived, located: LocatedRegular): PropType | undefined => {
  const said = customText(located, TYPE_KEY)
  const under = customText(located, UNDER_KEY)
  if (said === undefined || !isPropKind(said)) return undefined
  if (said !== "ref") return under === undefined ? { kind: said } : undefined
  if (under === undefined) return { kind: "ref" }
  return derived.byId.has(under) ? { kind: "ref", under } : undefined
}

/** One of the declaration node's own two properties, as text — `undefined` for
 *  a key it does not carry AND for one holding a list, which is a shape neither
 *  of them has an answer for. */
const customText = (located: LocatedRegular, key: string): string | undefined => {
  const held = located.node.custom?.[key]
  return typeof held === "string" && held !== "" ? held : undefined
}

/** Is this word one of the seven? A type guard, so the branch above is one the
 *  compiler checks rather than a cast. */
const isPropKind = (word: string): word is PropType["kind"] =>
  (PROP_KINDS as ReadonlyArray<string>).includes(word)

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
  return `${date}T${pad(hour)}:${minute}:${second ?? "00"}${said}`
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
 * `from` is the outline the record lives in, which only `doc` reads: a relative
 * path is resolved against the naming outline's own directory, exactly as the
 * `doc` FIELD is ({@link ./documents.ts}, the one place that arithmetic lives).
 */
export const wrongValue = (
  typed: Typed,
  from: string,
  key: string,
  value: CustomValue,
): string | undefined => {
  const declared = typed.declarations.get(key)
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
 *  lookup taken off, so the seven kinds are one switch the compiler checks. */
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
      return wrongDoc(typed, from, named, value)
    case "ref":
      return wrongRef(typed, declared, named, value)
    case "node":
      return wrongNode(typed, named, value)
  }
}

/** `doc`: path-shaped first, then RESOLVED — two sentences, because "that is
 *  not a path" and "no such document is served" are two different things to go
 *  and do, and the second names what the path resolved to the way the `doc`
 *  field's own error does. */
const wrongDoc = (
  typed: Typed,
  from: string,
  named: string,
  value: string,
): string | undefined => {
  if (!isPathShaped(value)) {
    return `${named} names a document — got ${quoted(value)}, which is not a path.`
  }
  const resolved = resolveRelative(from, value)
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
    ? `is ${variants.map((one) => `\`${one}\``).join(" | ")}`
    : `names a node under \`${under}\` — those are ${
      variants.map((one) => `\`${one}\``).join(", ")
    }`
  return `${named} ${said} — got ${quoted(value)}${didYouMean(value, variants)}`
}

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
    didYouMean(value, typed.derived.byId.keys())
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
  const declared = typed.declarations.get(key)
  // An undeclared key and a key declared `text` are the same value verbatim,
  // and they reach that answer by two different roads: nobody typed the first,
  // and somebody DECLARED the second to be prose. Trimming either would be this
  // function editing somebody's sentence.
  if (declared === undefined || declared.type.kind === "text") return Result.succeed(value)
  const stored = declared.type.kind === "date"
    ? canonicalDate(value, offsetIn(now) ?? null) ?? value.trim()
    : value.trim()
  const wrong = wrongValue(typed, from, key, stored)
  return wrong === undefined ? Result.succeed(stored) : Result.fail(wrong)
}

// ── the declarations file's own records ────────────────────────────────

/**
 * WHAT IS WRONG WITH A RECORD OF `_olai/Properties.olai` — the bootstrap, said
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
): string | undefined => {
  // A placement declares nothing: it carries no title to name a key with and
  // no props to say a type in, which is the format's own shape rather than a
  // rule this file adds.
  if (!isRegular(located)) return undefined
  const node = located.node
  if (node.parent !== undefined) {
    const said = [...BOOTSTRAP.keys()].find((word) => customText(located, word) !== undefined)
    return said === undefined ? undefined : `\`${said}\` declares a property key, and ` +
      `only a TOP-LEVEL node of this file declares one — what hangs under a ` +
      `declaration is its variants, named by their ids.`
  }
  const key = node.title.trim()
  if (key === "") {
    return "a declaration's title IS the property key, and this one has none."
  }
  const shadow = shadowFor(key)
  if (shadow !== undefined) {
    return `\`${key}\` is what a node's own fields already answer, so no property ` +
      `may be called that — ${shadow.door}.`
  }
  // The two bootstrap words are RESERVED, and this is where that is said. A
  // vault that declared `type` would be declaring the word a declaration says
  // its own type in — two answers about one key, in the one file where the
  // recursion is supposed to stop ({@link BOOTSTRAP}).
  if (BOOTSTRAP.has(key)) {
    return `\`${key}\` is what a declaration in this file says about ITSELF, so it ` +
      `cannot also be a key this vault declares — the built-in table is where the ` +
      `types of these two stop being read out of a file.`
  }
  if (declared.has(key)) {
    return `\`${key}\` is already declared by an earlier node in this file; a key has ` +
      `one type across the vault, or its meaning depends on where the reader is ` +
      `standing.`
  }
  // THE BOOTSTRAP, applied: each of the two words the table knows, checked
  // against the table rather than against a rule spelled here.
  for (const [word, grounded] of BOOTSTRAP) {
    const value = customText(located, word)
    if (value === undefined || grounded.holds(value, derived)) continue
    return `\`${word}\` is \`${value}\`, which is not ${grounded.takes}${
      word === TYPE_KEY ? didYouMean(value, PROP_KINDS) : didYouMean(value, derived.byId.keys())
    }`
  }
  const said = customText(located, TYPE_KEY)
  if (said === undefined) {
    return `\`${key}\` declares a property key but does not say its \`${TYPE_KEY}\` — ` +
      `${BOOTSTRAP.get(TYPE_KEY)?.takes ?? ""}.`
  }
  // The one rule about the PAIR, which no per-word table can hold: `under` says
  // where a `ref` finds its variants, and every other kind takes its values
  // from nowhere in particular.
  if (said !== "ref" && customText(located, UNDER_KEY) !== undefined) {
    return `\`${UNDER_KEY}\` says where a \`ref\`'s variants live, and \`${key}\` is a ` +
      `\`${said}\` — which takes its values from nowhere in particular.`
  }
  return undefined
}
