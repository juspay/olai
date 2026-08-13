/**
 * THE THREE ALTITUDES, derived — the depth grammar as values a palette owes,
 * the same way it owes eight colours.
 *
 * The app used to be one plane: sidebar, document and chat shared the paper and
 * were told apart by hairlines. The grammar that replaced it has three rungs
 * and one rule for reading them:
 *
 *   canvas   the GROUND. Tonal, never white. Nothing floats at this level; it
 *            is the desk the rest sits on, and it is what the page's body is
 *            painted with.
 *   well     FURNITURE, recessed INTO whatever holds it — the month, a tool
 *            line, a code fence inside the sheet. Told by an inner shadow, so
 *            it reads as a hollow rather than as a second card.
 *   raised   CONTENT, floating ABOVE the ground — the document sheet, a chat
 *            message, a menu, a pill. Told by a drop shadow.
 *
 * And two fills that are not rungs:
 *
 *   picked   the accent-tinted ground of the thing a reader chose. Here rather
 *            than spelled as `bg-accent/12` at each site because a tint over a
 *            raised surface has to be mixed against THAT surface to be the same
 *            tint in every palette — an opacity composites over whatever
 *            happens to be behind it.
 *   seam     the colour of a line the pass KEPT. Elevation replaced the
 *            hairlines, so what is left is only the lines that mean something —
 *            a menu's group break, the outline's nesting guide, a resize handle,
 *            a rule under a major heading — and those need a colour that is
 *            about SEPARATION and nothing else. It used to be `rule`, which is a
 *            value each palette wrote for its own borders, and on `robot` that
 *            value IS its alarm: every line in the app came out the colour of an
 *            error, louder than the accent the pass had just finished rationing.
 *            Derived, so a line is quiet on all fifteen by construction.
 *
 * ## Why it is derived rather than written, and what "by construction" buys
 *
 * Olai has fifteen palettes and both schemes. Depth hand-tuned per palette is
 * fifteen chances for a card to vanish into the canvas, and the failure is
 * invisible in a diff: nobody reviewing a hex can see that two of them are now
 * the same shade. So the ramp is stated ONCE, as the distance each rung holds
 * from the ground — `RUNGS`, in the units WCAG states contrast in — and every
 * palette's three surfaces are CLIMBED to it from that palette's own paper.
 * `./depth.test.ts` then holds every row to the ramp: right order, real step,
 * and the AA promise still kept on the new surfaces by the palette that makes
 * it.
 *
 * ## The one asymmetry, and it is the whole point
 *
 * On a light ground depth is made by DARKENING what is behind; on a dark ground
 * it is made by LIGHTENING what is in front. A shadow on `pitch` (`#000000`) is
 * not a shadow, it is nothing — there is no darker. So the anchor moves:
 *
 *   light  `paper` is the TOP rung. `raised` IS the palette's paper, and the
 *          ramp descends from it toward that palette's own INK — which is what
 *          makes leaf's canvas green-grey and moon's lilac, rather than fifteen
 *          shades of the same grey.
 *   dark   `paper` is the BOTTOM rung. `canvas` IS the palette's paper — pitch
 *          stays pitch, and an OLED panel still spends nothing on the ground —
 *          and the ramp ascends toward WHITE.
 *
 * White rather than the palette's ink on the dark side, and it is not a
 * shortcut: a lift is LIGHT (it is the physical claim the grammar is making),
 * and the dark palettes' inks run from `#FFFFFF` to a mid-luminance orange
 * (`robot`), so climbing toward ink would give one palette a clear step and the
 * next one almost none. The tint follows the palette where the tint can be
 * anything, and is light where it has to be light.
 *
 * Read in one direction the two cases are the same statement: the ramp always
 * climbs AWAY from the ground in luminance, and `paper` is whichever end of it
 * the palette already named.
 */

import { contrastRatio, relativeLuminance } from "./contrast.ts"
import { mixed, translucent } from "./hex.ts"
import type { Palette } from "./palettes.ts"

/** THE RAMP: the three altitudes, in the order they climb. Its own list because
 *  it is what every claim about depth is a claim about — the ordering, the step,
 *  the AA promise on a ground body text lands on — and the two below are states
 *  rather than rungs, so a question asked of all five would have no answer. */
