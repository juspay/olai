/**
 * WHAT ALTITUDE A BOX IS AT, as the utilities that put it there.
 *
 * `theme/depth.ts` derives the values — three surface fills, five shadows, per
 * palette. This is the other half: the handful of spellings a component reaches
 * for so that a card is a card everywhere, and the depth grammar is a
 * vocabulary rather than fifty places that each chose a shadow.
 *
 * Class strings and not CSS classes, for the reason `styles.css` gives at the
 * top of itself: a rule and the markup it styles must not be able to drift
 * apart, and `@apply` is the one Tailwind feature that recreates the problem
 * utilities solve. So these are `touch.ts`'s and `tone.ts`'s idiom — a constant
 * that is spliced into a `class`, greppable to every site that uses it.
 *
 * The shadows are read as `shadow-[var(--shadow-…)]` rather than as generated
 * `shadow-card` utilities, and that is deliberate: Tailwind bakes a theme
 * shadow's VALUE into the utility it emits, so a `:root[data-theme="pitch"]`
 * block re-answering the property would not reach it. Reading the property
 * through an arbitrary value is what makes a shadow follow the palette the way
 * every colour already does. Written once, here.
 *
 * ## The grammar, in one place
 *
 *   CANVAS   the ground. The page body wears it, and so does everything that is
 *            not content: the directory column, the icon rail, the chat dock.
 *   BAR      a strip of the ground that floats anyway — the app header.
 *   WELL     recessed: furniture, in the canvas or inside the sheet. An inner
 *            shadow, no drop shadow, and no border — the inset hairline that
 *            comes with the shadow is the edge.
 *   CARD     floating at rest: a chat message, a pill, the composer.
 *   PAPER    the document. The widest radius and the deepest resting shadow in
 *            the app, because the sheet is what the reader came for.
 *   RAISED   come UP: a menu, a popover, a question waiting to be answered.
 *   LIFT     what a pointer promises on something pressable — one pixel, and a
 *            slightly stronger shadow. Motion-gated (see below).
 *   LIFTS    the same, for a row that has no surface of its own until then.
 *   PICKED   the thing a reader chose: accent tint, accent ring.
 *   SPINE    the one row in force, wearing the accent line.
 *
 * Radii are Tailwind's own scale rather than tokens of their own: they do not
 * vary by palette, and three names for `rounded-lg`/`xl`/`2xl` would be a
 * second vocabulary for a decision the first one already makes.
 */

/** The ground the whole app sits on. */
export const CANVAS = "bg-canvas"

/**
 * A strip of the GROUND that nevertheless floats: the app header.
 *
 * The canvas's own fill, so the pills standing on it read as cards rather than
 * dissolving into a raised bar — which is exactly what the ratified mock draws.
 * And a card's shadow, because the page scrolls underneath a sticky bar and
 * something has to say which of the two is on top. Both halves are the reason
 * this is not just `CANVAS`.
 */
export const BAR = "bg-canvas shadow-[var(--shadow-card)]"

/** A recess. The inset hairline in `--shadow-well` is its edge — a box wearing
 *  this must not also carry a border, which is the whole of "elevation replaces
 *  borders" said as a rule. */
export const WELL = "bg-well shadow-[var(--shadow-well)]"

/** A surface at rest above the ground. */
export const CARD = "bg-raised shadow-[var(--shadow-card)]"

/** The document sheet. */
export const PAPER = "bg-raised shadow-[var(--shadow-paper)]"

/** A surface that has come up: menus, popovers, a question still open. */
export const RAISED = "bg-raised shadow-[var(--shadow-raised)]"

/**
 * What can be pressed says so by depth — a pixel of rise and a stronger
 * shadow under the pointer.
 *
 * The RISE is gated on `motion-safe`, the shadow is not: a reader who asked for
 * less motion still gets told what is interactive, they just do not get the
 * thing that moves. (Tailwind's `motion-safe:` is
 * `prefers-reduced-motion: no-preference`, which is the same gate
 * `styles.css` uses for the row-detail fade.)
 *
 * It carries no fill. A row that lifts off the canvas needs one (`LIFTS`
 * below); a card that is already raised does not — it just rises.
 */
export const LIFT =
  "transition-[box-shadow,transform] duration-100 " +
  "hover:shadow-[var(--shadow-lift)] motion-safe:hover:-translate-y-px"

/** A row that is PART OF the ground until a pointer is on it — a tree entry, a
 *  day, a menu item. It comes up to the resting card level, which is what makes
 *  the hover read as picking the row up off the desk rather than as tinting it. */
export const LIFTS = `${LIFT} hover:bg-raised`

/**
 * The thing a reader chose.
 *
 * THREE things at once, and each is carrying a different half of the claim: the
 * accent TINT says which of the options this is, the accent RING says it was
 * chosen rather than merely tinted (a tint alone is a shade some palettes barely
 * show), and it STAYS at the resting card altitude, because a chosen thing has
 * been picked up and put down — it is not still hovering, and it must not sink
 * back to the ground either.
 */
export const PICKED =
  "bg-picked shadow-[var(--shadow-card)] inset-ring-2 inset-ring-accent"

/**
 * The row IN FORCE — the open file in the directory, and nothing else.
 *
 * A card, plus one of the two lines the depth pass deliberately kept: a
 * three-pixel accent SPINE down its leading edge, which is the app's answer to
 * "which file am I reading".
 *
 * It sits OUTSIDE the card, in the column's own padding, and that is the whole
 * reason it is a pseudo-element rather than a border or an inset shadow. A
 * border would move the label sideways when the selection arrived; an inset
 * shadow follows the card's `border-radius` and comes out as a crescent rather
 * than a bar. A bar beside the card is what the ratified mock draws, and it is
 * the only thing in the column shaped like it.
 */
export const SPINE =
  "relative bg-raised shadow-[var(--shadow-card)] " +
  "before:absolute before:-left-1.5 before:inset-y-1 before:w-[3px] " +
  "before:rounded-full before:bg-accent before:content-['']"
