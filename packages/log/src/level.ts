/**
 * The minimum level this process will emit — one knob, one env edge.
 *
 * `OLAI_LOG` already picks the FACE (logfmt vs pretty). The LEVEL used to be
 * Effect's CLI `--log-level` alone, which a systemd unit cannot raise without
 * rewriting argv, and which the 2026-08-22 silent-send journal never had a way
 * to turn on: six restarts, zero chat debug. `OLAI_LOG_LEVEL` is the instance
 * fact that fills that hole, the same kind of pin `--commit` is — read once,
 * for the running process, not per browser.
 *
 * Quiet stays the default (`info`), so a relayed agent stderr chunk — by
 * volume the loudest thing olai emits — is still off until asked for. The
 * verbs remain Effect's; this file only answers "how quiet".
 */

import { Layer, References } from "effect"

/** The variable, spelled once. */
export const LEVEL_ENV_VAR = "OLAI_LOG_LEVEL"

/** The four levels an operator is expected to type, matching Effect's names. */
export const LEVELS = ["debug", "info", "warn", "error"] as const

export type LevelName = (typeof LEVELS)[number]

/** Effect's own spelling of a minimum level — what {@link References.MinimumLogLevel} takes. */
export type Minimum = "Debug" | "Info" | "Warn" | "Error"

const NAMED: Readonly<Record<LevelName, Minimum>> = {
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
}

/** Latch for the once-per-process invalid-`OLAI_LOG_LEVEL` diagnostic. */
let warnedInvalidOlaiLogLevel = false

/**
 * Clears the invalid-`OLAI_LOG_LEVEL` latch so a test can assert the one-line-once
 * diagnostic without depending on suite order.
 */
export const resetInvalidOlaiLogLevelWarning = (): void => {
  warnedInvalidOlaiLogLevel = false
}

/**
 * The minimum level this process was started with. Unset and empty are `Info`.
 * An unrecognised value is ignored (with one diagnostic) rather than treated
 * as a fifth level.
 */
export const levelFor = (raw: string | undefined = process.env[LEVEL_ENV_VAR]): Minimum => {
  if (raw === undefined || raw === "") return "Info"
  const named = raw.toLowerCase() as LevelName
  const level = NAMED[named]
  if (level !== undefined) return level
  if (!warnedInvalidOlaiLogLevel) {
    warnedInvalidOlaiLogLevel = true
    console.error(
      `@olai/log: ignoring ${LEVEL_ENV_VAR}=${JSON.stringify(raw)}; expected ${
        LEVELS.map((name) => `"${name}"`).join(", ")
      }`,
    )
  }
  return "Info"
}

/**
 * Provide Effect's minimum level from {@link levelFor}, read when the layer is
 * built so a composition root that calls this at boot pins the env it was
 * started with.
 */
export const atLevel = (
  raw: string | undefined = process.env[LEVEL_ENV_VAR],
): Layer.Layer<never> => Layer.succeed(References.MinimumLogLevel, levelFor(raw))