export const RUNG_TOKENS = ["canvas", "well", "raised"] as const

export type RungToken = (typeof RUNG_TOKENS)[number]

/** Every fill the grammar paints with, read through `--color-…` so each has its
 *  utilities — `bg-well`, `bg-raised`, `border-seam`. The order is the order
 *  they are written into a palette's block. */
export const SURFACE_TOKENS = [...RUNG_TOKENS, "picked", "seam"] as const

export type SurfaceToken = (typeof SURFACE_TOKENS)[number]

/**
 * The shadows, read through `--shadow-…`. Five, and each is a different thing
 * being said:
 *
 *   well    a recess. Inset, and the ONLY inset one — a surface at this level
 *           is a hollow in its host and takes no drop shadow at all.
 *   card    a surface at rest above the ground: a chat message, a pill, a
 *           composer.
 *   paper   the DOCUMENT. The deepest resting shadow in the app, because the
 *           sheet is the thing the reader came for and the rails are the desk
 *           around it.
 *   raised  a surface that has COME UP — a menu, a popover, the question card
 *           waiting to be answered. Above the resting cards, and it should look
 *           it.
 *   lift    what a hover promises: the same surface, one pixel higher. Spent
 *           only on things that can be pressed.
 */
export const SHADOW_TOKENS = ["well", "card", "paper", "raised", "lift"] as const

export type ShadowToken = (typeof SHADOW_TOKENS)[number]

/**
 * The ramp, as the contrast ratio each rung holds against the palette's own
 * paper. Two numbers, and they are the whole design:
 *
 *   `well` is deliberately small. A hollow is read from its inner shadow; a
 *   fill that also shouted would be two marks for one fact, and on the light
 *   side it has to sit BETWEEN the canvas and the paper rather than under both.
 *
 *   `top` is the full step between the ground and a floating surface — the
 *   distance at which a card stops dissolving into a tonal desk. The ratified
 *   mock measures 1.21 (`#FFFFFF` over `#E9E7F2`), and it gets away with that
 *   because its canvas is a saturated lavender: a tint the eye reads as a
 *   different SURFACE and not only as a darker one. Olai's palettes include
 *   several whose ink is close to neutral, where the same ratio came out as
 *   two greys nobody could separate on a laptop screen at arm's length — so the
 *   ramp is set above the mock's measurement rather than at it. This number is
 *   the one thing here worth arguing about in review, and it is one number.
 */
export const RUNGS = {
  well: 1.14,
  top: 1.36,
} as const

/**
 * The floor a floating surface has to clear off the ground, whatever `RUNGS`
 * says — an INDEPENDENT number, and it exists because the obvious test is
 * circular.
 *
 * "No palette's cards vanish" asked against `RUNGS.top` only ever proves that
 * the derivation hit its own target: quiet the knob to 1.05 and every palette
 * still passes while every card nearly disappears. So the claim is made twice —
 * once against the ramp (did the climb land where it was aimed) and once against
 * this (is the result a surface a person can see) — and this one is written down
 * from the ratified mock rather than from the ramp: `#FFFFFF` over `#E9E7F2`
 * measures 1.21, which is a step the human looked at and approved.
 */
export const VISIBLE = 1.21

/** How much accent goes into a picked surface. More on a dark ground for the
 *  reason everything else here is asymmetric: the same 16% over a near-black
 *  card is a tint nobody can see. */
const PICK = { light: 0.16, dark: 0.3 } as const

/**
 * How far a SEAM is from the surface it is drawn ON — the faintest line that
 * surface can carry and still show it.
 *
 * Measured off `raised` rather than off the paper, and that is what makes one
 * fraction serve both schemes. A line in this app is drawn on CONTENT — a rule
 * under a heading, a break between two groups of a menu, the seam between the
 * halves of a tool call — and `raised` is the content surface on either side of
 * the asymmetry. Mixing it toward the palette's INK then takes care of the
 * direction on its own: a light palette's ink is dark, so the seam comes out
 * darker than the sheet; a dark palette's is light, so it comes out lighter than
 * the card. A separating line only has to be not-its-surface, in whichever
 * direction that surface leaves free.
 *
 * 0.22 is where `chalk`'s seam lands on `#C8C8C3`, which is its `rule`
 * (`#C9CDBF`) to within a hex step — so the light palettes look exactly as they
 * did, and the change is entirely about the rows where `rule` was never a line
 * colour to begin with.
 */
