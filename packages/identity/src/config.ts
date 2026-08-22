/**
 * Everything the operator said about identity, in one value.
 *
 * The header NAMES ({@link ./identity.ts}) and the avatar template
 * ({@link ./picture.ts}) are one config family — `OLAI_IDENTITY_*`, read
 * once at the composition root and handed down — but they are not the same
 * KIND of thing, which is why they are two files and this is the third: a
 * name is what to read off a request, a template is what to do with what
 * was read. A door that took the pieces separately would make every caller
 * re-assemble the family, and one of them would forget a rung.
 */

import {
  DEFAULT_IDENTITY_HEADERS,
  identityHeaders,
  type IdentityHeaders,
} from "./identity.ts"
import { avatarTemplate } from "./picture.ts"

export interface IdentityConfig {
  /** Which headers this server trusts for who is looking. */
  readonly headers: IdentityHeaders
  /** The avatar URL template, or `null` — the ladder's second rung.
   *  A TEMPLATE, not a URL: `{login}` is where the login goes. */
  readonly avatarTemplate: string | null
}

/** What an unconfigured olai behind `tailscale serve` reads: Tailscale's
 *  own header names, and no template. */
export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = {
  headers: DEFAULT_IDENTITY_HEADERS,
  avatarTemplate: null,
}

/** What this process was started with. Read on demand, not at import, so
 *  what a process was started with is what it serves. */
export const identityConfig = (): IdentityConfig => ({
  headers: identityHeaders(),
  avatarTemplate: avatarTemplate(),
})
