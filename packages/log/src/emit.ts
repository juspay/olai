/**
 * Logging from a callback, without leaving the fiber's settings behind.
 *
 * `Effect.logInfo` is an Effect, and that is what makes the interesting parts
 * work: the minimum level the operator asked for with the live minimum level, the
 * annotations the enclosing scope set, the spans a boot is being timed with —
 * all of them are read off the RUNNING FIBER when the line is emitted.
 *
 * But half of what this server has to say happens in a Node callback: a
 * websocket that hung up, a promise the surface runtime rejected, a subprocess
 * writing to its stderr. There is no fiber there. Running the line with
 * `Effect.runFork` would emit it against the defaults instead — which means an
 * the live debug level the operator selected would silently not apply to exactly
 * the noisiest half of the program, and no annotation would ever survive.
 *
 * So: capture the fiber's services ONCE, where there is a fiber, and run every
 * later line under them. What that costs is a fiber per line; what it buys is
 * that a callback's line and an Effect's line are the same line.
 *
 * The capture reads the annotations in force AT THE POINT `emitter` is
 * yielded, so annotate first and take the emitter after:
 *
 * ```ts
 * const say = yield* Effect.annotateLogs(emitter, { agent: command })
 * child.stderr.on("data", (chunk) => say(Effect.logDebug(chunk.trimEnd())))
 * ```
 */

import { Effect, type Context, type Fiber } from "effect"

/** Emit one log line from outside Effect. Returns nothing and fails at
 *  nothing: a logger that could refuse would need a caller that could care,
 *  and these callers are event handlers. */
export type Emit = (line: Effect.Effect<void>) => void

/** Every line runs under these services: their loggers, level and
 *  annotations. */
const under = (services: Context.Context<never>): Emit => {
  const run = Effect.runForkWith(services)
  return (line) => {
    run(line)
  }
}

/** The emitter for the fiber that yields it. */
export const emitter: Effect.Effect<Emit> = Effect.map(Effect.context<never>(), under)

/** The emitter for a fiber somebody else handed us — an Effect callback that
 *  is given the fiber it runs for (an `ErrorReporter`, say) rather than
 *  running in it. The same capture {@link emitter} makes for its own fiber. */
export const emitterOf = (fiber: Fiber.Fiber<unknown, unknown>): Emit => under(fiber.context)
