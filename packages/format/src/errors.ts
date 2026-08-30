/**
 * What a broken outline says.
 *
 * Errors are the product (docs/format.md): every one names `file:line` of the
 * record that caused it, and carries structured detail rather than prose a UI
 * would have to parse back. The whole set travels the wire to the browser's
 * error view, so these are Effect Schema values, not thrown exceptions.
 *
 * The catalogue below is ONE table. The closed code set, the prose that says
 * what each code means, and the phase that catches it are three facts about
 * the same thing, and a code declared in one place and classified in another
 * is a pair that can — and did — drift apart.
 *
 * The `file:line` half of that promise is BORROWED, not declared: `./node.ts`'s
 * {@link Site}, the same value a record in the set, a read's answer and a
 * mirror's location each carry. An error is one thing that is AT a place, and
 * this module used to be where the place itself was written down — which made
 * the other three carriers three more spellings of it. Same borrowing
 * `./reading.ts` does from here for a record's mark fields: the shape travels,
 * so it is declared once at its source.
 */

import { Order, Schema } from "effect"

import { Site } from "./node.ts"
import { byPath } from "./paths.ts"

/**
 * Which half of the codec rejects it.
 *
 * `line` is the rules one record answers alone; `set` is the rules that need
 * to know what else exists. The distinction is load-bearing rather than
 * cosmetic: a file is decoded whole or not at all, so a `line` error means the
 * set is missing that file's nodes while the `set` rules run over what is left.
 * Most of them are unaffected by the gap and report as usual; the ones a
 * missing file could have INVENTED are withheld instead ({@link Reach} below),
 * because "`kitchen` is not a known id" is a guess when the line declaring
 * `kitchen` is the one that failed to parse. So a report carrying any `line`
 * error is a report with a question still open, and the error view says so
 * rather than letting a reader infer it.
 */
export type Stage = "line" | "set"

/**
 * How a rule REACHES a code — the catalogue's value, and one value more than
 * {@link Stage} has members.
 *
 * `set-across-files` is a `set` rule that resolves a bare id which may live in
 * any file of the served directory. It is called out because a file that did
 * not parse takes its ids with it, so exactly these codes can be INVENTED by
 * an unreadable file rather than merely hidden by one — and inventing one is
 * the guess the staging rule above exists to forbid ({@link ./validate.ts}
 * withholds them). Recording it here rather than in the validator is the same
 * argument this file's header makes: a code declared in one place and
 * classified in another is a pair that can drift, and a new code must answer
 * the question rather than default to the wrong answer.
 *
 * `set-per-finding` is the third value and the newest: a code whose INSTANCES
 * differ. `bad-prop` is one finding read from two ends of one arrangement, and
 * only two of the seven kinds it judges resolve a bare id (`ref` and `node`,
 * and a declaration's own `under`); an `int` holding prose is decided by the
 * record and the declarations file and nothing else. The code carried
 * `set-across-files` for all of them, and the catalogue said the width cost
 * nothing "because a withheld finding still refuses the set". THAT INVARIANT IS
 * GONE (the per-file ruling, 2026-08-29): a withheld finding now breaks nothing
 * at all, so the width stopped being generous and started being a hole — one
 * file failing to parse anywhere in the directory washed out every `bad-prop`
 * in it, and a file carrying a value the format had just refused was published
 * live and writable. So the code says "ask the finding", and the finding
 * answers ({@link OutlineError.across}, set by the rule that made it).
 */
type Reach = Stage | "set-across-files" | "set-per-finding"

/** Every way a loaded set can be wrong. Closed on purpose: the browser's error
 *  view switches on it, and a new member should be a type error there rather
 *  than a string that renders as itself. */
