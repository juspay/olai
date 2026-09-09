/** Identity policy declaration. The environment adapter is retired when the
 * shared vault settings reader lands; no secret belongs in this schema. */
import { Effect, Schema } from "effect"
import { DEFAULT_LOGIN_HEADER, DEFAULT_NAME_HEADER, DEFAULT_PICTURE_HEADER } from "./who/identity.ts"
import type { IdentityHeaders } from "./who/identity.ts"

/** Normalized policy shared by input adapters and request readings. Its shape
 * does not depend on the temporary environment spelling. */
export interface IdentityConfig {
  /** Which headers this server trusts for who is looking. */
  readonly headers: IdentityHeaders
  /** The avatar URL template, or `null` — the ladder's second rung.
   *  A TEMPLATE, not a URL: `{login}` is where the login goes. */
  readonly avatarTemplate: string | null
}

export const Config = Schema.Struct({
  "login-header": Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_LOGIN_HEADER)),
    Schema.annotate({ description: "the trusted login header; blank uses the default" }),
  ),
  "email-header": Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("")),
    Schema.annotate({ description: "the email header; blank follows the login header" }),
  ),
  "name-header": Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_NAME_HEADER)),
    Schema.annotate({ description: "the display-name header; blank uses the login as the name" }),
  ),
  "picture-header": Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_PICTURE_HEADER)),
    Schema.annotate({ description: "the picture header; blank disables this avatar source" }),
  ),
  "avatar-template": Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("")),
    Schema.annotate({ description: "an avatar URL containing {login}; blank disables this avatar source" }),
  ),
})

export const configuredIdentity = (config: typeof Config.Type): IdentityConfig => {
  const login = config["login-header"].trim() || DEFAULT_LOGIN_HEADER
  return {
    headers: {
      login,
      email: config["email-header"].trim() || login,
      name: config["name-header"].trim() || null,
      picture: config["picture-header"].trim() || null,
    },
    avatarTemplate: config["avatar-template"].trim() || null,
  }
}
