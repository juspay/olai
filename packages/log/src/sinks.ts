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

import { Layer, Logger } from "effect"

/** Stream shape we need for the TTY check — Node's stdout/stderr, or a stub. */
type Stream = { readonly isTTY?: boolean }

/**
 * Which face a line gets. `OLAI_LOG=logfmt|pretty` wins; otherwise a TTY is
 * pretty and everything else (pipe, systemd, tests) is logfmt.
 */
export const formatFor = (stream: Stream): "pretty" | "logfmt" => {
  const forced = process.env["OLAI_LOG"]
  if (forced === "pretty" || forced === "logfmt") return forced
  return stream.isTTY === true ? "pretty" : "logfmt"
}

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

const pretty = Logger.consolePretty()
const logfmtStdout = Logger.consoleLogFmt
const logfmtStderr = Logger.withConsoleError(Logger.formatLogFmt)

/** Logs on stdout — `olai web`, and the default for anything else. */
export const toStdout: Layer.Layer<never> = Logger.layer([
  adaptive(process.stdout, pretty, logfmtStdout),
  Logger.tracerLogger,
])

/**
 * Logs on stderr, for a transport that owns stdout.
 *
 * Pretty routes through Effect's `LogToStderr` reference (what
 * `consolePretty` reads); logfmt uses `withConsoleError` so the non-pretty
 * path stays the same one-line write it always was.
 */
export const toStderr: Layer.Layer<never> = Layer.merge(
  Logger.layer([
    adaptive(process.stderr, pretty, logfmtStderr),
    Logger.tracerLogger,
  ]),
  Layer.succeed(Logger.LogToStderr, true),
)
