export const ASSET_PREFIX = "/_olai/assets/"

export const chunkFile = (module: string): RegExp =>
  new RegExp(`^${module}-[^/]+\\.js$`)

export const chunkUrl = (module: string): RegExp =>
  new RegExp(`${ASSET_PREFIX}${module}-[^/]+\\.js$`)
