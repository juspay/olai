import type { Owed } from "@olai/format"

export const remind = (day: string, owed: Owed | undefined, said: string | null, on: boolean): boolean =>
  on && day !== "" && said !== day && owed !== undefined && owed.overdue + owed.today > 0
