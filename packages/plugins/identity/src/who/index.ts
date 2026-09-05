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
 * WHAT CROSSES THE DOOR, and no more — five names, each with a caller.
 * The environment variable names, the placeholder a template spells the
 * login as, the email guard, the parse and the ladder are this row's own
 * vocabulary: they are read HERE, once, into {@link identityConfig} and
 * {@link whoOf}, and a second package reaching for one of them would be a
 * second place that decides how a deployment is wired.
 *
 * It listed eleven when it was `@olai/identity`'s root, and that was right
 * for a general leaf whose whole job was to be imported. A row's door is
 * the other shape: this one is `olai-plugin-chat/binding`'s discipline one
 * package over — what crosses is what a named caller asks for, so a name
 * added here is a name somebody wanted rather than an internal that leaked.
 * The row's own tests reach the folds directly, next door.
 */

/** THE OPERATOR'S WIRING, and the reading over it — the two the row's own
 *  `../server.ts` needs to stand behind the `Identity` door, plus the
 *  allowlist the upgrade takes. */
export { identityConfig, type IdentityConfig } from "./config.ts"
export { headerNamesOf } from "./identity.ts"
export { whoOf } from "./reading.ts"
/** ...and the two a SUITE pins rather than re-types: the header a Given
 *  injects (`@olai/tests`) and the gravatar a Then expects to see drawn
 *  (`@olai/tests`, and `@olai/server`'s two-door test). A hash or a header
 *  name spelled twice is one that goes on passing after the first moved. */
export { DEFAULT_IDENTITY_HEADERS } from "./identity.ts"
export { gravatarOf } from "./gravatar.ts"
