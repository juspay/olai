/**
 * Who this request is, as a value.
 *
 * The person ({@link ./identity.ts}), their picture ({@link ./picture.ts},
 * over {@link ./gravatar.ts}) and what the operator configured
 * ({@link ./config.ts}) are four folds. HTTP is not here: `GET /olai/who`
 * is `@olai/server`'s door over {@link identityOf}, and the path lives in
 * `@olai/surface` the way `/media` does.
 */

export {
  DEFAULT_IDENTITY_CONFIG,
  identityConfig,
  type IdentityConfig,
} from "./config.ts"
export {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  DEFAULT_NAME_HEADER,
  DEFAULT_PICTURE_HEADER,
  EMAIL_ENV,
  identityHeaders,
  identityOf,
  LOGIN_ENV,
  NAME_ENV,
  PICTURE_ENV,
  type Identity,
  type IdentityHeaders,
} from "./identity.ts"
export { GRAVATAR_ORIGIN, gravatarOf } from "./gravatar.ts"
export {
  AVATAR_ENV,
  avatarTemplate,
  LOGIN_PLACEHOLDER,
  looksLikeEmail,
  pictureOf,
} from "./picture.ts"
