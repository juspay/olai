/** Test ids drawn by the journal's browser half. Values stay unchanged across
 * the ownership move so existing scenarios remain the contract. */
export const TESTID = {
  calendar: "calendar",
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
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]
