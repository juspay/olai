/** Profiles stack transport rows over the vault and kinds composition.
 * The tenant bundle remains the sole list of shipped integrations. */
export const PROFILES = {
  web: { rows: ["ws", "mcp", "web-app"], tenants: true },
  surface: { rows: ["mcp"], tenants: false },
  "test-minimal": { rows: [], tenants: false },
} as const

export type Profile = keyof typeof PROFILES
export const TRANSPORT_ROWS = ["ws", "mcp", "web-app"] as const
export type TransportRow = typeof TRANSPORT_ROWS[number]

export const profileRows = (profile: Profile) => TRANSPORT_ROWS.map((id) => ({
  id,
  name: `olai:${id}`,
  disabled: !(PROFILES[profile].rows as ReadonlyArray<string>).includes(id),
}))
