import type { AuthStatus } from "@kolu/acp/wire"

export const identityOf = (identity: AuthStatus): string => {
  if (identity.kind === "none") return "Not signed in"
  const second = identity.account?.email ?? identity.detail
  return second === null || second === undefined ? identity.label : `${identity.label} · ${second}`
}

export const identityTitleOf = (identity: AuthStatus): string => {
  if (identity.kind === "none") return "Not signed in"
  const parts = [
    identity.label,
    identity.account?.email,
    identity.account?.organization,
    identity.account?.plan,
    identity.detail,
  ].filter((part): part is string => typeof part === "string" && part.trim() !== "")
  return [...new Set(parts)].join(" · ")
}
