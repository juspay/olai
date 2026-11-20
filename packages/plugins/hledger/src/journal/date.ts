const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const daysIn = (year: number, month: number): number =>
  month === 2
    ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    : (MONTH_DAYS[month - 1] as number)

export const DATE_SHAPE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/

export const iso = (written: string): string | null => {
  const parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(written)
  if (parts === null) return null
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null
  return `${parts[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export const endsAt = (text: string, at: number): boolean => at >= text.length || /\s/.test(text.charAt(at))
