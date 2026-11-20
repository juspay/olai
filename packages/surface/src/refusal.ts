export const refusalIn = (text: string): { kind: string; reason: string } | undefined => {
  const refusal = /^surface-mcp: `[^`]+` was refused \((usage|not-found|validation|busy)\): ([\s\S]+)$/.exec(text)
  return refusal ? { kind: refusal[1]!, reason: refusal[2]! } : undefined
}
