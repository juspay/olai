const said = new Set<string>()

export const grumble = (key: string, message: string, cause?: unknown): void => {
  if (said.has(key)) return
  said.add(key)
  if (cause === undefined) console.warn(message)
  else console.warn(message, cause)
}
