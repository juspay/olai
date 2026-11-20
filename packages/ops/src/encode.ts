import { parserFor, ValidationFailure, verdictOf, NOTHING_WRONG, type Claims, type Node, type Outline } from "@olai/format"
import { Result } from "effect"
const missing = (file: string) => new ValidationFailure({
  reason: `\`${file}\` did not read back after being planned, so the batch was abandoned and nothing was written. This is a defect in olai rather than in the call. No active format claims the path.`,
  verdict: NOTHING_WRONG,
})

export const serialized = (claims: Claims, file: string, nodes: ReadonlyArray<Node>): Result.Result<string, ValidationFailure> => {
  const format = parserFor(claims, file)
  return format === null ? Result.fail(missing(file)) : Result.succeed(format.serialize(nodes))
}

export const encoded = (claims: Claims, file: string, nodes: ReadonlyArray<Node>): Result.Result<{ text: string; outline: Outline }, ValidationFailure> => {
  const format = parserFor(claims, file)
  if (format === null) return Result.fail(missing(file))
  const text = format.serialize(nodes)
  const read = format.parse(file, text, claims)
  return Result.isFailure(read)
    ? Result.fail(new ValidationFailure({
      reason: `\`${file}\` did not read back after being planned, so the batch was abandoned and nothing was written. This is a defect in olai rather than in the call.`,
      verdict: verdictOf(read.failure),
    }))
    : Result.succeed({ text, outline: read.success })
}
