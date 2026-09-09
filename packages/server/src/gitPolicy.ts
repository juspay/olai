/** Transitional in-process fixture adapter. Public policy flags are gone;
 * step 5 moves the remaining direct serve tests onto authored file fixtures. */
import { COMMIT_DEFAULT, PUSH_DEFAULT, type GitPin } from "@olai/format"

export const gitConfigPatch = (
  pin: GitPin,
): ReadonlyArray<{ readonly id: "git"; readonly config: Record<string, unknown> }> => {
  if (pin.commit === null && pin.push === null) return []
  return [{
    id: "git",
    config: {
      commit: pin.commit ?? COMMIT_DEFAULT,
      push: pin.push ?? PUSH_DEFAULT,
    },
  }]
}
