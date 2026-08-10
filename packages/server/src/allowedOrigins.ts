/**
 * Which browsers may open the websocket, beyond the page's own origin.
 *
 * One receptacle: `OLAI_ALLOWED_ORIGINS`, comma-separated. Empty by default,
 * because loopback and same-origin is the whole of the common case — the extra
 * entries are for a front end whose browser origin is not the `Host` it
 * forwards: a reverse proxy, or `tailscale serve`.
 *
 * It is a gate against cross-site WebSocket hijacking, and it is checked on the
 * raw socket BEFORE the upgrade (`listener.ts`), because after it the browser
 * has a connection to argue about. The surface is unauthenticated, so the
 * origin is the only thing standing between a page somebody else served and
 * every outline in the served directory. That is exactly why the variable has
 * its own file with its own name in it rather than a `process.env` read inline
 * at the composition root: a security decision spelled at its use site is one
 * nobody can find, and `clientDist.ts` is the pattern.
 *
 * The parse is `@kolu/surface`'s own — the same function the gate reads it back
 * with, so there is one answer to "what is an origin here" rather than two.
 */

import { parseAllowedOrigins } from "@kolu/surface/ws-origin"

const ALLOWED_ORIGINS_ENV_VAR = "OLAI_ALLOWED_ORIGINS"

/** The configured origins, or none. Read on demand rather than at import, so
 *  what a process was started with is what it serves. */
export const allowedOrigins = (): ReadonlyArray<string> =>
  parseAllowedOrigins(process.env[ALLOWED_ORIGINS_ENV_VAR])
