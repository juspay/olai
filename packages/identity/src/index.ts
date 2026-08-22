/**
 * Who this request is, as a value.
 *
 * The person ({@link ./identity.ts}) and their picture
 * ({@link ./gravatar.ts}) are two folds. HTTP is not here: `GET /olai/who`
 * is `@olai/server`'s door over {@link identityOf}, and the path lives in
 * `@olai/surface` the way `/media` does.
 */

export {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  EMAIL_ENV,
  identityHeaders,
  identityOf,
  LOGIN_ENV,
  type Identity,
  type IdentityHeaders,
} from "./identity.ts"
export { GENERIC_GRAVATAR, GRAVATAR_ORIGIN, gravatarOf } from "./gravatar.ts"
