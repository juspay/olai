import { Layer, Logger, References } from "effect"

export interface Logged {
  readonly level: string
  readonly message: string
  readonly annotations: Readonly<Record<string, unknown>>
}

export const collector = (): {
  readonly layer: Layer.Layer<never>
  readonly said: ReadonlyArray<Logged>
} => {
  const said: Array<Logged> = []
  const logger = Logger.make<unknown, void>(({ fiber, logLevel, message }) => {
    said.push({
      level: logLevel,
      message: (Array.isArray(message) ? message : [message]).map(String).join(" "),
      annotations: { ...fiber.getRef(References.CurrentLogAnnotations) },
    })
  })
  return { layer: Logger.layer([logger]), said }
}

export const findSaid = (
  said: ReadonlyArray<Logged>,
  phrase: string,
): Logged | undefined => said.find((line) => line.message.includes(phrase))

export const readLogfmt = (line: string): Readonly<Record<string, string>> => {
  const fields: Record<string, string> = {}
  const end = line.length
  let at = 0

  while (at < end) {
    if (line[at] === " ") {
      at += 1
      continue
    }

    const key = at
    while (at < end && line[at] !== "=" && line[at] !== " ") at += 1
    if (line[at] !== "=") continue
    const name = line.slice(key, at)
    at += 1

    if (line[at] !== `"`) {
      const bare = at
      while (at < end && line[at] !== " ") at += 1
      fields[name] = line.slice(bare, at)
      continue
    }

    at += 1
    let value = ""
    while (at < end && line[at] !== `"`) {
      if (line[at] === "\\" && at + 1 < end) at += 1
      value += line[at]
      at += 1
    }
    if (at >= end) return fields
    at += 1
    fields[name] = value
  }

  return fields
}

export const findLogfmt = (
  text: string,
  message: string,
): Readonly<Record<string, string>> | undefined => {
  const parts = text.split("\n")
  const complete = text.endsWith("\n") ? parts : parts.slice(0, -1)
  for (const line of complete) {
    if (line === "") continue
    const fields = readLogfmt(line)
    if (fields.message === message) return fields
  }
  return undefined
}
