/** The first nonempty reading of this local day. Off does not spend a day;
 * no clock or no first frame means there is nothing to announce yet. */
import type { Owed } from "@olai/format"

export const remind = (day: string, owed: Owed | undefined, said: string | null, on: boolean): boolean =>
  on && day !== "" && said !== day && owed !== undefined && owed.overdue + owed.today > 0
