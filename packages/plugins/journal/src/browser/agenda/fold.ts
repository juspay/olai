import { boolCodec, createPreference } from "@olai/web/client/preference.ts"

export const AGENDA_ROWS_FOLDED_KEY = "olai.sidebar.agenda-rows"

const preference = createPreference(AGENDA_ROWS_FOLDED_KEY, boolCodec(false))

export const agendaRowsFolded = preference.value
export const setAgendaRowsFolded = (folded: boolean): void => preference.set(folded)
export const followAgendaRows = preference.follow
