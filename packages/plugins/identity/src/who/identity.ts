export const DEFAULT_LOGIN_HEADER = "Tailscale-User-Login"
export const DEFAULT_NAME_HEADER = "Tailscale-User-Name"
export const DEFAULT_PICTURE_HEADER = "Tailscale-User-Profile-Pic"

export interface IdentityHeaders {
  readonly login: string
  readonly email: string | null
  readonly name: string | null
  readonly picture: string | null
}

export const DEFAULT_IDENTITY_HEADERS: IdentityHeaders = {
  login: DEFAULT_LOGIN_HEADER,
  email: DEFAULT_LOGIN_HEADER,
  name: DEFAULT_NAME_HEADER,
  picture: DEFAULT_PICTURE_HEADER,
}

export interface Identity {
  readonly login: string
  readonly email: string | null
  readonly name: string | null
  readonly picture: string | null
}

const headerOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  name: string | null,
): string | null => {
  if (name === null) return null
  const raw = headers[name.toLowerCase()] ?? headers[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

export const headerNamesOf = (
  headers: IdentityHeaders,
): ReadonlyArray<string> => {
  const names: string[] = []
  const seen = new Set<string>()
  for (const name of [headers.login, headers.email, headers.name, headers.picture]) {
    if (name === null) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export const identityOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  names: IdentityHeaders = DEFAULT_IDENTITY_HEADERS,
): Identity | null => {
  const login = headerOf(headers, names.login)
  if (login === null) return null
  return {
    login,
    email: headerOf(headers, names.email),
    name: headerOf(headers, names.name),
    picture: headerOf(headers, names.picture),
  }
}
