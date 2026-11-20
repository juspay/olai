import { isoDate } from "@olai/format"

export const whenOf = (at: string | null): string | null => {
  if (at === null) return null
  const stamped = Date.parse(at)
  if (!Number.isFinite(stamped)) return null
  const then = new Date(stamped)
  return `${isoDate(then.getFullYear(), then.getMonth() + 1, then.getDate())} ${two(then.getHours())}:${two(then.getMinutes())}`
}

const two = (value: number): string => String(value).padStart(2, "0")
