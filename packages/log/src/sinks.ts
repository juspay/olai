import { Context, Formatter, type Layer, Logger } from "effect"

export type Stream = { readonly isTTY?: boolean }

export type Presentation = "auto" | "logfmt" | "pretty"
export class LogPresentation extends Context.Reference<() => Presentation>("olai/log/presentation", {
  defaultValue: () => () => "auto",
}) {}

export const formatFor = (stream: Stream, format: Presentation = "auto"): "pretty" | "logfmt" =>
  format === "auto" ? (stream.isTTY === true ? "pretty" : "logfmt") : format

export const colorsFor = (stream: Stream): boolean => {
  const noColor = process.env["NO_COLOR"]
  if (noColor !== undefined && noColor !== "") return false
  return stream.isTTY === true
}

const inline = (value: unknown): string => {
  const text = typeof value === "string" ? value : Formatter.format(value)
  return /[\s=\x00-\x1f\x7f]/.test(text) ? JSON.stringify(text) : text
}

const prettyFormat = (stream: Stream) => {
  let lastRoot: unknown
  return Logger.map(Logger.formatStructured, (event) => {
    const color = colorsFor(stream)
    const paint = (code: number, text: string) => color ? `\x1b[${code}m${text}\x1b[0m` : text
    const time = new Date(event.timestamp).toTimeString().slice(0, 8)
    const level = event.level
    const trouble = level === "WARN" || level === "ERROR" || level === "FATAL"
    const fields = Object.entries(event.annotations).flatMap(([key, value]) => {
      if (value === undefined || value === null || value === "") return []
      if (key === "root") {
        if (value === lastRoot && !trouble && level !== "DEBUG" && level !== "TRACE") return []
        lastRoot = value
      }
      const shown = key === "session" && typeof value === "string"
        && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value.slice(0, 8) : value
      return [`${inline(key)}=${inline(shown)}`]
    })
    for (const [name, duration] of Object.entries(event.spans)) {
      fields.push(`${inline(name)}=${duration}ms`)
    }
    const messages = Array.isArray(event.message) ? event.message : [event.message]
    const message = messages.map(value => typeof value === "string"
      ? value.replace(/[\x00-\x1f\x7f]/g, c => JSON.stringify(c).slice(1, -1))
      : inline(value)).join(" ")
    const heading = `${paint(2, time)} ${paint(trouble ? (level === "WARN" ? 33 : 31) : 36, level.padEnd(5))} ${message}`
    const line = fields.length === 0 ? heading : `${heading} ${paint(2, fields.join(" "))}`
    return event.cause ? `${line}\n${event.cause.split("\n").map(line => `  ${line}`).join("\n")}` : line
  })
}

const prettyFor = (stream: Stream): Logger.Logger<unknown, void> =>
  Logger.withConsoleLog(prettyFormat(stream))

const adaptive = (
  stream: Stream,
  pretty: Logger.Logger<unknown, void>,
  logfmt: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((options) => {
    ;(formatFor(stream, options.fiber.getRef(LogPresentation)()) === "pretty" ? pretty : logfmt).log(options)
  })

export const toStdout: Layer.Layer<never> = Logger.layer([
  adaptive(process.stdout, prettyFor(process.stdout), Logger.consoleLogFmt),
  Logger.tracerLogger,
])

export const toStderr: Layer.Layer<never> = Logger.layer([
  adaptive(
    process.stderr,
    Logger.withConsoleError(prettyFormat(process.stderr)),
    Logger.withConsoleError(Logger.formatLogFmt),
  ),
  Logger.tracerLogger,
])
