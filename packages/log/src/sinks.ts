/**
 * One format-or-pretty decision, two streams.
 *
 * **The machine format is [logfmt](https://brandur.org/logfmt)**, Effect's own
 * `formatLogFmt` rather than anything of ours: one line per event, every value
 * a `key=value` pair, quoted only when it has to be. It is what makes the
 * pieces this codebase asks for legible at the same time — the level, the log
 * spans a boot is timed with, and the annotations a line carries — without any
 * of them being interpolated into a sentence. A line is greppable by field
 * (`url=`, `root=`), a multi-line agent message stays ONE line (the value is
 * escaped, not wrapped), and there is no colour to strip: the e2e suite reads
 * the server's address off stdout, and an ANSI escape inside the value it is
 * matching is a bug nobody would look for.
 *
 * **Humans get a different face when nothing machine is reading.** When the
 * destination stream is a TTY, the sink writes Effect's `Logger.consolePretty`
 * — local time, coloured level, message first, key=values after. When the
 * stream is piped, under systemd, or in tests, the sink stays on logfmt
 * **byte-identical to what it always was**, because the `@olai/log` testlib
 * decoder and any agent parsing depend on that shape. Pretty may only exist
 * where no machine reads.
 *
 * Colour follows the *destination* stream, not stdout: Effect's
 * `consolePretty` defaults colour off `process.stdout.isTTY` at construction,
 * which is wrong for `olai mcp` (stdout is the protocol pipe; the human is on
 * stderr). {@link prettyFor} builds a pretty logger that re-reads colour from
 * its stream at emit time (and honours `NO_COLOR`), same discipline as
 * {@link formatFor}.
 *
 * `OLAI_LOG=logfmt|pretty` forces either face regardless of the TTY. The check
 * lives here, inside the sink layer, so `toStdout` / `toStderr` call sites do
 * not change and do not re-decide the format.
 *
 * Nothing here formats anything itself beyond picking which Effect logger
 * speaks. A bespoke renderer would be a fourth thing to keep consistent with
 * `store`'s probe warning, `ops`'s git warning and everything `server` says —
 * whereas every package in the tree already speaks `Effect.log*`, so they
 * arrive in one shape by construction.
 *
 * **The stream is the decision.** `olai web` logs to stdout, which is where a
 * person watching a server looks. `olai mcp` logs to STDERR, because on that
 * subcommand stdout is the protocol: a store's failed-probe warning written
 * there is a frame that is not a frame. That is a whole-program property rather
 * than one module's, which is why it is a layer the composition root provides
 * and not a rule every writer has to remember.
 *
 * `tracerLogger` rides along in both. It is the default set's other member, it
 * is a no-op with no tracer configured, and dropping it here would silently
 * stop log events attaching to spans the day one is.
 */

import { Context, type Layer, Logger } from "effect"

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

// The only two colour states consolePretty can take. Built once; picked at
// emit by {@link prettyFor} so colour stays emit-time without a fresh logger
// per line (agent-stderr debug can be chatty).
const prettyColored = Logger.consolePretty({ colors: true })
const prettyPlain = Logger.consolePretty({ colors: false })

/**
 * Pretty logger for `stream`, with colour re-read at **emit** time from that
 * stream (and `NO_COLOR`) — same discipline as {@link formatFor}. Binding
 * colour once at module load is what left `olai mcp` monochrome when stdout
 * was the protocol pipe.
 */
export const prettyFor = (stream: Stream): Logger.Logger<unknown, void> =>
  Logger.make((options) => {
    ;(colorsFor(stream) ? prettyColored : prettyPlain).log(options)
  })

/**
 * Pick pretty or logfmt at emit time so a test can flip `OLAI_LOG` without
 * re-importing the module, and so a process whose streams change (or that
 * never had a TTY) always answers the current fact.
 */
const adaptive = (
  stream: Stream,
  pretty: Logger.Logger<unknown, void>,
  logfmt: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((options) => {
    ;(formatFor(stream) === "pretty" ? pretty : logfmt).log(options)
  })

/**
 * Run `self` with `LogToStderr` true only for this logger call. `consolePretty`
 * reads that reference; providing it via `Layer.succeed` would force *every*
 * logger on the fiber (including ones later merged with `mergeWithExisting`)
 * onto stderr. Setting it on the fiber context for the duration of our own
 * `.log` keeps the routing local to this sink's pretty face.
 */
const withLogToStderr = (
  self: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((options) => {
    const { fiber } = options
    const prev = fiber.context
    fiber.setContext(Context.add(prev, Logger.LogToStderr, true))
    try {
      self.log(options)
    } finally {
      fiber.setContext(prev)
    }
  })

// One pretty logger per destination stream. Colour is chosen at emit via
// prettyFor(stream) — not from a shared consolePretty() keyed off stdout.
const prettyStdout = prettyFor(process.stdout)
const prettyStderr = withLogToStderr(prettyFor(process.stderr))
const logfmtStdout = Logger.consoleLogFmt
const logfmtStderr = Logger.withConsoleError(Logger.formatLogFmt)

/** Logs on stdout — `olai web`, and the default for anything else. */
export const toStdout: Layer.Layer<never> = Logger.layer([
  adaptive(process.stdout, prettyStdout, logfmtStdout),
  Logger.tracerLogger,
])

/**
 * Logs on stderr, for a transport that owns stdout.
 *
 * Pretty is wrapped so only this logger sees `LogToStderr` (see
 * {@link withLogToStderr}); logfmt uses `withConsoleError` so the non-pretty
 * path stays the same one-line write it always was. No program-wide
 * `LogToStderr` layer.
 */
export const toStderr: Layer.Layer<never> = Logger.layer([
  adaptive(process.stderr, prettyStderr, logfmtStderr),
  Logger.tracerLogger,
])
