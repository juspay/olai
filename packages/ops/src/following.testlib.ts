import { TEST_CLAIMS } from "./claims.testlib.ts"
import { apart, assemble, bodiedDocument, type Document, type OutlineError, reading, type SetDelta, type Verdict } from "@olai/format"
import { parseOutline, serializeOutline } from "olai-plugin-outline-olai/format"
import { Result } from "effect"

import { askedOf } from "./asked.ts"
import type { Folding } from "./following.ts"
import { type Scope, typedIn } from "./plan.ts"

type Decoded = Result.Result<Document, Verdict>

export const assembling = (from: Scope): Folding => {
  let files: Map<string, Decoded> | undefined
  let at: Scope = from

  return (made) => {
    files ??= apart(at.set)
    const upserts: Array<SetDelta["upserts"][number]> = []
    for (const planned of made.files) {
      const text = serializeOutline(planned.nodes)
      const read = parseOutline(planned.file, text, TEST_CLAIMS)
      if (Result.isFailure(read)) {
        throw new Error(`\`${planned.file}\` did not read back after being planned`)
      }
      files.set(planned.file, Result.succeed(read.success))
      upserts.push([planned.file, { nodes: read.success.nodes }])
    }
    for (const document of made.documents ?? []) {
      files.set(document.file, Result.succeed(bodiedDocument(TEST_CLAIMS, document.file, document.text)))
    }

    const next = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, files), { read: at, delta: { upserts, removes: [] } })
    at = { ...next, outlineRow: at.outlineRow, context: at.context, asked: askedOf(TEST_CLAIMS, next.set), typed: typedIn(next, at.typed.kinds) }
    return Result.succeed(at)
  }
}
