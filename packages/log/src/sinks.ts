/**
 * One format, two streams.
 *
 * **The format is [logfmt](https://brandur.org/logfmt)**, Effect's own
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
 * Nothing here formats anything itself. A bespoke renderer would be a fourth
 * thing to keep consistent with `store`'s probe warning, `ops`'s git warning
 * and everything `server` says — whereas every package in the tree already
 * speaks `Effect.log*`, so they arrive in one shape by construction.
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

/** Logs on stdout — `olai web`, and the default for anything else. */
export const toStdout: Layer.Layer<never> = Logger.layer([
  Logger.consoleLogFmt,
  Logger.tracerLogger,
])

/** Logs on stderr, for a transport that owns stdout. */
export const toStderr: Layer.Layer<never> = Logger.layer([
  Logger.withConsoleError(Logger.formatLogFmt),
  Logger.tracerLogger,
])
