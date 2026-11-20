import { mintExt, type Claims } from "./kinds.ts"
import { Result, Schema } from "effect"

import { type Derived, nodesOf, unfinishedWork } from "./derive.ts"
import { INBOX, inboxIn, isRegular, mintedInto } from "./node.ts"
import { type OutlineSet, outlinePaths } from "./set.ts"
import { type OpFailure, UsageFailure } from "./failure.ts"
import type { Capture, WriteRequest } from "./writing.ts"

export const InboxHeld = Schema.Struct({
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

export const NO_INBOX: InboxHeld = { count: 0 }

export const sameInboxHeld: (a: InboxHeld, b: InboxHeld) => boolean =
  Schema.toEquivalence(InboxHeld)

export const inboxHeldOf = (set: OutlineSet, derived: Derived): InboxHeld =>
  inboxHeldIn(derived, inboxIn(derived.claims, outlinePaths(set)))

export const inboxHeldIn = (
  derived: Derived,
  file: string | undefined,
): InboxHeld => {
  if (file === undefined) return NO_INBOX
  const count = nodesOf(derived, file).filter(
    (located) => isRegular(located) && unfinishedWork(located.node),
  ).length
  return { count }
}

export type Capturing = Omit<Capture, "after" | "mark">

export const captureInto = (
  claims: Claims,
  outlineRow: string,
  paths: ReadonlyArray<string>,
  capture: Capturing,
): Result.Result<WriteRequest, OpFailure> => {
  const minted = { ...capture, mark: "todo" as const }
  const inbox = inboxIn(claims, paths)
  if (inbox !== undefined) return Result.succeed({ op: "add", file: inbox, ...minted })
  const ext = mintExt(claims, outlineRow)
  if (ext === null) return Result.fail(new UsageFailure({ reason: `the ${outlineRow} row is off, so no outline can be created` }))
  if (claims.byKind.get(outlineRow)?.holds !== "nodes") return Result.fail(new UsageFailure({ reason: `the ${outlineRow} row does not hold outlines` }))
  return Result.succeed({ op: "create", file: mintedInto(`${INBOX}${ext}`), seed: minted })
}

export const CAPTURED_BY = "captured-by"

export const CaptureRequest = Schema.Struct({
  title: Schema.String,
  text: Schema.optionalKey(Schema.String),
})
export type CaptureRequest = typeof CaptureRequest.Type

export const noteOf = (posted: CaptureRequest): string | undefined =>
  posted.text === undefined || posted.text === "" ? undefined : posted.text

export const capturingOf = (
  posted: CaptureRequest,
  login: string | null,
  at: string,
): Capturing => {
  const note = noteOf(posted)
  return {
    title: posted.title,
    ...(note === undefined ? {} : { desc: note }),
    date: at,
    ...(login === null ? {} : { props: { [CAPTURED_BY]: login } }),
  }
}
