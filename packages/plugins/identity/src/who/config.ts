/**
 * THE ENVIRONMENT EDGE: everything the operator said about identity, read
 * once, as one value.
 *
 * Nothing in this package touches `process.env` — this file is handed the
 * variables, and the row's `apply` is where they come from
 * (`@olai/plugin-api`'s `Env`, which is a composition root's one reach for
 * a real environment and a test's one place to state a fake one).
 * {@link ./identity.ts} is a parse over header names it is HANDED and
 * {@link ./picture.ts} is a ladder over a template it is HANDED — both pure
 * functions of their arguments, which is what lets a test state a
 * deployment instead of arranging one, and what stops "how this olai is
 * wired" from being answered in two places.
 *
 * One family, `OLAI_IDENTITY_*`, and it is deliberately not one variable
 * per proxy: a login, an email claim, a display name, a picture, and the
 * avatar template that pictures a login when no proxy sent a picture. The
 * defaults are `tailscale serve`'s own headers, because that is the
 * deployment olai documents first.
 *
 * IT IS THE ROW'S ENVIRONMENT RATHER THAN ITS `config:`, and the two are a
 * real choice. A row's config is what a DEPLOYMENT'S command line says
 * (`--commit` on the git row); this family is what the reverse proxy in
 * front of that deployment is wired as, which is set where the proxy is —
 * in the unit that starts olai, beside `OLAI_LOG` and the rest — and is
 * documented there ([running.md](../../../../../docs/running.md)). Moving
 * it into `olai.yml` would ask an operator to say it twice.
 */

import {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  DEFAULT_NAME_HEADER,
  DEFAULT_PICTURE_HEADER,
  type IdentityHeaders,
} from "./identity.ts"

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

/** What an unconfigured olai behind `tailscale serve` reads: Tailscale's
 *  own header names, and no template. */
export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = {
  headers: DEFAULT_IDENTITY_HEADERS,
  avatarTemplate: null,
}

/** What a process can see, as the plugin's `Env` hands it over. */
export interface Vars {
  readonly [name: string]: string | undefined
}

/** One optional name out of the environment: unset is `fallback`, empty
 *  (or blank) is off, anything else is what it says. The one shape every
 *  variable in the family has. */
const named = (
  vars: Vars,
  variable: string,
  fallback: string | null,
): string | null => {
  const asked = vars[variable]
  if (asked === undefined) return fallback
  const name = asked.trim()
  return name === "" ? null : name
}

/**
 * The header names this process trusts, or the Tailscale defaults.
 *
 * The login is the only one that cannot be turned off — it is what makes
 * somebody present — so it falls back to its default rather than to
 * `null`, and the email claim falls back to whatever the login header is
 * called.
 */
const headerNames = (vars: Vars): IdentityHeaders => {
  const login = vars[LOGIN_ENV]?.trim() || DEFAULT_LOGIN_HEADER
  return {
    login,
    email: named(vars, EMAIL_ENV, login),
    name: named(vars, NAME_ENV, DEFAULT_NAME_HEADER),
    picture: named(vars, PICTURE_ENV, DEFAULT_PICTURE_HEADER),
  }
}

/** What this process was started with — the ONE way to ask. */
export const identityConfig = (vars: Vars): IdentityConfig => ({
  headers: headerNames(vars),
  avatarTemplate: named(vars, AVATAR_ENV, null),
})
