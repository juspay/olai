/** Decode the branded MCP fallback for adapters that retain text alone.
 * SDK envelope extraction stays in each engine leg. The server's MCP tests
 * round-trip real formatter output here, so a pin bump cannot silently drift. */
export const refusalIn = (text: string): { kind: string; reason: string } | undefined => {
  const refusal = /^surface-mcp: `[^`]+` was refused \((usage|not-found|validation|busy)\): ([\s\S]+)$/.exec(text)
  return refusal ? { kind: refusal[1]!, reason: refusal[2]! } : undefined
}
