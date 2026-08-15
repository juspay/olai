/**
 * How olai says what it is doing.
 *
 * Three things, and no logger of its own: the LEVELS and the verbs are
 * Effect's (`Effect.logDebug`, `Effect.logInfo`, `Effect.logWarning`,
 * `Effect.logError`), so a package that wants to say something imports nothing
 * from here at all. What this package owns is what a logging seam is otherwise
 * re-decided at — the format and the stream ({@link ./sinks.ts}), how a
 * rejection is rendered ({@link ./cause.ts}), and how a plain Node callback
 * emits a line without losing the fiber's settings ({@link ./emit.ts}).
 *
 * There is no level knob here either. `--log-level` is Effect's own CLI global
 * flag: it is already parsed, already in `--help`, and already sets the
 * minimum level for the command it runs. A second spelling would be a second
 * answer to one question.
 */

export { codeOf, prettyCause, reasonOf } from "./cause.ts"
export { type Emit, emitter } from "./emit.ts"
export { toStderr, toStdout } from "./sinks.ts"
