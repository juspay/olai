import type { Person, RequestHeaders } from "@olai/plugin-api/services"

import type { IdentityConfig } from "../settings.ts"
import { type Identity, identityOf } from "./identity.ts"
import { pictureOf } from "./picture.ts"

export const shown = (who: Identity, template: string | null): Person => ({
  login: who.login,
  name: who.name,
  picture: pictureOf(who, template),
})

export const whoOf = (
  headers: RequestHeaders,
  config: IdentityConfig,
): Person | null => {
  const person = identityOf(headers, config.headers)
  return person === null ? null : shown(person, config.avatarTemplate)
}
