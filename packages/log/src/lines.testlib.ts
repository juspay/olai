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

/**
 * A logfmt line, as its fields. Repeated keys keep the LAST — a line may carry
 * more than one `message=` when something was logged with several arguments,
 * and the annotations a test reads come after them either way.
 *
 * A scan rather than a regex, and that is not taste. `key=value` where the key
 * runs up to an `=` is the shape a backtracking engine is worst at: every
 * position in a long run of key-ish characters is a start the engine tries and
 * abandons, which is quadratic in the line's length — and these lines carry
 * whatever an agent wrote to its stderr. One pass, one character at a time, is
 * linear and is also the only version of this that can be read straight
 * through.
 */
export const readLogfmt = (line: string): Readonly<Record<string, string>> => {
  const fields: Record<string, string> = {}
  const end = line.length
  let at = 0

  while (at < end) {
    if (line[at] === " ") {
      at += 1
      continue
    }

    // The key, up to its `=`. A run with no `=` in it is not a pair — the
    // timestamp's own value, say, once a quoted one has been consumed — and
    // the outer loop simply moves past it.
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

    // A quoted value: everything to the closing quote, with the encoder's
    // escapes taken back off. An unterminated one is a line that has not
    // finished arriving, and it ends the scan rather than inventing a field.
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

/**
 * The first line in `text` whose `message` is exactly `message`, as its fields.
 *
 * `text` is a whole stdout buffer, possibly mid-line: a spawned server's output
 * arrives in chunks, and a test waits on those chunks until the line is there.
 * Only a `\n`-terminated line is complete — a trailing fragment, even one
 * whose `message=` already looks right, has not finished arriving. A cut
 * inside a bare `url=` would otherwise match a truncated address.
 *
 * EXACT rather than a substring, unlike {@link findSaid}: out here the message
 * is the only thing distinguishing one line from another, and two of this
 * server's lines carry a `url=` field.
 */
export const findLogfmt = (
  text: string,
  message: string,
): Readonly<Record<string, string>> | undefined => {
  // `split("\n")` on `"a\nb\n"` yields `["a","b",""]`; on `"a\nb"` yields
  // `["a","b"]`. The last fragment is a finished line only when `text`
  // itself ended with a newline — otherwise more of it is still arriving.
  const parts = text.split("\n")
  const complete = text.endsWith("\n") ? parts : parts.slice(0, -1)
  for (const line of complete) {
    if (line === "") continue
    const fields = readLogfmt(line)
    if (fields.message === message) return fields
  }
  return undefined
}
