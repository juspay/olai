/**
 * Who this request is, as a value.
 *
 * The person ({@link ./identity.ts}), their picture ({@link ./picture.ts},
 * over {@link ./gravatar.ts}) and what the operator configured
 * ({@link ./config.ts}) are four folds. HTTP is not here: `GET /olai/who`
 * is `@olai/server`'s door over {@link identityOf}, and the path lives in
 * `@olai/surface` the way `/media` does.
 *
 * WHAT CROSSES THE PACKAGE BOUNDARY, and no more. The environment variable
 * names, the placeholder a template spells the login as, and the email
 * guard are this package's own vocabulary: they are read HERE, once, into
 * {@link identityConfig}, and a second package reaching for one of them
 * would be a second place that decides how a deployment is wired. Each is
 * exported from its own module for the tests that pin it.
 */

export {
  DEFAULT_IDENTITY_CONFIG,
  identityConfig,
  type IdentityConfig,
} from "./config.ts"
export {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  identityOf,
  type Identity,
  type IdentityHeaders,
} from "./identity.ts"
export { gravatarOf } from "./gravatar.ts"
export { pictureOf } from "./picture.ts"
