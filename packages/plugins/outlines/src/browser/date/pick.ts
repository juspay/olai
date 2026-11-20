import { canonicalDate, dayOf, offsetIn, stampOf, timeOf } from "@olai/format"

import { type Press, pressOf as panelPress } from "../edit/panel.ts"
import type { Edit } from "@olai/surface"

export interface Chosen {
  readonly day: string
  readonly time: string
}

export type InstantAt = (day: string, time: string) => string

export const browserInstantAt: InstantAt = (day, time) => {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  const [hours, minutes] = time.split(":").map(Number) as [number, number]
  const at = new Date(2000, 0, 1)
  at.setFullYear(year, month - 1, date)
  at.setHours(hours, minutes, 0, 0)
  return stampOf(at)
}

export const startsAt = (stored: string | undefined): Chosen =>
  stored === undefined
    ? { day: "", time: "" }
    : { day: dayOf(stored), time: timeOf(stored) ?? "" }

export const valueOf = (
  stored: string | undefined,
  chosen: Chosen,
  instantAt: InstantAt,
): string => {
  if (chosen.day === "") return ""
  if (chosen.time === "") return chosen.day
  if (stored !== undefined && dayOf(stored) === chosen.day && timeOf(stored) === chosen.time) {
    return stored
  }
  return instantAt(chosen.day, chosen.time)
}

export const datePick = (id: string, value: string): Edit => ({
  verb: "date",
  id,
  date: value === "" ? null : value,
})

export const pressOf = (stored: string | undefined, value: string | null): Press =>
  value === null
    ? { label: "Set date", writes: false }
    : stored !== undefined && timeOf(stored) !== undefined && value === dayOf(stored)
    ? { label: "Clear time", writes: true }
    : panelPress(stored, value, { set: "Set date", clear: "Clear date" })

export const noticeOf = (
  stored: string | undefined,
  chosen: Chosen,
  value: string,
  instantAt: InstantAt,
): string | undefined => {
  const written = value !== stored && timeOf(value) !== undefined ? value : undefined
  const storedTime = stored === undefined ? undefined : timeOf(stored)
  const foreign = stored !== undefined && storedTime !== undefined &&
    offsetIn(canonicalDate(stored, null) ?? "") !== offsetIn(instantAt(dayOf(stored), storedTime))
  const quoted = foreign ? `Scheduled for ${stored}. ` : ""
  if (written !== undefined && (dayOf(written) !== chosen.day || timeOf(written) !== chosen.time)) {
    return `${quoted}There is no ${chosen.time} on ${chosen.day} in your time zone, so this saves ${written}.`
  }
  if (!foreign) return undefined
  if (written !== undefined) return `${quoted}This saves ${written}, in your time zone.`
  return value === stored
    ? `${quoted}A new day or time is saved in your time zone.`
    : undefined
}
