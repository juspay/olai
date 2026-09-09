/** Normalized schema defaults shared by identity readers and tests. */
import { Schema } from "effect"
import { Config, configuredIdentity, type IdentityConfig } from "../settings.ts"
export type { IdentityConfig } from "../settings.ts"
export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = configuredIdentity(Schema.decodeUnknownSync(Config)({}))
