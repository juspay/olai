/**
 * WHICH picture to draw for a person, and where it comes from.
 *
 * A LADDER, not a lookup: four rungs asked in order, each one only when
 * the one above it had nothing to say.
 *
 *   1. the **picture header** the proxy sent — `tailscale serve` injects
 *      `Tailscale-User-Profile-Pic`, which is the IdP's own avatar and so
 *      the best picture anybody here has;
 *   2. the operator's **avatar template** — `https://github.com/{login}.png`
 *      is the Caddy + GitHub OAuth answer, where the login IS the GitHub
 *      username and GitHub serves that avatar to anyone, with no API and no
 *      token;
 *   3. the **gravatar of the email claim**, and only when that claim is
 *      really an address ({@link looksLikeEmail});
 *   4. nothing — `null`, which the chip draws as its own silhouette.
 *
 * Rung 3 is the whole of what #330 did, demoted. It assumed the login was
 * an email, which is true of a Google/Microsoft/Okta tailnet and false of
 * a GitHub- or passkey-backed one, where `Tailscale-User-Login` reads
 * `srid@github` — Tailscale's own spelling, correct to display, and not an
 * address. Hashing it reached nobody's gravatar, so every such account wore
 * the generic silhouette forever. The guard is what stops that hash; the
 * rungs above it are what put a real face there.
 *
 * NO PROVIDER IS NAMED HERE. GitHub is an example in a doc; what the code
 * has is one template with one placeholder.
 *
 * A rung that is present but is not an `http(s)` URL is not a picture, and
 * the ladder goes on to the next rung rather than handing the page a src
 * that can only draw broken. That is a config or a proxy being wrong, and
 * the honest answer to it is the next-best picture, not a broken image.
 *
 * A separate fold from who the person IS ({@link ./identity.ts}) for the
 * reason {@link ./gravatar.ts} is: `POST /capture` wants the login and no
 * picture at all.
 */

import { gravatarOf } from "./gravatar.ts"
import type { Identity } from "./identity.ts"

/** The avatar URL template — one URL with {@link LOGIN_PLACEHOLDER} in it.
 *  Unset (or blank) is no template. */
export const AVATAR_ENV = "OLAI_IDENTITY_AVATAR_TEMPLATE"

/** What a template spells the login as. */
export const LOGIN_PLACEHOLDER = "{login}"

/** The configured template, or `null`. Read on demand, not at import, so
 *  what a process was started with is what it serves. */
export const avatarTemplate = (): string | null => {
  const asked = process.env[AVATAR_ENV]?.trim() ?? ""
  return asked === "" ? null : asked
}

/** That URL, if it is one a browser can fetch a picture over. */
const remoteImage = (url: string): string | null => {
  try {
    const scheme = new URL(url).protocol
    return scheme === "https:" || scheme === "http:" ? url : null
  } catch {
    return null
  }
}

/**
 * Whether a claim is really an email address — an `@`, something on the
 * left of it, and a dotted domain on the right.
 *
 * Deliberately coarse. It is not validating an address anybody typed; it
 * is separating `ada@example.com` (a claim a gravatar can be hashed from)
 * from `srid@github` (Tailscale's spelling of a GitHub account, which has
 * no gravatar and never will).
 */
export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim())

/** The template with this login in it, escaped so a login cannot rewrite
 *  the URL around it. */
const templated = (template: string, login: string): string =>
  template.replaceAll(LOGIN_PLACEHOLDER, encodeURIComponent(login))

/** The picture for this person, down the ladder — or `null` when no rung
 *  had one, which is the silhouette and is a face like any other. */
export const pictureOf = (
  who: Identity,
  template: string | null,
): string | null =>
  (who.picture === null ? null : remoteImage(who.picture))
  ?? (template === null ? null : remoteImage(templated(template, who.login)))
  ?? (who.email !== null && looksLikeEmail(who.email)
    ? gravatarOf(who.email)
    : null)
