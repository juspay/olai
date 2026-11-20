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

import { askedOf, carried } from "./asked.ts"
import { type Plan, type Scope, typedIn } from "./plan.ts"

export type Folding = (made: Plan) => Result.Result<Scope, OpFailure>

export const folding = (from: Scope): Folding => {
  let at = from
  let base = from.asked
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
    const asked = carried(base, next.set, wrote)
    if (asked === undefined) {
      base = askedOf(next.claims, next.set)
      wrote = new Map()
    }
    at = {
      ...next,
      outlineRow: at.outlineRow,
      context: at.context,
      asked: asked ?? base,
      typed: typedIn(next, at.typed.kinds),
    }
    return Result.succeed(at)
  }
}
