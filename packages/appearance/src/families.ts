/**
 * Which dark palette is the NIGHT OF which light one: the rule that stands
 * each dark swatch under its light sibling in the picker, kept beside the hue
 * arithmetic it reads (`./hues.ts`) so the picker only draws.
 *
 * A family is one hue read by day and by night. A neutral dark (basalt) goes
 * with the neutral light (chalk); a hued dark goes with the hued light whose
 * paper is nearest it on the wheel (abyss with reef, ember with manuscript).
 * Measured off the colours rather than listed by name, so a new row finds its
 * own family — and `./families.test.ts` holds that no light ends up with two.
 *
 * Pure: the palettes in, a pairing out.
 */

import { hueGap, oklchOf } from "./hues.ts"
import type { Palette } from "./palettes.ts"

/** A paper with too little chroma to have a hue: chalk's and basalt's sit
 *  under it, every hued paper well over it. */
const NEUTRAL_CHROMA = 0.01

/** Whether a colour is a neutral: too grey for its hue to mean anything. The
 *  one line the pairing below and `./palettes.test.ts` both tell a neutral
 *  by. */
export const isNeutral = (hex: string): boolean => oklchOf(hex).c < NEUTRAL_CHROMA

/** Each dark palette's name, to the name of the light palette it is the night
 *  of. `lights` is searched in order, so a tie goes to the earlier row; a dark
 *  with no light of its kind (a neutral dark and no neutral light) is left
 *  out. */
export const lightSiblings = (palettes: ReadonlyArray<Palette>): ReadonlyMap<string, string> => {
  const lights = palettes.filter((palette) => palette.scheme === "light")
  const pairs = new Map<string, string>()
  for (const dark of palettes.filter((palette) => palette.scheme === "dark")) {
    const ground = oklchOf(dark.colors.paper)
    const neutral = ground.c < NEUTRAL_CHROMA
    let nearest: Palette | undefined
    let gap = Number.POSITIVE_INFINITY
    for (const light of lights) {
      const paper = oklchOf(light.colors.paper)
      if ((paper.c < NEUTRAL_CHROMA) !== neutral) continue
      const distance = neutral ? 0 : hueGap(ground.h, paper.h)
      if (distance < gap) {
        gap = distance
        nearest = light
      }
    }
    if (nearest !== undefined) pairs.set(dark.name, nearest.name)
  }
  return pairs
}
