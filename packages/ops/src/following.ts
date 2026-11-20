import { encoded } from "./encode.ts"
import {
  bodiedDocument,
  type Document,
  following,
  type OpFailure,


  ValidationFailure,
  verdictOf,
} from "@olai/format"
import { Result } from "effect"

import { carriedOrFresh, type SetFacts } from "./facts.ts"
import { type Plan, rescoped, type Scope } from "./plan.ts"

export type Folding = (made: Plan) => Result.Result<Scope, OpFailure>

export const folding = (from: Scope): Folding => {
  let at = from
  let base: SetFacts = from.facts
  let wrote = new Map<string, Document>()

  return (made) => {
    const written: Array<Document> = []
    for (const planned of made.files) {
      const read = encoded(at.claims, planned.file, planned.nodes)
      if (Result.isFailure(read)) return Result.fail(read.failure)
      written.push(read.success.outline)
    }
    for (const document of made.documents ?? []) {
      written.push(bodiedDocument(at.claims, document.file, document.text))
    }

    const next = following(at, written)

    wrote = new Map(wrote)
    for (const document of written) wrote.set(document.path, document)
    const { facts, carried } = carriedOrFresh(base, next, wrote)
    if (!carried) {
      base = facts
      wrote = new Map()
    }
    at = rescoped(at, next, facts)
    return Result.succeed(at)
  }
}
