import { heldFaces } from "@olai/plugin-api"
import type { PluginsRowFace } from "./slots.ts"

const faces = heldFaces()

export const holdRowFaces = faces.hold

export const rowFaces = (): ReadonlyMap<string, PluginsRowFace> =>
  new Map(faces.hung("plugins.row").map((one) => [one.plugin, one.face]))
