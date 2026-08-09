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
 */

import { Order, Schema } from "effect"

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
  /** `done` and `doing` are both set; at most one may be. */
  "done-and-doing": "line",
  /** `done`, `doing` or `date` is not a valid ISO date or datetime. */
  "bad-date": "line",

  // ── the whole set ───────────────────────────────────────────────────
  /** Two records claim the same `id`. */
  "duplicate-id": "set",
  /** `parent` names an id no record in the set declares. */
  "unknown-parent": "set",
  /** `parent` resolves, but in another file. Every `.jsonl` is an independent
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
  /** A node with children stores `done` or `doing`. A parent's status is
   *  computed from its children and is never stored. */
  "stored-derived-state": "set",
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

/** A place in the loaded set. `file` is relative to the served directory, so
 *  it reads the same in the browser, in a test assertion and in a report from
 *  another machine. `line` is 1-based — one node per line, so the line is the
 *  whole story. */
export const Site = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
})
export type Site = typeof Site.Type

/** A second place the error is about, with a word on why it is implicated:
 *  the other record that claimed the id, the rest of the cycle, the child that
 *  is not done. This is the "structured detail, not prose" rule — the error
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

/** Stable presentation order: by file, then by line, then by code.
 *
 *  Code point order, not `localeCompare` — a locale-sensitive sort would make
 *  "two loads of the same broken set produce the same list" false across two
 *  machines, which is the whole point of ordering it at all. */
export const compareErrors: Order.Order<OutlineError> = Order.Struct({
  file: Order.String,
  line: Order.Number,
  code: Order.String,
})
