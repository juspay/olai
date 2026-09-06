/** File access metadata remains available independently of browsing UI. */
import { defineSurface } from "@kolu/surface/define"
import { surface as legacy } from "@olai/surface"
export const surface = defineSurface({ cells: { errors: legacy.spec.cells.errors, manifest: legacy.spec.cells.manifest }, collections: { heads: legacy.spec.collections.heads } })
export const faces = { browser: { errors: "resource", manifest: "resource", heads: "resource" }, agent: { errors: "resource" } } as const
