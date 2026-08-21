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
 */
type Reach = Stage | "set-across-files"

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
   *  tree; cross-file relations are mirrors and edges. */
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
   * The DIRECTORY could not be read — not a record in it. EACCES on a folder,
   * a mount that went away, a disk with no room to answer a stat.
   *
   * The one code that is not about the format at all, and it is here because
   * of where it has to arrive rather than where it comes from: a reader whose
   * outline has quietly stopped tracking the disk needs to be told, and the
   * banner over the last good snapshot is the surface that already says
   * exactly that. It used to be a log line and nothing else — the page froze
   * at the last good revision and went on looking live (`@olai/store`'s
   * `PlatformFailure`, translated by the codec's `unreadable`).
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

/** Can an unreadable file have INVENTED this error rather than merely hidden
 *  one? True for exactly the codes that resolve a bare id across files.
 *
 *  Everything else is a finding whatever the missing file held: `parent` may
 *  not cross files, so an unresolved one is refused either way (unknown if
 *  nothing declares it, foreign if the unreadable file did), and a duplicate,
 *  a cycle or a stored marker needs the very records that are missing. */
export const isGuessWhileUnreadable = (code: ErrorCode): boolean =>
  CATALOGUE[code] === "set-across-files"

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
 *  by having a related site in another file. */
export const Related = Schema.Struct({
  ...Site.fields,
  note: Schema.String,
})
export type Related = typeof Related.Type

export const OutlineError = Schema.Struct({
  ...Site.fields,
  code: ErrorCode,
  /** One sentence, written to teach: what is wrong, and what would be right. */
  message: Schema.String,
  related: Schema.optionalKey(Schema.Array(Related)),
})
export type OutlineError = typeof OutlineError.Type

/** True when the error implicates more than one file — the browser groups
 *  these on their own, because "which file is broken" has no single answer. */
export const isCrossFile = (error: OutlineError): boolean =>
  (error.related ?? []).some((related) => related.file !== error.file)

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
