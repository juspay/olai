/**
 * WHETHER THE MONTH IS OPEN under the sidebar's `Today` row — a preference of
 * this browser, kept the way the sidebar's other folds are (`olai.sidebar.*`,
 * `@olai/web`'s `createPreference`): remembered across reloads, followed
 * across this browser's tabs, and never sent anywhere.
 *
 * SHUT BY DEFAULT. The month used to be always open, drawn as a bright card on
 * the dark column — the loudest thing on screen for a question most visits do
 * not ask. One row says what day it is and goes there; the chevron opens the
 * grid for the reader who wants to walk the month.
 *
 * The journal's activation follows the stored value for as long as it stands
 * (`../../browser.tsx`); a reader's pick survives the row going and coming.
 */
import { boolCodec, createPreference } from "@olai/web/client/preference.ts"

export const CALENDAR_OPEN_KEY = "olai.sidebar.calendar"

const preference = createPreference(CALENDAR_OPEN_KEY, boolCodec(false))

export const calendarOpen = preference.value
export const setCalendarOpen = (open: boolean): void => preference.set(open)
export const followCalendar = preference.follow
