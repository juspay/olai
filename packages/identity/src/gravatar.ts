/**
 * The picture of a person, from their email claim.
 *
 * A different fold from who they ARE ({@link ./identity.ts}). The chip
 * wants a URL; a later capture door may want only the login. Complecting
 * the hash with the parse would make the second caller import a picture
 * it does not show. An empty address is the generic silhouette — one
 * picture for everyone with no email claim, not a hash of the login.
 */

import { createHash } from "node:crypto"

/** Where a gravatar is fetched from. Named once: the URL {@link gravatarOf}
 *  writes, and the shell's image policy names the same origin. */
export const GRAVATAR_ORIGIN = "https://www.gravatar.com"

/**
 * The gravatar for an email: MD5 of the trimmed, lowercased address, with
 * Gravatar's mystery-person fallback when that address has no image. The
 * hash is the classic Gravatar contract; the `d=mp` is the generic
 * silhouette.
 */
export const gravatarOf = (email: string): string => {
  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex")
  return `${GRAVATAR_ORIGIN}/avatar/${hash}?d=mp`
}

/** The generic silhouette, hashed from the empty address so every
 *  no-email claim draws the same picture. */
export const GENERIC_GRAVATAR = gravatarOf("")
