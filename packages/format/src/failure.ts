/**
 * What a WRITE says when it says no.
 *
 * {@link ./errors.ts} is what a loaded set says about itself — every finding
 * pinned to a `file:line`, produced by the validator. This is the other half of
 * docs/architecture.md's Errors section: the four KINDS a write refuses with,
 * as schemas, so a refusal travels the wire, an MCP tool result and a chat
 * frame as itself rather than as a sentence somebody has to parse back.
 *
 * The four are `usage`, `not-found`, `validation` and `busy`, and the reason
 * they are four classes rather than one class with a `kind` string is that
 * they carry different things: only `validation` has a report to show, only
 * `not-found` names what was missed. A single struct would make every field
 * optional and push "which fields are meaningful" back into prose.
 *
 * There were five. `derived` was refused writes that would have stored a
 * status the tree computed, with the unfinished children listed as data — and
 * it went when derivation did (2026-08-11): a mark is a stored fact on any
 * node, so there is no second copy for a write to make and nothing left to
 * refuse. What survives of it is the RULE it was an instance of: a refusal
 * carries its detail as data, which is now `validation` carrying the
 * validator's own rows.
 */

import { Schema } from "effect"

import { OutlineError } from "./errors.ts"

/** Which half of the taxonomy a refusal belongs to. Exposed as a word because
 *  a transport that is not the wire — an MCP tool result, a log line — wants
 *  the category rather than the class. */
export type FailureKind = "usage" | "not-found" | "validation" | "busy"

/** The request itself is wrong: a field this op does not take, an empty title,
 *  a date that is not a date. Nothing was read and nothing was written. */
export class UsageFailure extends Schema.TaggedError<UsageFailure>(
  "@olai/format/UsageFailure",
)("UsageFailure", { reason: Schema.String }) {
  override get message(): string {
    return this.reason
  }
}

/** The op named something the loaded set does not hold — an id, a file. */
export class NotFoundFailure extends Schema.TaggedError<NotFoundFailure>(
  "@olai/format/NotFoundFailure",
)("NotFoundFailure", {
  reason: Schema.String,
  /** What was named. Present whenever the op named one thing; absent when the
   *  miss is about a place rather than a record. */
  named: Schema.optionalKey(Schema.String),
}) {
  override get message(): string {
    return this.reason
  }
}

/** The edit was well-formed and the set it would produce is not valid. The
 *  report is the validator's own, so a refused write and a broken file on disk
 *  are explained by the same rows. Nothing was written: the gate validates
 *  BEFORE it renames. */
export class ValidationFailure extends Schema.TaggedError<ValidationFailure>(
  "@olai/format/ValidationFailure",
)("ValidationFailure", {
  reason: Schema.String,
  errors: Schema.Array(OutlineError),
}) {
  override get message(): string {
    return this.reason
  }
}

/** Something else holds the thing this op needed: a turn already running, a
 *  write that kept colliding. Try again is the whole advice. */
export class BusyFailure extends Schema.TaggedError<BusyFailure>(
  "@olai/format/BusyFailure",
)("BusyFailure", { reason: Schema.String }) {
  override get message(): string {
    return this.reason
  }
}

/** The closed union every write refuses with — the one schema a procedure
 *  declares and a caller decodes against. */
export const OpFailure = Schema.Union([
  UsageFailure,
  NotFoundFailure,
  ValidationFailure,
  BusyFailure,
])
export type OpFailure = typeof OpFailure.Type

/** The closed table, and the only one. Every question about "which kind is
 *  this" — the word an MCP result carries, the attribute the panel draws, the
 *  test for whether an unknown failure is one of ours — reads it, so a fifth
 *  kind is one edit and a `_tag` that stops matching is a type error. */
const KINDS = {
  UsageFailure: "usage",
  NotFoundFailure: "not-found",
  ValidationFailure: "validation",
  BusyFailure: "busy",
} as const satisfies Record<OpFailure["_tag"], FailureKind>

/** Reads the DECODED value, so it answers for a refusal that has crossed the
 *  wire as well as for one that never left: `_tag` is what survives. */
export const kindOf = (failure: OpFailure): FailureKind => KINDS[failure._tag]

/**
 * Is this one of ours?
 *
 * A caller that runs a procedure sees two kinds of failure: the declared
 * refusals, which it renders, and the framework's own transport failures,
 * which it does not. Telling them apart against the closed table above rather
 * than against the SHAPE of a tag — a name ending in `Failure`, say — is what
 * keeps a framework error that happens to be spelled similarly from being
 * drawn as a refused write.
 */
export const isOpFailure = (failure: unknown): failure is OpFailure =>
  typeof failure === "object" && failure !== null && "_tag" in failure &&
  (failure as { readonly _tag: unknown })._tag as string in KINDS
