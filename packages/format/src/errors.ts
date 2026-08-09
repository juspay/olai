/**
 * What a broken outline says.
 *
 * Errors are the product (docs/format.md): every one names `file:line` of the
 * record that caused it, and carries structured detail rather than prose that
 * a UI would have to parse back. The whole set travels the wire to the browser
 * error view, so these are Effect Schema values, not thrown exceptions.
 *
 * The five *kinds* the format spec names (`usage`, `validation`, `not-found`,
 * `derived`, `busy`) are NOT stored on the error — they are derived from the
 * code by {@link kindOf}. Storing a field that is a pure function of another
 * field is exactly the stored-derived-state this format refuses in its data;
 * refusing it in its errors too costs one function and removes a way for the
 * two to disagree.
 */

import { Schema } from "effect"

/** Every way a loaded set can be wrong. Closed on purpose: the browser's error
 *  view switches on it, and a new member should be a type error there rather
 *  than a string that renders as itself. */
export const ErrorCode = Schema.Literals([
  // ── per line, before the set is known (the codec's decode phase) ─────
  /** The line is not valid JSON. */
  "not-json",
  /** The line parsed, but not into a JSON object. */
  "not-an-object",
  /** The object is not a well-formed record: a field has the wrong type, an
   *  unknown field is present, a required field is missing, or a mirror record
   *  carries a field mirrors may not have. */
  "bad-record",

  // ── across the whole set (the codec's validate phase) ────────────────
  /** `id` is not a slug: `[A-Za-z0-9_-]+`. */
  "bad-id",
  /** Two records claim the same `id`. */
  "duplicate-id",
  /** `parent` names an id no record in the set declares. */
  "unknown-parent",
  /** `parent` resolves, but in another file. Every `.jsonl` is an independent
   *  tree; cross-file relations are mirrors and edges. */
  "foreign-parent",
  /** `parent` resolves to a mirror record. A mirror is a placement, not a
   *  container — children hang off the target. */
  "parent-not-a-node",
  /** `parent` pointers close a loop. */
  "parent-cycle",
  /** A `mirror`, `after`, `blocks` or `see` target names an unknown id. */
  "unknown-target",
  /** `after` (with `blocks` normalized into it) closes a loop. */
  "after-cycle",
  /** A mirror is placed inside the subtree it shows, so expanding it never
   *  terminates. */
  "mirror-cycle",
  /** `done`, `doing` or `date` is not a valid ISO date or datetime. */
  "bad-date",
  /** `done` and `doing` are both set; at most one may be. */
  "done-and-doing",
  /** `doc` does not name an `.md` file under the served directory. */
  "missing-doc",
  /** A node with children stores `done` or `doing`. A parent's status is
   *  computed from its children and is never stored. */
  "stored-derived-state",
])
export type ErrorCode = typeof ErrorCode.Type

/** The error taxonomy the format spec fixes, surfaced later as MCP tool errors
 *  and HTTP codes. Loading only ever produces two of the five: `derived` for
 *  the one rule that refuses computed state, `validation` for everything else.
 *  The other three (`usage`, `not-found`, `busy`) belong to operations, which
 *  arrive with the ops layer. */
export type ErrorKind = "usage" | "validation" | "not-found" | "derived" | "busy"

export const kindOf = (code: ErrorCode): ErrorKind =>
  code === "stored-derived-state" ? "derived" : "validation"

/** Which half of the codec rejected it: `line` for the rules one record
 *  answers alone, `set` for the rules that need to know what else exists.
 *
 *  The distinction is load-bearing rather than cosmetic. A file is decoded
 *  whole or not at all, and the set-wide rules do not run until every file
 *  parses — "`kitchen` is not a known id" is a guess when the line declaring
 *  `kitchen` is the one that failed to parse. So a report containing any
 *  `line` error is a report that has not asked the `set` questions yet, and a
 *  reader deserves to be told that rather than to infer it. */
export const stageOf = (code: ErrorCode): "line" | "set" =>
  LINE_STAGE.has(code) ? "line" : "set"

const LINE_STAGE: ReadonlySet<ErrorCode> = new Set([
  "not-json",
  "not-an-object",
  "bad-record",
  "bad-id",
  "done-and-doing",
  "bad-date",
])

/** A place in the loaded set. `file` is relative to the served directory, so
 *  it reads the same in the browser, in a test assertion and in a stack of
 *  errors from two machines. `line` is 1-based — one node per line, so the
 *  line is the whole story. */
export const Site = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
})
export type Site = typeof Site.Type

/** A second place the error is about, with a word on why it is implicated:
 *  the other record that claimed the id, the rest of the cycle, the child that
 *  is not done. This is the "structured detail, not prose" rule — the error
 *  view renders these as links, and a cross-file error is recognised by having
 *  a related site in another file. */
export const Related = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
  note: Schema.String,
})
export type Related = typeof Related.Type

export const OutlineError = Schema.Struct({
  code: ErrorCode,
  file: Schema.String,
  line: Schema.Int,
  /** One sentence, written to teach: what is wrong, and what would be right. */
  message: Schema.String,
  related: Schema.optionalKey(Schema.Array(Related)),
})
export type OutlineError = typeof OutlineError.Type

/** True when the error implicates more than one file — the browser groups
 *  these on their own, because "which file is broken" has no single answer. */
export const isCrossFile = (error: OutlineError): boolean =>
  (error.related ?? []).some((related) => related.file !== error.file)

/** Stable presentation order: by file, then by line, then by code. Two loads
 *  of the same broken set produce the same list, so a test can assert on the
 *  first error and a human can diff two error views. */
export const compareErrors = (a: OutlineError, b: OutlineError): number =>
  a.file === b.file
    ? a.line === b.line
      ? a.code.localeCompare(b.code)
      : a.line - b.line
    : a.file.localeCompare(b.file)

/** The load failed. Carries every error the set produced, not the first —
 *  fixing outlines one error per run is the workflow this format exists to
 *  avoid. */
export class OutlineInvalid extends Schema.TaggedError<OutlineInvalid>()(
  "OutlineInvalid",
  { errors: Schema.Array(OutlineError) },
) {
  override get message(): string {
    const [first] = this.errors
    return first === undefined
      ? "the outline set is invalid"
      : `${this.errors.length} error(s), first at ${first.file}:${first.line}: ${first.message}`
  }
}
