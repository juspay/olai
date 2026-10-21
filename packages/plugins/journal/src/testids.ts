/** Test ids drawn by the journal's browser half. Values stay unchanged across
 * the ownership move so existing scenarios remain the contract. */
export const TESTID = {
  calendar: "calendar",
  calendarRow: "calendar-row",
  calendarToday: "calendar-today",
  calendarTodayDate: "calendar-today-date",
  calendarToggle: "calendar-toggle",
  calendarDay: "calendar-day",
  calendarPrev: "calendar-prev",
  calendarNext: "calendar-next",
  dayPage: "day-page",
  dayMint: "day-mint",
  dayMintSaid: "day-mint-said",
  dayGroup: "day-group",
  dayNote: "day-note",
  dayNoteLink: "day-note-link",
  dayEmpty: "day-empty",
  agendaPage: "agenda-page",
  agendaSpine: "agenda-spine",
  agendaDay: "agenda-day",
  agendaQuiet: "agenda-quiet",
  agendaEmpty: "agenda-empty",
  agendaLink: "agenda-link",
  agendaOwed: "agenda-owed",
  agendaCount: "agenda-count",
  railAgenda: "rail-agenda",
  railCalendar: "rail-calendar",
  /** The phone's thumb bar doors: today's page, and the agenda with its owed
   *  count (`data-owed` is the mark's face, as the sidebar entry's is). */
  thumbToday: "thumb-today",
  thumbAgenda: "thumb-agenda",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/journal": OwnedTestIds }
}
