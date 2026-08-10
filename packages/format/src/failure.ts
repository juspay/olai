/**
 * What a WRITE says when it says no.
 *
 * {@link ./errors.ts} is what a loaded set says about itself — every finding
 * pinned to a `file:line`, produced by the validator. This is the other half of
 * docs/architecture.md's Errors section: the five KINDS a write refuses with,
 * as schemas, so a refusal travels the wire, an MCP tool result and a chat
 * frame as itself rather than as a sentence somebody has to parse back.
 *
 * The five are `usage`, `not-found`, `validation`, `derived` and `busy`, and
 * the reason they are five classes rather than one class with a `kind` string
 * is that they carry different things. Only `derived` has children to list;
 * only `validation` has a report to show. A single struct would make every
 * field optional and push "which fields are meaningful" back into prose.
 *
 * `derived` is the one that earns the whole design. Marking a node whose status
 * is computed from its children is refused (docs/format.md: no stored derived
 * state), and the refusal is only useful if it says WHICH children are
 * unfinished — as data, so the chat panel draws them as rows and an agent can
 * act on them one at a time. That is the "errors that teach" rule made
 * concrete, and it is why the list is a field and not a sentence.
 */

import { Schema } from "effect"

import { OutlineError } from "./errors.ts"

/** Which half of the taxonomy a refusal belongs to. Exposed as a word because
 *  a transport that is not the wire — an MCP tool result, a log line — wants
 *  the category rather than the class. */
export type FailureKind = "usage" | "not-found" | "validation" | "derived" | "busy"

/** A child standing between a node and the state a write asked for. `status`
 *  is the DERIVED one ({@link ./derive.ts}), because that is what makes it
 *  unfinished; `id` is what the next write names. */
export const Unfinished = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.Literals(["open", "doing"]),
})
export type Unfinished = typeof Unfinished.Type

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

/** The write would store state the tree already answers. Not a mistake — there
 *  is something else to do, and `children` says what. */
export class DerivedFailure extends Schema.TaggedError<DerivedFailure>(
  "@olai/format/DerivedFailure",
)("DerivedFailure", {
  reason: Schema.String,
  /** The node the write was aimed at. */
  id: Schema.String,
  title: Schema.String,
  /** Its counted children that are not done. EMPTY is a real answer: the node
   *  already derives the state that was asked for, so there is nothing to
   *  write — the same refusal with a different sentence. */
  children: Schema.Array(Unfinished),
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
  DerivedFailure,
  BusyFailure,
])
export type OpFailure = typeof OpFailure.Type

const KINDS = {
  UsageFailure: "usage",
  NotFoundFailure: "not-found",
  ValidationFailure: "validation",
  DerivedFailure: "derived",
  BusyFailure: "busy",
} as const satisfies Record<OpFailure["_tag"], FailureKind>

export const kindOf = (failure: OpFailure): FailureKind => KINDS[failure._tag]
