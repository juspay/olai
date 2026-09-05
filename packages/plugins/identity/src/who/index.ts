/**
 * THE READING — who a request is, as a value.
 *
 * The person ({@link ./identity.ts}), their picture ({@link ./picture.ts},
 * over {@link ./gravatar.ts}), what the operator wired ({@link ./config.ts})
 * and the one function that is all three at once ({@link ./reading.ts})
 * are five folds and no HTTP. What the row does with them is
 * `../server.ts`: `whoOf` becomes the `Identity` door core reads at the
 * upgrade, at `GET /olai/who` and at `/mcp`.
 *
 * ## Why this is a door of its own, rather than `../server.ts`'s inside
 *
 * Because two processes that are not a serve read it. The e2e suite states
 * a deployment's header names and hashes the gravatar it expects to see
 * drawn, and it must read those from the code rather than re-typing them
 * (`packages/tests/step_definitions/identity_steps.ts`); a door onto the
 * row's `apply` would drag the plugin runtime into a cucumber process for
 * two constants. Nothing in here is an Effect, imports the plugin API's
 * runtime or touches `process.env`.
 *
 * WHAT CROSSES THE DOOR, and no more. The environment variable names, the
 * placeholder a template spells the login as, and the email guard are this
 * row's own vocabulary: they are read HERE, once, into
 * {@link identityConfig}, and a second package reaching for one of them
 * would be a second place that decides how a deployment is wired. Each is
 * exported from its own module for the tests that pin it.
 */

export {
  DEFAULT_IDENTITY_CONFIG,
  identityConfig,
  type IdentityConfig,
  type Vars,
} from "./config.ts"
export {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  headerNamesOf,
  identityOf,
  type Identity,
  type IdentityHeaders,
} from "./identity.ts"
export { gravatarOf } from "./gravatar.ts"
export { pictureOf } from "./picture.ts"
export { shown, whoOf } from "./reading.ts"