const SEAM = 0.22

/**
 * `from`, mixed toward `toward` until it is `ratio` away from `from` — the
 * climb the whole ramp is built out of.
 *
 * A bisection rather than arithmetic, because relative luminance is not linear
 * in the channels the mix happens in: there is no closed form for "how far
 * along this blend is the ratio I asked for". Monotone in the mix as long as
 * `toward` is on the far side of `from` in luminance, which is what makes
 * bisecting sound — light schemes climb toward their ink (always darker than
 * their paper), dark ones toward white (always lighter than theirs).
 *
 * Twenty steps is finer than a channel: a hex has 256 of them, so the answer
 * stops moving long before the loop does.
 *
 * If the whole blend cannot reach the ratio, this returns `toward` itself —
 * the closest there is — rather than throwing. A palette that needed the whole
 * distance is a palette whose ink and paper are nearly the same colour, which
 * is a legibility problem this file did not cause and cannot fix; the test says
 * so out loud instead, per row, which is a better error than a stack trace at
 * import time.
 */
const climb = (from: string, toward: string, ratio: number): string => {
  let low = 0
  let high = 1
  for (let step = 0; step < 20; step++) {
    const middle = (low + high) / 2
    if (contrastRatio(from, mixed(from, toward, middle)) < ratio) low = middle
    else high = middle
  }
  return mixed(from, toward, high)
}

/** Which way this palette's ramp climbs, and toward what. `light` moves off its
 *  paper toward its own ink; `dark` moves off it toward white. See the header. */
const tintOf = (palette: Palette): string =>
  palette.scheme === "dark" ? "#FFFFFF" : palette.colors.ink

/**
 * The three rungs and the picked state, for one palette.
 *
 * Which rung `paper` IS is the scheme's answer, and it is the only branch:
 * everything else is the same climb read from the same end.
 */
const surfacesOf = (palette: Palette): Record<SurfaceToken, string> => {
  const paper = palette.colors.paper
  const tint = tintOf(palette)
  /** The far end of the ramp — the rung `paper` is NOT. Named once, because
   *  which of the two ends is the ground is the scheme's one decision and
   *  spelling the climb twice would be two places for it to be edited. */
  const far = climb(paper, tint, RUNGS.top)
  const dark = palette.scheme === "dark"
  const raised = dark ? far : paper
  return {
    canvas: dark ? paper : far,
    well: climb(paper, tint, RUNGS.well),
    raised,
    picked: mixed(raised, palette.colors.accent, PICK[palette.scheme]),
    // Toward the palette's own INK rather than toward `rule`, and that is the
    // whole point of it: `rule` is a value each palette wrote for its own
    // borders, and three of them wrote something that is not a line colour at
    // all — `robot`'s rule IS its alarm, so every line the app drew on that row
    // came out in the colour of an error. See `SEAM`.
    seam: mixed(raised, palette.colors.ink, SEAM),
  }
}

/**
 * The shadows, for one palette — and the second half of the asymmetry.
 *
 * LIGHT: the shadow is the palette's own INK at low alphas, so a green palette
 * casts a green-black shadow and the depth belongs to the theme rather than
 * sitting on top of it. Two layers each — a tight one for the contact edge and
 * a wide one for the cast — because one blur can be a contact or an ambience
 * and not both.
 *
 * DARK: black, plus something a light ground never needs — a one-pixel INSET
 * HIGHLIGHT along the top edge. That line is what actually says "raised" on a
 * dark ground: it is the lit edge of a surface that has come toward you, and it
 * reads even on `pitch`, where a black shadow against a black canvas is
 * invisible by definition. The alphas are heavier for the same reason a dark
 * photograph needs more contrast than a bright one.
 *
 * The WELL inverts cleanly in both: an inner shadow at the top edge is a
 * hollow whichever way the ground goes, and it takes a faint inset hairline
 * with it so a recess has an edge without anybody drawing a border.
 *
 * It is deliberately the STRONGEST of the light shadows, and the reason is the
 * ramp: on a light palette a well sits BETWEEN the canvas and the paper, so its
 * fill is LIGHTER than the ground it is sunk into. Fill alone would read as a
 * card. What says "hollow" is the inner shadow, so it has to be the loudest
 * thing on the box rather than the faintest — which is also what the ratified
 * mock does, whose rail is a lighter lavender than its canvas.
 */
