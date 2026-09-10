/**
 * The count badge's SHAPE and its two paints — the date badge's pill, sized
 * for a 13px row of the directory column.
 *
 * Agenda's mark table (`../agenda/owed.ts`) and the Inbox door both wear
 * this, which is the ruling: the count beside Inbox is the same unit the
 * count beside Agenda is, not a lookalike. Paint is the face's; where the
 * chip sits on the row is the consumer's (`./CountChip.tsx`).
 *
 * TWO PAINTS, and they are the date badge's own two faces (`../DateBadge.tsx`):
 * the loud one is the alarm turned all the way up (a filled chip), the quiet
 * one is the badge's muted pill. Inbox always wears the quiet one — captures
 * waiting are news, not late work.
 */

/** The chip's box. Paint is layered on by the face. Not exported: the two
 *  paints below are the unit; a third consumer spelling its own chip from
 *  the shape would be the lookalike this file exists to prevent. */
const CHIP = "rounded-full px-1.5 text-xs leading-5 tabular-nums"

/** Late work: paper on alarm, the palette's own checked contrast pair. */
export const CHIP_ALARM = `${CHIP} bg-alarm font-semibold text-paper`

/** A nudge, and Inbox's count: the date badge's quiet face, untouched. */
export const CHIP_QUIET = `${CHIP} bg-pill text-muted`
