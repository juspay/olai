import { Order, Schema } from "effect"

import { Site } from "./node.ts"
import { byPath } from "./paths.ts"

export type Stage = "line" | "set"

type Reach = Stage | "set-across-files" | "set-per-finding"

const CATALOGUE = {
  "not-json": "line",
  "not-an-object": "line",
  "bad-record": "line",
  "bad-id": "line",
  "several-marks": "line",
  "bad-date": "line",
  "bad-repeat": "line",

  "duplicate-id": "set",
  "ambiguous-convention": "set",
  "unknown-parent": "set",
  "foreign-parent": "set",
  "parent-not-a-node": "set",
  "parent-cycle": "set",
  "unknown-target": "set-across-files",
  "after-cycle": "set",
  "mirror-cycle": "set",
  "bad-prop": "set-per-finding",
  "unreadable-directory": "set",
  "unreadable-file": "line",
} as const satisfies Record<string, Reach>

export type ErrorCode = keyof typeof CATALOGUE
export const ErrorCode = Schema.Literals(
  Object.keys(CATALOGUE) as Array<ErrorCode>,
)

export const stageOf = (code: ErrorCode): Stage => CATALOGUE[code] === "line" ? "line" : "set"

export const isGuessWhileUnreadable = (
  error: Pick<OutlineError, "code" | "across">,
): boolean =>
  CATALOGUE[error.code] === "set-across-files" ||
  (CATALOGUE[error.code] === "set-per-finding" && error.across === true)

export const reportStage = (
  errors: ReadonlyArray<{ readonly code: ErrorCode }>,
): Stage => errors.some((error) => stageOf(error.code) === "line") ? "line" : "set"

export const Related = Schema.Struct({
  ...Site.fields,
  note: Schema.String,
  broken: Schema.optionalKey(Schema.Boolean),
})
export type Related = typeof Related.Type

export const OutlineError = Schema.Struct({
  ...Site.fields,
  code: ErrorCode,
  message: Schema.String,
  related: Schema.optionalKey(Schema.Array(Related)),
  across: Schema.optionalKey(Schema.Boolean),
})
export type OutlineError = typeof OutlineError.Type

export const BrokenFile = Schema.Struct({
  file: Schema.String,
  errors: Schema.Array(OutlineError),
})
export type BrokenFile = typeof BrokenFile.Type

export const implicatedBy = (error: OutlineError): ReadonlyArray<string> =>
  filesOf(error, () => true)

export const blamedOn = (error: OutlineError): ReadonlyArray<string> =>
  filesOf(error, (related) => related.broken !== false)

const filesOf = (
  error: OutlineError,
  keeps: (related: Related) => boolean,
): ReadonlyArray<string> => {
  const files = [error.file]
  for (const related of error.related ?? []) {
    if (keeps(related) && !files.includes(related.file)) files.push(related.file)
  }
  return files
}

export const isCrossFile = (error: OutlineError): boolean => blamedOn(error).length > 1

export const hasLine = (site: Pick<Site, "line">): boolean => site.line > 0

export const errorLine = (error: OutlineError): string =>
  `${error.file}${hasLine(error) ? `:${error.line}` : ""} ${error.message}`

export const chainOf = (path: ReadonlyArray<string>): string =>
  path.map((id) => `\`${id}\``).join(" → ")

export const compareErrors: Order.Order<OutlineError> = Order.Struct({
  file: byPath,
  line: Order.Number,
  code: Order.String,
})
