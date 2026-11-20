import { gravatarOf } from "./gravatar.ts"
import type { Identity } from "./identity.ts"

export const LOGIN_PLACEHOLDER = "{login}"

const remoteImage = (url: string): string | null => {
  try {
    return new URL(url).protocol === "https:" ? url : null
  } catch {
    return null
  }
}

export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim())

const templated = (template: string, login: string): string =>
  template.replaceAll(LOGIN_PLACEHOLDER, encodeURIComponent(login))

export const pictureOf = (
  who: Identity,
  template: string | null,
): string | null =>
  (who.picture === null ? null : remoteImage(who.picture))
  ?? (template === null ? null : remoteImage(templated(template, who.login)))
  ?? (who.email !== null && looksLikeEmail(who.email)
    ? gravatarOf(who.email)
    : null)