const CATALOGUE = {
  // ── one line, on its own ────────────────────────────────────────────
  /** The line is not valid JSON. */
  "not-json": "line",
  /** The line parsed, but not into a JSON object. */
  "not-an-object": "line",
  /** The object is not a well-formed record: a field has the wrong type, an
   *  unknown field is present, or a required one is missing. */
  "bad-record": "line",
  /** `id` is not a slug: `[A-Za-z0-9_-]+`. */
  "bad-id": "line",
  /** Two of `done`, `doing` and `todo` are set; at most one may be. */
  "several-marks": "line",
  /** A mark or `date` is not a valid ISO date or datetime. */
  "bad-date": "line",
  /**
   * The `repeat` field is wrong, in one of the two ways one line can be: the
   * text is not a rule this format's small grammar spells (./repeat.ts), or
   * there is no `date` beside it to repeat FROM.
   *
   * ONE code for the two, the way `bad-date` is one code for five fields: they
   * are the same finding — this line's `repeat` says nothing anyone can act on
   * — and the message is where the difference is said. Both are answerable
   * from the single line, which is what puts it in this half of the catalogue.
   */
  "bad-repeat": "line",

  // ── the whole set ───────────────────────────────────────────────────
  /** Two records claim the same `id`. */
  "duplicate-id": "set",
  /** `parent` names an id no record in the set declares. */
  "unknown-parent": "set",
  /** `parent` resolves, but in another file. Every `.olai` is an independent
   *  tree; cross-file relations are mirrors and edges.
   *
   *  It names the parent's site as a POINTER and not as a second fault
   *  ({@link Related}'s `broken`): the file that declares the parent did
   *  nothing but be pointed at, and the edit that fixes this is in the file
   *  holding the `parent`. Said on the SITE the rule emits rather than as a
   *  row of this table — see {@link Related}. */
  "foreign-parent": "set",
  /** `parent` resolves to a mirror record. A mirror is a placement, not a
   *  container — children hang off the target. */
  "parent-not-a-node": "set",
  /** `parent` pointers close a loop. */
  "parent-cycle": "set",
  /** A `mirror`, `after`, `blocks` or `see` target names an unknown id. The
   *  one code an unreadable file can invent: those fields name a bare id and
   *  the id may live in any file, so "no node declares it" is not knowable
   *  while some file has not parsed. */
  "unknown-target": "set-across-files",
  /** `after` (with `blocks` normalised into it) closes a loop. */
  "after-cycle": "set",
  /** A mirror is placed inside the subtree it shows, so expanding it never
   *  terminates. */
  "mirror-cycle": "set",
  /** `doc` does not name an `.md` file under the served directory. */
  "missing-doc": "set",
  /**
   * A PROPERTY does not fit what its key declares — or a declaration in
   * `_olai/Properties.olai` does not say a type this format knows
   * ({@link ./typing.ts}).
   *
   * ONE code for the two, the way `bad-repeat` is one for the rule and the
   * date it repeats from: they are the same finding read from the two ends of
   * one arrangement — this file says what `merge` may hold, and this record
   * holds something else — and a reader who has to fix one is standing in
   * front of the other. The message is where the difference is said.
   *
   * `set-across-files`, because two of the seven kinds resolve a BARE ID that
   * may live in any file (`ref` and `node`, and a declaration's own `under`),
   * so an unreadable file can INVENT "no node declares it" rather than merely
   * hide it — which is the guess the staging rule forbids. The other five are
   * decided by the record and the declarations file and cannot be invented by
   * anything.
   *
   * `set-per-finding`, because those two facts are about different INSTANCES
   * of one code and the difference is now load-bearing: a withheld finding
   * breaks nothing since the per-file ruling, so classifying all seven kinds as
   * guessable washed a real fault — an `int` holding prose — out of the report
   * the moment any file in the directory failed to parse, and published the
   * file carrying it. The rule that makes the finding knows which kind it
   * judged and says so ({@link OutlineError.across}).
   */
  "bad-prop": "set-per-finding",
  /**
   * The DIRECTORY could not be read — not a record in it. EACCES on a folder,
   * a mount that went away, a disk with no room to answer a stat.
   *
   * The one code that is not about the format at all, and it is here because
   * of where it has to arrive rather than where it comes from: a reader whose
   * outline has quietly stopped tracking the disk needs to be told. It used to
   * be a log line and nothing else — the page froze at the last good revision
   * and went on looking live (`@olai/store`'s `PlatformFailure`, translated by
   * the codec's `unreadable`).
   *
   * WHICH SURFACE SAYS IT is a narrower answer than it was. The banner over a
   * still-live tree used to be drawn for any finding at all, so this one landed
   * where every other one did; since the per-file ruling that banner is a
   * signpost naming BROKEN FILES over pages that are live, and this code is the
   * only thing left that means "what is on screen is from before". They are two
   * sentences on one surface now, and the second is the one drawn here
   * (`@olai/web`'s `errors/banner.ts`, whose `Trouble` tells them apart).
   *
   * `set`, because it is a fact about the whole load and not about one line.
   * The site names the path that could not be read, with a `line` of 0 — there
   * is no record to point at, and a made-up 1 would point at somebody's first
   * node.
   */
  "unreadable-directory": "set",
  /**
   * One FILE could not be read — EACCES, not the directory. `line`, because
   * it is a hole the rest of the set renders around, the way a file whose
   * lines would not parse is: the sidebar still lists it, its own page says
   * so, and nobody else's page moves. The site is the path with a `line` of
   * 0 — there is no record to point at.
   */
  "unreadable-file": "line",
} as const satisfies Record<string, Reach>