const shadowsOf = (palette: Palette): Record<ShadowToken, string> => {
  const dark = palette.scheme === "dark"
  /** The cast. A shadow is an absence of light, so on a dark ground it is
   *  black rather than the palette's ink — see the note above. */
  const cast = (alpha: number): string =>
    translucent(dark ? "#000000" : palette.colors.ink, alpha)
  /** The lit top edge, and nothing at all in a light palette: a white line
   *  along the top of a white card is a line nobody can see. */
  const lit = (alpha: number): string =>
    dark ? `, inset 0 1px 0 ${translucent("#FFFFFF", alpha)}` : ""

  return dark
    ? {
      // The inset hairline is DOUBLE the light side's, and it is doing a job
      // there that it only helps with here: on a `#000000` canvas the inner
      // shadow is black on black and contributes nothing, so the lit edge of the
      // hollow is the only cue a well in the GROUND has. It is still the weak
      // half of the grammar on the three true-black rows — a well inside the
      // sheet recesses properly, a well in the canvas reads as a slightly
      // lighter pad — and it is weak because there is nothing below zero, not
      // because nobody looked.
      well: `inset 0 1px 3px ${cast(0.55)}, inset 0 0 0 1px ${
        translucent("#FFFFFF", 0.09)
      }`,
      card: `0 1px 2px ${cast(0.5)}, 0 3px 10px ${cast(0.35)}${lit(0.06)}`,
      paper: `0 1px 2px ${cast(0.5)}, 0 10px 30px ${cast(0.4)}${lit(0.07)}`,
      raised: `0 2px 6px ${cast(0.55)}, 0 12px 28px ${cast(0.45)}${lit(0.1)}`,
      lift: `0 2px 6px ${cast(0.5)}, 0 8px 20px ${cast(0.4)}${lit(0.12)}`,
    }
    : {
      well: `inset 0 1px 3px ${cast(0.11)}, inset 0 0 0 1px ${cast(0.07)}`,
      card: `0 1px 2px ${cast(0.05)}, 0 3px 10px ${cast(0.08)}`,
      paper: `0 1px 2px ${cast(0.06)}, 0 8px 28px ${cast(0.1)}`,
      raised: `0 2px 4px ${cast(0.08)}, 0 10px 24px ${cast(0.16)}`,
      lift: `0 2px 4px ${cast(0.07)}, 0 6px 16px ${cast(0.12)}`,
    }
}

/** Everything the depth grammar owes one palette. */
export interface Depth {
  readonly surfaces: Readonly<Record<SurfaceToken, string>>
  readonly shadows: Readonly<Record<ShadowToken, string>>
}

export const depthOf = (palette: Palette): Depth => ({
  surfaces: surfacesOf(palette),
  shadows: shadowsOf(palette),
})

/**
 * How far a surface is from the ground it sits on, in the ratio `RUNGS` is
 * stated in — the one question a reviewer of a new palette wants answered, and
 * the one `./depth.test.ts` asks of every row.
 *
 * Exported so the claim is asked the same way it is built, rather than
 * re-derived beside the assertion.
 */
export const stepOf = (depth: Depth, token: RungToken): number =>
  contrastRatio(depth.surfaces[token], depth.surfaces.canvas)

/**
 * Whether a ramp climbs at all: strictly up in luminance from the ground,
 * through the well, to a floating surface.
 *
 * ONE question for both schemes, which is the point — a light palette's canvas
 * is its paper darkened and a dark one's raised surface is its paper lightened,
 * and read as distance-from-the-ground the two are the same sentence. A ramp
 * that inverted would be a card cut INTO the desk.
 *
 * It is asked of the DEPTH and not of the palette: the scheme is already spent
 * by the time these three values exist, so a palette here would be a parameter
 * whose only use is to be ignored.
 */
export const climbs = (depth: Depth): boolean => {
  const ground = relativeLuminance(depth.surfaces.canvas)
  const above = relativeLuminance(depth.surfaces.raised)
  const between = relativeLuminance(depth.surfaces.well)
  return above > between && between > ground
}
