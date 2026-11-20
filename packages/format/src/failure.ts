import { Schema } from "effect"

import { Verdict } from "./verdict.ts"

export type FailureKind = "usage" | "not-found" | "validation" | "busy"

export class UsageFailure extends Schema.TaggedError<UsageFailure>(
  "@olai/format/UsageFailure",
)("UsageFailure", { reason: Schema.String }) {
  override get message(): string {
    return this.reason
  }
}

export class NotFoundFailure extends Schema.TaggedError<NotFoundFailure>(
  "@olai/format/NotFoundFailure",
)("NotFoundFailure", {
  reason: Schema.String,
  named: Schema.optionalKey(Schema.String),
}) {
  override get message(): string {
    return this.reason
  }
}

export class ValidationFailure extends Schema.TaggedError<ValidationFailure>(
  "@olai/format/ValidationFailure",
)("ValidationFailure", {
  reason: Schema.String,
  verdict: Verdict,
}) {
  override get message(): string {
    return this.reason
  }
}

export const BusyCause = Schema.Struct({
  kind: Schema.Literal("capacity"),
  capacity: Schema.Int,
})
export type BusyCause = typeof BusyCause.Type

export class BusyFailure extends Schema.TaggedError<BusyFailure>(
  "@olai/format/BusyFailure",
)("BusyFailure", { reason: Schema.String, cause: Schema.optionalKey(BusyCause) }) {
  override get message(): string {
    return this.reason
  }
}

export const OpFailure = Schema.Union([
  UsageFailure,
  NotFoundFailure,
  ValidationFailure,
  BusyFailure,
])
export type OpFailure = typeof OpFailure.Type

const KINDS = {
  UsageFailure: "usage",
  NotFoundFailure: "not-found",
  ValidationFailure: "validation",
  BusyFailure: "busy",
} as const satisfies Record<OpFailure["_tag"], FailureKind>

export const kindOf = (failure: OpFailure): FailureKind => KINDS[failure._tag]

export const isOpFailure = (failure: unknown): failure is OpFailure =>
  typeof failure === "object" && failure !== null && "_tag" in failure &&
  (failure as { readonly _tag: unknown })._tag as string in KINDS