export type ErrorCode = keyof typeof CATALOGUE
export const ErrorCode = Schema.Literals(
  Object.keys(CATALOGUE) as Array<ErrorCode>,
)

export const stageOf = (code: ErrorCode): Stage => CATALOGUE[code] === "line" ? "line" : "set"

/**
 * Can an unreadable file have INVENTED this finding rather than merely hidden
 * one? True for the codes that always resolve a bare id across files, and for
 * the instances of a `set-per-finding` code that did.
 *
 * Everything else is a finding whatever the missing file held: `parent` may not
 * cross files, so an unresolved one is a finding either way (unknown if nothing
 * declares it, foreign if the unreadable file did), and a duplicate, a cycle or
 * a stored marker needs the very records that are missing.
 *
 * ASKED OF THE FINDING and not of the code, since the per-file ruling made the
 * answer load-bearing rather than merely tidy: a withheld finding used to be
 * withheld from the REPORT and counted all the same, so a code classified more
 * widely than its instances needed cost nothing. It now breaks nothing at all,
 * so the width is a hole — see {@link Reach}. An instance of a per-finding code
 * that does not say `across` is NOT a guess, which is the safe direction: a
 * rule that forgets to mark one reports a finding rather than washing one out.
 */
export const isGuessWhileUnreadable = (
  error: Pick<OutlineError, "code" | "across">,
): boolean =>
  CATALOGUE[error.code] === "set-across-files" ||
  (CATALOGUE[error.code] === "set-per-finding" && error.across === true)

/** The stage a whole REPORT has reached: `line` while anything in it is a
 *  line-stage error, because a file that did not parse takes its ids with it
 *  and the cross-file questions about them cannot be asked yet
 *  ({@link ./validate.ts} withholds those findings rather than guessing).
 *  The rule belongs here rather than in whichever view happens to say so — the
 *  same report is a page today and agent tool output when the ops layer lands. */
export const reportStage = (
  errors: ReadonlyArray<{ readonly code: ErrorCode }>,
): Stage => errors.some((error) => stageOf(error.code) === "line") ? "line" : "set"

/** A second place the error is about, with a word on why it is implicated:
 *  the other record that claimed the id, the rest of the cycle, the file the
 *  parent lives in. This is the "structured detail, not prose" rule — the error
 *  view renders these as their own rows, and a cross-file error is recognised
 *  by having a related site in another file.
 *
 *  `broken` is the one field of the two-plane ruling that is not one of the
 *  three axis birds: ABOUT is {@link implicatedBy} and it reaches every site
 *  unfiltered; FILED-ON is the broken set's own axis, and a related site
 *  marked `false` is named but NOT one of the ship's broken — the judgement's
 *  ground (`bad-prop`'s declaration is the shape: the judge is named so the
 *  fixer knows who said no, but a judge's own page stays lit and its own
 *  writes stay admitted). Omitting is broken: every site the error names
 *  darkens until the finding does.
 *
 *  THE SECOND KIND OF NAMED-NOT-BLAMED SITE is a POINTER, and
 *  `foreign-parent`'s is the one there is: the file the parent lives in did
 *  nothing but be pointed at. It rides this field rather than a per-CODE row
 *  of the catalogue above, and the argument is that the two kinds of related
 *  site are not two kinds of CODE. A `duplicate-id` and a cycle name sites
 *  that share the fault; a `bad-prop` names its judge; a `foreign-parent`
 *  names what it reached at — and a code that one day names both a fault and
 *  a ground has one row on a per-code table and two sites here. The rule that
 *  MAKES the finding is the only thing that knows which it just named, and it
 *  is where {@link OutlineError.across} already says the other per-instance
 *  fact for the same reason. A per-code table would be a second axis over the
 *  same rows, and the rows are what every reader draws.
 *
 *  ABSENT IS BROKEN, and that is the safe direction here for the opposite
 *  reason `across` is: a site wrongly darkened is a page a reader can still
 *  read and a write they can still make elsewhere, while a site wrongly LIT
 *  is a page drawn out of records the validator has just refused — a
 *  duplicate id's other claim, drawn as though `byId`'s coin toss were an
 *  answer. So a rule that forgets to say `false` over-darkens, and a rule
 *  that would have to say `true` never has to remember.
 */
