import type { Applied, Edit } from "@olai/surface"
import type { OpFailure } from "@olai/format"
import { type Effect, Result } from "effect"

import { NO_EDITS, type EditWriters } from "@olai/plugin-api"
import { heldService } from "@olai/ui-primitives/held.ts"

import { runAsync } from "./run.ts"
import type { Undo } from "@olai/edit-history/undoing.ts"

export type EditWriter = (edit: Edit) => Effect.Effect<Applied, unknown>

import type { Said } from "./saying.ts"

export interface Writing {
  readonly applying: (edit: Edit, record: Undo["record"]) => Promise<Said | undefined>
  readonly applyingAll: (
    edits: ReadonlyArray<Edit>,
    record: Undo["record"],
  ) => Promise<Said | undefined>
  readonly applied: (
    edit: Edit,
    record: Undo["record"],
  ) => Promise<Result.Result<Applied, OpFailure>>
}

export const writingWith = (write: EditWriter): Writing => {
const applying = async (
  edit: Edit,
  record: Undo["record"],
): Promise<Said | undefined> => {
  const outcome = await applied(edit, record)
  if (Result.isFailure(outcome)) {
    return { tone: "alarm", text: outcome.failure.message }
  }
  const nudge = outcome.success.nudge
  return nudge === undefined ? undefined : { tone: "aside", text: nudge }
}

const applyingAll = async (
  edits: ReadonlyArray<Edit>,
  record: Undo["record"],
): Promise<Said | undefined> => {
  let last: Said | undefined
  for (const edit of edits) {
    const said = await applying(edit, record)
    if (said === undefined) continue
    last = said
    if (said.tone === "alarm") return said
  }
  return last
}

const applied = async (
  edit: Edit,
  record: Undo["record"],
): Promise<Result.Result<Applied, OpFailure>> => {
  const pending = runAsync(write(edit))
  record(pending.then((outcome) => Result.isSuccess(outcome) ? outcome.success.undo : undefined))
  return await pending
}

  return { applying, applyingAll, applied }
}

export interface HeldWrites extends Writing {
  readonly holdEdits: (table: EditWriters) => () => void
  readonly writeEdit: EditWriter
}

export const heldWrites = (): HeldWrites => {
  const table = heldService<EditWriters>()
  const writeEdit = ((edit) => (table.read() ?? NO_EDITS).write(edit)) as EditWriter
  return { holdEdits: table.hold, writeEdit, ...writingWith(writeEdit) }
}
