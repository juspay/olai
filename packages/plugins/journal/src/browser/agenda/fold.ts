/**
 * WHETHER THE OWED ROWS ARE FOLDED AWAY under the sidebar's `Agenda` row — a
 * preference of this browser, kept the way the month under `Today` is
 * (`../calendar/fold.ts`, `olai.sidebar.*`, `@olai/web`'s `createPreference`):
 * remembered across reloads, followed across this browser's tabs, and never
 * sent anywhere.
 *
 * FOLDED BY DEFAULT, like the month: the red count on the door already says
 * that something is owed, and the Agenda page lists it. A reader who wants
 * the rows in the column unfolds them, and the choice stays unfolded.
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

/** The preference NAMES the folded state, and its default is "folded" — one
 *  boolean, so a reader who never presses the chevron gets the count alone. */
const preference = createPreference(AGENDA_ROWS_FOLDED_KEY, boolCodec(true))

export const agendaRowsFolded = preference.value
export const setAgendaRowsFolded = (folded: boolean): void => preference.set(folded)
export const followAgendaRows = preference.follow
