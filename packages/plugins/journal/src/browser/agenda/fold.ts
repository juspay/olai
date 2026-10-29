/**
 * WHETHER THE OWED ROWS ARE FOLDED AWAY under the sidebar's `Agenda` row — a
 * preference of this browser, kept the way the month under `Today` is
 * (`../calendar/fold.ts`, `olai.sidebar.*`, `@olai/web`'s `createPreference`):
 * remembered across reloads, followed across this browser's tabs, and never
 * sent anywhere.
 *
 * UNFOLDED BY DEFAULT, which is the way round the month's preference is not:
 * the month is a question most visits do not ask, and the owed rows are the
 * reason the door is on fire. A reader who wants the column quiet folds them
 * and the choice stays folded.
 *
 * FOLDING IS A DRAWING DECISION AND NOT A SUBSCRIPTION: the held `owed` stream
 * keeps running while the list is shut, which is what keeps the count on the
 * door live (`../../browser/owed.ts`).
 *
 * The journal's activation follows the stored value for as long as it stands
 * (`../../browser.tsx`).
 */
import { boolCodec, createPreference } from "@olai/web/client/preference.ts"

export const AGENDA_ROWS_FOLDED_KEY = "olai.sidebar.agenda-rows"

/** The preference NAMES the folded state, and its default is "not folded" —
 *  one boolean, so a reader who never presses the chevron gets the list. */
const preference = createPreference(AGENDA_ROWS_FOLDED_KEY, boolCodec(false))

export const agendaRowsFolded = preference.value
export const setAgendaRowsFolded = (folded: boolean): void => preference.set(folded)
export const followAgendaRows = preference.follow
