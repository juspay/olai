import { parseAllowedOrigins } from "@kolu/surface/ws-origin"

const ALLOWED_ORIGINS_ENV_VAR = "OLAI_ALLOWED_ORIGINS"

export const allowedOrigins = (): ReadonlyArray<string> =>
  parseAllowedOrigins(process.env[ALLOWED_ORIGINS_ENV_VAR])