export const Related = Schema.Struct({
  ...Site.fields,
  note: Schema.String,
  broken: Schema.optionalKey(Schema.Boolean),
})
export type Related = typeof Related.Type

export const OutlineError = Schema.Struct({
  ...Site.fields,
  code: ErrorCode,
  /** One sentence, written to teach: what is wrong, and what would be right. */
  message: Schema.String,
  related: Schema.optionalKey(Schema.Array(Related)),
  /**
   * DID THIS FINDING RESOLVE A BARE ID to reach its conclusion — so an
   * unreadable file could have invented it?
   *
   * Only on the codes whose reach is `set-per-finding` ({@link Reach}), where
   * the answer is the instance's rather than the code's: `bad-prop` judges
   * seven kinds and two of them resolve an id that may live in any file. The
   * rule that makes the finding knows which kind it judged, so it says so here
   * rather than leaving a reader of the code to assume the widest case.
   *
   * ABSENT MEANS NO, which is the safe direction: a rule that forgets to mark
   * one reports a real finding where it might have withheld a guess, and the
   * opposite mistake publishes a file carrying a value the format refused.
   */
  across: Schema.optionalKey(Schema.Boolean),
})
export type OutlineError = typeof OutlineError.Type

/**
 * ONE FILE'S ERRORS — everything the validator found that this file is the
 * thing to edit for.
 *
 * It is declared beside {@link OutlineError} rather than beside the set that
 * carries it because it is a fact about ERRORS and not about a directory. The
 * same shape is four things: the set's `broken` entry ({@link ./set.ts}), the
 * per-file `broken` on the wire (`@olai/surface`), the bounded face a banner
 * counts off ({@link ./verdict.ts}'s `summaryOf`), and the rows a broken file's
 * own page draws. It used to live in `./set.ts`, which left the one module that
 * decides WHICH files a finding breaks ({@link ./verdict.ts}'s `blamed`) unable
 * to name what it produces without importing the set it is upstream of.
 */
export const BrokenFile = Schema.Struct({
  file: Schema.String,
  errors: Schema.Array(OutlineError),
})
export type BrokenFile = typeof BrokenFile.Type

/**
 * The files this error IMPLICATES: where it was found, and every place it names
 * as related, deduped and in that order.
 *
 * The finding-sized half of the axis {@link Reach} names one level up. `Reach`
 * says which CODES can reach across files at all, because the staging rule has
 * to know that before any of them runs; this says which files THIS finding
 * turned out to be about, which is what a reader — and a write gate — needs
 * afterwards ({@link ./verdict.ts} asks it of a whole verdict).
 *
 * It is here rather than there because it is a fact about ONE error, which is
 * this module's subject, and because {@link blamedOn} is the other plane of the
 * same question: which files the finding is ABOUT is not which files it BREAKS.
 */
export const implicatedBy = (error: OutlineError): ReadonlyArray<string> =>
  filesOf(error, () => true)

/**
 * The files this error BREAKS: where it was found, and every related site that
 * did not say otherwise, deduped and in that order.
 *
 * THE OTHER PLANE, and the whole of the difference from {@link implicatedBy} is
 * `Related.broken`. A site a finding NAMES without blaming is either the ground
 * it was judged on (`bad-prop`'s declaration) or the thing it reached at
 * (`foreign-parent`'s parent): named so a reader can see it, and left lit and
 * writable because it is nobody's fault. Every other named site shares the
 * fault and breaks — a duplicate's other claim, a cycle's steps.
 *
 * ONE READING OF THAT FIELD, which is why this exists rather than the `.some`
 * it replaces. It had three spellings — the loader's filing
 * ({@link ./verdict.ts}'s `blamed`), the error view's grouping
 * ({@link isCrossFile} below) and the sentence in `Related`'s own doc — and two
 * codes ride the field now, so a fourth reader would be the one that finally
 * disagreed about whether a `foreign-parent` darkens the parent's page.
 */
