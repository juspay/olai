/**
 * A profile selects rows; it does not choose a different composition root.
 *
 * Every profile starts with the vault row over the host's kind registry.
 * web adds tenants and three transport rows; surface adds MCP; test-minimal
 * adds neither. Disabled rows stay inspectable on the same loader host.
 *
 * Infrastructure modules stay in the composition-root package. A tenant under
 * packages/plugins consumes the plugin API and may not import the server; ws
 * and mcp need the composed surface the server owns. Their olai: specifiers are
 * resolved by the root into modules, not npm packages. The loader still mounts
 * ordinary fibers on the same host, and the panel reports their real states.
 */

export const TRANSPORT_ROWS = ["ws", "mcp", "web-app"] as const
export const INFRASTRUCTURE_ROWS = TRANSPORT_ROWS
export type TransportRow = typeof TRANSPORT_ROWS[number]

/** The module identity belongs to the row catalogue. Both the loader entries
 * and their resolver use it, so changing this grammar cannot strand one side. */
export const transportModuleName = (row: TransportRow): string => `olai:${row}`

export const PROFILES = {
  web: { rows: ["ws", "mcp", "web-app"] },
  surface: { rows: ["mcp"] },
  "test-minimal": { rows: [] },
} as const satisfies Record<string, { readonly rows: ReadonlyArray<TransportRow> }>

export type Profile = keyof typeof PROFILES

/** Disabled rows remain loader entries. The panel can later enable one through
 * the same flip verb as a tenant; dropping it from this list would make that
 * name impossible to turn back on. --plugins patches tenants independently,
 * so --plugins= cannot accidentally remove the panel's own transport. */
export const profileRows = (profile: Profile) => TRANSPORT_ROWS.map((id) => ({
  id,
  name: transportModuleName(id),
  disabled: !(PROFILES[profile].rows as ReadonlyArray<TransportRow>).includes(id),
}))
