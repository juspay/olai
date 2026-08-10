/**
 * Outlines as text, into the set a real load produces.
 *
 * The fixtures go through `parseOutline` and `assemble` — the format's own
 * public pair — rather than being written as record literals, because line
 * numbers are part of what a plan reads (sibling ties break on them) and a
 * hand-built `Located` could carry a line the file does not have. A fixture
 * that does not parse throws with the text quoted, so the diagnostic names the
 * fixture rather than the planner.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import {
  assemble,
  type Outline,
  type OutlineError,
  type OutlineSet,
  parseOutline,
} from "@olai/format"
import { Result } from "effect"

export const setOf = (files: Readonly<Record<string, string>>): OutlineSet =>
  assemble(
    new Map(
      Object.entries(files).map(([file, contents]) => {
        const parsed = parseOutline(file, contents)
        if (Result.isFailure(parsed)) throw new Error(unparsable(file, contents, parsed.failure))
        return [file, Result.succeed(parsed.success)] as const
      }),
    ),
  )

/** A fixture that must NOT parse — for the ops that have to refuse to write a
 *  file whose records are not loaded. */
export const brokenSetOf = (
  files: Readonly<Record<string, string>>,
  broken: Readonly<Record<string, string>>,
): OutlineSet =>
  assemble(
    new Map<string, Result.Result<Outline, ReadonlyArray<OutlineError>>>([
      ...Object.entries(files).map(([file, contents]) => {
        const parsed = parseOutline(file, contents)
        if (Result.isFailure(parsed)) throw new Error(unparsable(file, contents, parsed.failure))
        return [file, Result.succeed(parsed.success)] as const
      }),
      ...Object.entries(broken).map(([file, contents]) => {
        const parsed = parseOutline(file, contents)
        if (Result.isSuccess(parsed)) {
          throw new Error(`fixture \`${file}\` parses, so it cannot stand in for one that does not`)
        }
        return [file, Result.fail(parsed.failure)] as const
      }),
    ]),
  )

/** A planner context with no surprises in it: ids counted up from `n1`, and one
 *  fixed day. Both of the impure things an op needs, made boring. */
export const steady = () => {
  let minted = 0
  return {
    mint: () => `n${++minted}`,
    today: () => "2026-08-09",
  }
}

const unparsable = (
  file: string,
  contents: string,
  errors: ReadonlyArray<OutlineError>,
): string =>
  [
    `fixture \`${file}\` does not parse, so this test is not testing what it means to:`,
    ...errors.map((error) => `  ${error.file}:${error.line} ${error.code}: ${error.message}`),
    "as written:",
    ...contents.split("\n").map((line, index) => `  ${index + 1} | ${line}`),
  ].join("\n")
