/**
 * How olai says what it is doing.
 *
 * Three things, and no logger of its own: the LEVELS and the verbs are
 * Effect's (`Effect.logDebug`, `Effect.logInfo`, `Effect.logWarning`,
 * `Effect.logError`), so a package that wants to say something imports nothing
 * from here at all. What this package owns is what a logging seam is otherwise
 * re-decided at — the format and the stream ({@link ./sinks.ts}), how a
 * rejection is rendered ({@link ./cause.ts}), how a plain Node callback
 * emits a line without losing the fiber's settings ({@link ./emit.ts}), and
 * the instance's minimum level ({@link ./level.ts}).
 *
 * The serve supplies the face and how quiet it is. The verbs stay
 * Effect's. The level is a fact of the running process, read at the one env
 * edge, default `info`.
 */

export { codeOf, prettyCause, reasonOf } from "./cause.ts"
export { type Emit, emitter } from "./emit.ts"
export { liveLevel } from "./level.ts"
export { toStderr, toStdout } from "./sinks.ts"
