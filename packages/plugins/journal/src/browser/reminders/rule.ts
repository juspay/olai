import type { Owed } from "@olai/format"

export const remind = (
  day: string | undefined,
  owed: Owed | undefined,
  said: string | null,
  on: boolean,
): day is string =>
  on && day !== undefined && said !== day && owed !== undefined && owed.overdue + owed.today > 0
