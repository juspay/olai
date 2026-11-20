import type { Who } from "@olai/surface"
import { Result } from "effect"

export const fromAsk = (
  outcome: Result.Result<Who | null, unknown>,
): Who | null => {
  if (Result.isFailure(outcome)) throw outcome.failure
  return outcome.success
}
