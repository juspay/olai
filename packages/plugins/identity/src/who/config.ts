/** Temporary environment adapter while the shared settings reader is staged.
 * Defaults and interpretation belong to the Config declaration. */
import { Schema } from "effect"
import { Config, configuredIdentity } from "../settings.ts"
import type { IdentityHeaders } from "./identity.ts"

/** The login header's name. Unset is {@link DEFAULT_LOGIN_HEADER}. */
export const LOGIN_ENV = "OLAI_IDENTITY_LOGIN_HEADER"
/** The email header's name. Unset is the login header — on the tailnets
 *  where the login IS an address, one name covers both; empty is no email
 *  claim, and then nothing is ever hashed into a gravatar. */
export const EMAIL_ENV = "OLAI_IDENTITY_EMAIL_HEADER"
/** The display-name header's name. Unset is {@link DEFAULT_NAME_HEADER};
 *  empty is no name, and then the login is what the chip says. */
export const NAME_ENV = "OLAI_IDENTITY_NAME_HEADER"
/** The picture header's name. Unset is {@link DEFAULT_PICTURE_HEADER};
 *  empty is no picture header, and the ladder starts a rung lower. */
export const PICTURE_ENV = "OLAI_IDENTITY_PICTURE_HEADER"
/** The avatar URL template — one URL with `{login}` in it
 *  ({@link LOGIN_PLACEHOLDER}). Unset or blank is no template. */
export const AVATAR_ENV = "OLAI_IDENTITY_AVATAR_TEMPLATE"

export interface IdentityConfig {
  /** Which headers this server trusts for who is looking. */
  readonly headers: IdentityHeaders
  /** The avatar URL template, or `null` — the ladder's second rung.
   *  A TEMPLATE, not a URL: `{login}` is where the login goes. */
  readonly avatarTemplate: string | null
}


export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = configuredIdentity(Schema.decodeUnknownSync(Config)({}))

export interface Vars {
  readonly [name: string]: string | undefined
}

/** Legacy input spelling, removed with the shared vault reader. */
export const identityConfig = (vars: Vars): IdentityConfig => {
  const config = configuredIdentity(Schema.decodeUnknownSync(Config)({
    ...(vars[LOGIN_ENV] === undefined ? {} : { "login-header": vars[LOGIN_ENV] }),
    ...(vars[EMAIL_ENV] === undefined ? {} : { "email-header": vars[EMAIL_ENV] }),
    ...(vars[NAME_ENV] === undefined ? {} : { "name-header": vars[NAME_ENV] }),
    ...(vars[PICTURE_ENV] === undefined ? {} : { "picture-header": vars[PICTURE_ENV] }),
    ...(vars[AVATAR_ENV] === undefined ? {} : { "avatar-template": vars[AVATAR_ENV] }),
  }))
  // Preserve the legacy environment spelling until this adapter is retired:
  // empty env disables the claim; the schema's blank property follows login.
  return vars[EMAIL_ENV] !== undefined && vars[EMAIL_ENV]!.trim() === ""
    ? { ...config, headers: { ...config.headers, email: null } }
    : config
}
