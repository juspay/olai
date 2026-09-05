/** Optional node-process lifetime. Absence preserves the scheduler's default. */
export const idleMillis = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined
  const milliseconds = Number(value)
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(milliseconds)
    || milliseconds <= 0 || milliseconds > 2147483647) {
    throw new Error("OLAI_CHAT_IDLE_MS must be an integer from 1 to 2147483647 milliseconds")
  }
  return milliseconds
}
