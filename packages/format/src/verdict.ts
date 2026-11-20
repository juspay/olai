import { Schema } from "effect"

import { blamedOn, type BrokenFile, OutlineError, stageOf } from "./errors.ts"
import { byPath } from "./paths.ts"

export const Verdict = Schema.Struct({
  findings: Schema.Array(OutlineError),
})
export type Verdict = typeof Verdict.Type

export const NOTHING_WRONG: Verdict = { findings: [] }

export const verdictOf = (findings: ReadonlyArray<OutlineError>): Verdict =>
  findings.length === 0 ? NOTHING_WRONG : { findings }

export const isClean = (verdict: Verdict): boolean => verdict.findings.length === 0

export type Admission =
  | { readonly _tag: "admitted" }
  | {
    readonly _tag: "implicated"
    readonly file: string
    readonly rows: ReadonlyArray<OutlineError>
  }

const ADMITTED: Admission = { _tag: "admitted" }

export const admits = (
  broken: ReadonlyArray<BrokenFile>,
  files: ReadonlyArray<string>,
): Admission => {
  const whole = broken.find((entry) =>
    entry.errors.some((row) => row.code === "unreadable-directory")
  )
  if (whole !== undefined) {
    return { _tag: "implicated", file: whole.file, rows: whole.errors }
  }
  for (const file of files) {
    const entry = broken.find((one) => one.file === file)
    if (entry !== undefined && entry.errors.length > 0) {
      return { _tag: "implicated", file, rows: entry.errors }
    }
  }
  return ADMITTED
}

export const darkened = (
  standing: ReadonlyArray<BrokenFile>,
  broken: ReadonlyArray<BrokenFile>,
): ReadonlyArray<string> =>
  broken
    .filter((entry) => !standing.some((was) => was.file === entry.file))
    .map((entry) => entry.file)

export type FileState = "unreadable" | "unparsed" | "invalid"

export interface FileFace {
  readonly file: string
  readonly state: FileState
  readonly count: number
}

export interface Summary {
  readonly files: ReadonlyArray<FileFace>
  readonly more: number
  readonly total: number
}

export const summaryOf = (broken: ReadonlyArray<BrokenFile>, n: number): Summary => {
  const faces = broken.map((entry): FileFace => ({
    file: entry.file,
    state: stateOf(entry.errors),
    count: entry.errors.length,
  }))
  const clamp = Math.max(0, n)
  return {
    files: faces.slice(0, clamp),
    more: Math.max(0, faces.length - clamp),
    total: faces.reduce((sum, face) => sum + face.count, 0),
  }
}

const stateOf = (rows: ReadonlyArray<OutlineError>): FileState => {
  if (rows.some((row) => row.code === "unreadable-directory" || row.code === "unreadable-file")) {
    return "unreadable"
  }
  return rows.some((row) => stageOf(row.code) === "line") ? "unparsed" : "invalid"
}

export const blamed = (
  report: ReadonlyArray<OutlineError>,
): ReadonlyArray<BrokenFile> => {
  const files = new Map<string, Array<OutlineError>>()
  for (const finding of report) {
    for (const file of blamedOn(finding)) {
      const rows = files.get(file)
      if (rows === undefined) files.set(file, [finding])
      else rows.push(finding)
    }
  }
  return [...files.keys()].sort(byPath).map((file) => ({
    file,
    errors: files.get(file) as ReadonlyArray<OutlineError>,
  }))
}
