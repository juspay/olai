import { createHash } from "node:crypto"

export const GRAVATAR_ORIGIN = "https://www.gravatar.com"

export const gravatarOf = (email: string): string => {
  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex")
  return `${GRAVATAR_ORIGIN}/avatar/${hash}?d=mp`
}
