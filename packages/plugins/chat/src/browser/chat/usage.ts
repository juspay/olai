export const usageOf = (
  usage: { readonly used: number; readonly size: number } | null,
): string | null => (usage === null ? null : `${tokensOf(usage.used)}/${tokensOf(usage.size)}`)

const tokensOf = (tokens: number): string => {
  if (tokens < 1_000) return String(tokens)
  const thousands = Math.round(tokens / 1_000)
  if (thousands < 1_000) return `${thousands}k`
  const millions = Math.round(tokens / 100_000) / 10
  return `${millions}M`
}
