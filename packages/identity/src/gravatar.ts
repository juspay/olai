/**
 * The picture of a person, from their email claim — one rung of
 * {@link ./picture.ts}'s ladder, and a different fold from who they ARE
 * ({@link ./identity.ts}). The chip wants a URL; a later capture door may
 * want only the login. Complecting the hash with the parse would make the
 * second caller import a picture it does not show.
 *
 * WHETHER an email claim reaches this function at all is the ladder's
 * question, not this file's: a claim that is not an address (`srid@github`)
 * hashes to nobody, so the ladder does not ask.
 */

import { createHash } from "node:crypto"

/** Where a gravatar is fetched from. Named once: the URL {@link gravatarOf}
 *  writes, and the docs' account of what the page may load. */
export const GRAVATAR_ORIGIN = "https://www.gravatar.com"

/**
 * The gravatar for an email: MD5 of the trimmed, lowercased address, with
 * Gravatar's mystery-person fallback when that address has no image. The
 * hash is the classic Gravatar contract; the `d=mp` is the generic
 * silhouette, which is what an address nobody registered draws.
 */
export const gravatarOf = (email: string): string => {
  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex")
  return `${GRAVATAR_ORIGIN}/avatar/${hash}?d=mp`
}
