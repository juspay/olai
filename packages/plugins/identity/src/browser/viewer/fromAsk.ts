/**
 * The door's answer as the chip reads it: a person, nobody, or a throw
 * that the resource treats as a failed door. Its own file so a failed ask
 * is a test that does not dial the wire.
 */

import type { Who } from "@olai/surface"
import { Result } from "effect"

export const fromAsk = (
  outcome: Result.Result<Who | null, unknown>,
): Who | null => {
  if (Result.isFailure(outcome)) throw outcome.failure
  return outcome.success
}
