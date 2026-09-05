/**
 * A profile selects rows; it does not choose a different composition root.
 *
 * The vault and kinds still form the shared base (their acquisition moves to a
 * row in Phase 17). web adds the default tenant bundle and three infrastructure
 * rows; surface adds only MCP; test-minimal adds neither. Keeping these choices
 * as data prevents a second headless boot sequence from drifting away from the
 * same write gate, lifecycle and fault handling the browser uses.
 *
 * Infrastructure modules stay in the composition-root package. A tenant under
 * packages/plugins consumes the plugin API and may not import the server; ws
 * and mcp need the composed surface the server owns. Their olai: specifiers are
 * resolved by the root into modules, not npm packages. The loader still mounts
 * ordinary fibers on the same host, and the panel reports their real states.
 */
export const TRANSPORT_ROWS = ["ws", "mcp", "web-app"] as const
export type TransportRow = typeof TRANSPORT_ROWS[number]

/** The module identity belongs to the row catalogue. Both the loader entries
 * and their resolver use it, so changing this grammar cannot strand one side. */
export const transportModuleName = (row: TransportRow): string => `olai:${row}`

export const PROFILES = {
  web: { rows: ["ws", "mcp", "web-app"], tenants: true },
  surface: { rows: ["mcp"], tenants: false },
  "test-minimal": { rows: [], tenants: false },
} as const satisfies Record<string, { readonly rows: ReadonlyArray<TransportRow>; readonly tenants: boolean }>

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
