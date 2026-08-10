/**
 * What was logged, for a test to assert on — in the two places a test can be
 * standing.
 *
 * INSIDE the process, a test that used to read an injected
 * `log: (message) => void` now has to hear an Effect log line, and there is
 * exactly one way to do that: a `Logger` in the layer ({@link collector}). It
 * collects the PIECES rather than a rendered line, because a test asserting on
 * the level, the message and the annotations separately is a test that says
 * what it means; one matching a substring of logfmt would be a test of
 * {@link ./sinks.ts} wearing a different hat, and would fail on any change to a
 * format it does not care about.
 *
 * OUTSIDE it — the suites that spawn the real binary and read its stdout —
 * there is no layer to install, so the only thing to read is the format. That
 * makes the decoder the other half of a contract this package already owns the
 * encoder for ({@link readLogfmt}), and it lives here for the reason every
 * encode/decode pair does: three call sites had each written their own regex
 * against the same format, already disagreeing about how strict to be, and all
 * three would have silently stopped matching the day a value needed quoting.
 */

import { Layer, Logger, References } from "effect"

/** One log line, in the pieces it was logged in. */
export interface Logged {
  readonly level: string
  /** Joined, because a line may be logged with several message arguments and a
   *  test almost always wants to know whether a phrase is in there. */
  readonly message: string
  readonly annotations: Readonly<Record<string, unknown>>
}

/** A logger layer, plus the array it fills. Read it after the effect has run —
 *  or after whatever tick the line is emitted on, if it came from a callback. */
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

/** The first line whose message contains `phrase`. Tests read by phrase because
 *  the message is the one part of a line that is meant to be stable. */
export const findSaid = (
  said: ReadonlyArray<Logged>,
  phrase: string,
): Logged | undefined => said.find((line) => line.message.includes(phrase))

/** One `key=value` or `key="quoted value"`, anchored so a value containing an
 *  `=` cannot be read as a second pair. Escapes inside a quoted value are the
 *  encoder's (`\"`, `\\`), so the pattern has to know about them too. */
const PAIR = /([^\s="]+)=(?:"((?:[^"\\]|\\.)*)"|([^\s"]*))/g

/** A logfmt line, as its fields. Repeated keys keep the LAST — a line may carry
 *  more than one `message=` when something was logged with several arguments,
 *  and the annotations that a test reads come after them either way. */
export const readLogfmt = (line: string): Readonly<Record<string, string>> => {
  const fields: Record<string, string> = {}
  for (const [, key, quoted, bare] of line.matchAll(PAIR)) {
    fields[key as string] = quoted === undefined
      ? bare ?? ""
      : quoted.replace(/\\(.)/g, "$1")
  }
  return fields
}

/**
 * The first line in `text` whose `message` is exactly `message`, as its fields.
 *
 * `text` is a whole stdout buffer, possibly mid-line: a spawned server's output
 * arrives in chunks, and a test polls it until what it is waiting for is there.
 * A partial last line simply does not match yet.
 *
 * EXACT rather than a substring, unlike {@link findSaid}: out here the message
 * is the only thing distinguishing one line from another, and two of this
 * server's lines carry a `url=` field.
 */
export const findLogfmt = (
  text: string,
  message: string,
): Readonly<Record<string, string>> | undefined => {
  for (const line of text.split("\n")) {
    const fields = readLogfmt(line)
    if (fields.message === message) return fields
  }
  return undefined
}
