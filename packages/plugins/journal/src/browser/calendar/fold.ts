import { boolCodec, createPreference } from "@olai/web/client/preference.ts"

export const CALENDAR_OPEN_KEY = "olai.sidebar.calendar"

const preference = createPreference(CALENDAR_OPEN_KEY, boolCodec(false))

export const calendarOpen = preference.value
export const setCalendarOpen = (open: boolean): void => preference.set(open)
export const followCalendar = preference.follow
