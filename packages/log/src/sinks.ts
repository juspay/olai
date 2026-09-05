/**
 * Effect v4 logging: compact terminal presentation, unchanged logfmt for machines.
 * The destination stream controls format and colour at emit time. Both sinks
 * retain tracerLogger so events also reach any configured tracing backend.
 */
import { Formatter, type Layer, Logger } from "effect"

/** Stream shape we need for the TTY check — Node's stdout/stderr, or a stub. */
export type Stream = { readonly isTTY?: boolean }

/** Latch for the once-per-process invalid-`OLAI_LOG` diagnostic. */
let warnedInvalidOlaiLog = false

/**
 * Clears the invalid-`OLAI_LOG` latch so a test can assert the one-line-once
 * diagnostic without depending on suite order.
 */
export const resetInvalidOlaiLogWarning = (): void => {
  warnedInvalidOlaiLog = false
}

/**
 * Which face a line gets. `OLAI_LOG=logfmt|pretty` wins; otherwise a TTY is
 * pretty and everything else (pipe, systemd, tests) is logfmt. An unrecognised
 * value is ignored (with one diagnostic) rather than treated as a third face.
 */
export const formatFor = (stream: Stream): "pretty" | "logfmt" => {
  const forced = process.env["OLAI_LOG"]
  if (forced === "pretty" || forced === "logfmt") return forced
  if (forced !== undefined && forced !== "" && !warnedInvalidOlaiLog) {
    warnedInvalidOlaiLog = true
    // One line, once: a typo in the documented knob would otherwise look like
    // "it works" while silently following the TTY.
    console.error(
      `@olai/log: ignoring OLAI_LOG=${JSON.stringify(forced)}; expected "logfmt" or "pretty"`,
    )
  }
  return stream.isTTY === true ? "pretty" : "logfmt"
}

/**
 * Whether pretty output should carry ANSI. Follows the destination stream —
 * not stdout — and the [NO_COLOR](https://no-color.org/) convention (set and
 * non-empty disables). Effect's default looks only at stdout at construction,
 * which is the wrong stream for `toStderr`.
 */
export const colorsFor = (stream: Stream): boolean => {
  const noColor = process.env["NO_COLOR"]
  if (noColor !== undefined && noColor !== "") return false
  return stream.isTTY === true
}

/** Keep routine events on one physical line, including multiline annotations. */
const inline = (value: unknown): string => {
  const text = typeof value === "string" ? value : Formatter.format(value)
  return /[\s=\x00-\x1f\x7f]/.test(text) ? JSON.stringify(text) : text
}

/**
 * Only presentation is ours: Effect serializes messages, annotations and causes.
 * Remember the last displayed root, per sink, so a directory switch remains
 * visible without repeating the same path on every event. Errors always name it.
 */
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

/** Exported for testing the destination stream's colour policy. */
export const prettyFor = (stream: Stream): Logger.Logger<unknown, void> =>
  Logger.withConsoleLog(prettyFormat(stream))

const adaptive = (
  stream: Stream,
  pretty: Logger.Logger<unknown, void>,
  logfmt: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((options) => {
    ;(formatFor(stream) === "pretty" ? pretty : logfmt).log(options)
  })

/** Logs on stdout — olai web, and the default for anything else. */
export const toStdout: Layer.Layer<never> = Logger.layer([
  adaptive(process.stdout, prettyFor(process.stdout), Logger.consoleLogFmt),
  Logger.tracerLogger,
])

/** Logs on stderr for a transport that owns stdout; routing is sink-local. */
export const toStderr: Layer.Layer<never> = Logger.layer([
  adaptive(
    process.stderr,
    Logger.withConsoleError(prettyFormat(process.stderr)),
    Logger.withConsoleError(Logger.formatLogFmt),
  ),
  Logger.tracerLogger,
])