export const blamedOn = (error: OutlineError): ReadonlyArray<string> =>
  filesOf(error, (related) => related.broken !== false)

/** Both planes, over one walk: the error's own site always, and the related
 *  sites this plane keeps. Deduped by file, in the order the finding names
 *  them — `.includes` over a handful rather than a `Set` per error, which is
 *  the trade every reader of a finding's sites makes. */
const filesOf = (
  error: OutlineError,
  keeps: (related: Related) => boolean,
): ReadonlyArray<string> => {
  const files = [error.file]
  for (const related of error.related ?? []) {
    if (keeps(related) && !files.includes(related.file)) files.push(related.file)
  }
  return files
}

/** True when the error BREAKS more than one file — the browser groups those
 *  on their own, because "which file is broken" has no single answer.
 *
 *  BREAKS, not IMPLICATES, which is {@link blamedOn}'s whole subject: the
 *  about-axis reaches two files for every `bad-prop` and every
 *  `foreign-parent`, and neither of them has two files to fix. So this is
 *  that plane counted, rather than a second reading of `Related.broken` free
 *  to drift from the one the loader files by. */
export const isCrossFile = (error: OutlineError): boolean => blamedOn(error).length > 1

/** A `line` of 0 means there is no record to point at — the site is the path
 *  itself. Two codes have that (`unreadable-directory`, about a DIRECTORY,
 *  and `unreadable-file`, about one FILE that will not open), and the rule
 *  lives here rather than in whichever renderer noticed first, which is the
 *  same argument {@link errorLine} makes: the browser's rows and an agent's
 *  one-liner must not disagree about whether `plan.olai:0` is a line number
 *  somebody could go and look for.
 *
 *  Asked of a {@link Site} rather than of an error: the `line` it reads is the
 *  PLACE's field, and an error is only where the question happens to come up.
 *  It was `Pick<OutlineError, "line">`, which said the field was the error's. */
export const hasLine = (site: Pick<Site, "line">): boolean => site.line > 0

/** One error as one line of plain text.
 *
 *  "Every validation error names `file:line`" is a statement about the format,
 *  so the one-line rendering of that is too — otherwise every consumer without
 *  a DOM to draw rows in (a tool result, a log line, a refusal an agent reads)
 *  invents the same spelling, and they drift. The browser has its own, richer
 *  answer; this is for everything that has to fit on a line. */
export const errorLine = (error: OutlineError): string =>
  `${error.file}${hasLine(error) ? `:${error.line}` : ""} ${error.message}`

/** A path of ids as a message names it — `` `a` → `b` → `a` `` — and a LOOP is
 *  the same thing whose ends are the same id, which is what makes `` `a` → `a` ``
 *  the honest rendering of an edge onto itself.
 *
 *  Here for the reason {@link errorLine} is: the validator names a cycle it
 *  found on load, and the ops layer names the one a write is about to close,
 *  before it happens. One sentence about the same shape, and two spellings of
 *  the arrow would be two — read by a person moving between a refusal in a tool
 *  result and an error on a page. */
export const chainOf = (path: ReadonlyArray<string>): string =>
  path.map((id) => `\`${id}\``).join(" → ")

/** Stable presentation order: by file, then by line, then by code.
 *
 *  Code point order, not `localeCompare` — a locale-sensitive sort would make
 *  "two loads of the same broken set produce the same list" false across two
 *  machines, which is the whole point of ordering it at all. BY FILE is the
 *  set's own path order ({@link ./paths.ts}), so a report reads down the
 *  directory the way the sidebar beside it does; it is a comparator rather than
 *  `Order.String` for that one pair of paths they differ on. */
export const compareErrors: Order.Order<OutlineError> = Order.Struct({
  file: byPath,
  line: Order.Number,
  code: Order.String,
})
