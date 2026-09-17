/** Calendar validity shared by schema meanings and storage codecs. */
export const isIsoInstant = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/
    .exec(value)
  if (match === null) return false
  const [, year, month, day] = match as unknown as [string, string, string, string]
  const utc = new Date(`${year}-${month}-${day}T00:00:00Z`)
  return (
    !Number.isNaN(utc.getTime()) &&
    utc.getUTCMonth() + 1 === Number(month) &&
    utc.getUTCDate() === Number(day)
  )
}
