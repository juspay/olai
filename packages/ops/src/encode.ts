/** Missing format is a planner defect. Invalid serialized records still go
 * through the store's validation gate, which owns their ordinary refusal. */
import { parserFor, ValidationFailure, verdictOf, NOTHING_WRONG, type Claims, type Document, type Node, type Outline } from "@olai/format"
import { Result } from "effect"
const missing = (file: string) => new ValidationFailure({
  reason: `\`${file}\` did not read back after being planned, so the batch was abandoned and nothing was written. This is a defect in olai rather than in the call. No active format claims the path.`,
  verdict: NOTHING_WRONG,
})

export const serialized = (claims: Claims, file: string, nodes: ReadonlyArray<Node>): Result.Result<string, ValidationFailure> => {
  const format = parserFor(claims, file)
  return format === null ? Result.fail(missing(file)) : Result.succeed(format.serialize(nodes))
}

/**
 * A batch's intermediate reading uses the same snapshot as its planner.
 *
 * `previous` is the document the file stands at before this op — `undefined`
 * for a file the op mints. It is handed to the format's parse so a record
 * whose title and note the op did not touch keeps the reading it had, and a
 * write reads the texts it changed and no others: without it, one changed
 * title in a 2,000-record outline put all 2,000 through the Markdown parser
 * again, on every op, before the store's own decode (which already carries).
 */
export const encoded = (
  claims: Claims,
  file: string,
  nodes: ReadonlyArray<Node>,
  previous: Document | undefined,
): Result.Result<{ text: string; outline: Outline }, ValidationFailure> => {
  const format = parserFor(claims, file)
  if (format === null) return Result.fail(missing(file))
  const text = format.serialize(nodes)
  const read = format.parse(file, text, claims, previous)
  return Result.isFailure(read)
    ? Result.fail(new ValidationFailure({
      reason: `\`${file}\` did not read back after being planned, so the batch was abandoned and nothing was written. This is a defect in olai rather than in the call.`,
      verdict: verdictOf(read.failure),
    }))
    : Result.succeed({ text, outline: read.success })
}
