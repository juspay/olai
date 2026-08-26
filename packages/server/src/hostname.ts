/**
 * Which MACHINE this server says it is running on — the name the app puts
 * after the word "olai" in its tab, its header and its install manifest
 * (`@olai/surface`'s `appName`).
 *
 * One receptacle, the pattern `allowedOrigins.ts` sets: the variable is
 * read here and here alone because a decision spelled at its use site is
 * one nobody can find. `OLAI_HOSTNAME` wins when set, the OS otherwise —
 * and the env is not a knob a person tunes so much as the harness's pin:
 * the e2e suite sets it to a fixed string, so the name landing on a tab is
 * checkable against a known value rather than against whatever container
 * the run happened in (`the_app_is_named.feature`).
 *
 * Read on demand rather than at import, so what a process was started with
 * is what it serves — and a test that sets the variable sees it without an
 * import-order dance. The function reads FRESH, and the composition root
 * reads it exactly once per serve (`serve.ts`): two doors answer with the
 * word — the manifest, composed where it is served (`listener.ts`), and
 * `app.get`, asked per connection (`runtime.ts`) — and a hostname that
 * moved under a running server would drift them into two words for the one
 * deployment. The mint being the root's is what makes the two one.
 */

import * as os from "node:os"

const HOSTNAME_ENV_VAR = "OLAI_HOSTNAME"

/** The configured name, or the machine's own. Empty means unset — a
 *  whitespace-only `OLAI_HOSTNAME` is nobody's tuned value. */
export const hostname = (): string => {
  const asked = process.env[HOSTNAME_ENV_VAR]?.trim()
  return asked === undefined || asked === "" ? os.hostname() : asked
}
