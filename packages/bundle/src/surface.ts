/** The Olai bundle's complete static application contract. This is a typed
 * client convenience, not the permanent host's served schema: running rows
 * register their own descriptors and the host publishes only those owners.
 * Descriptor spreads preserve shared schema identities and established bare
 * tags for CLI/MCP clients. Browser owners use their own sibling clients. */
import { defineSurface } from "@kolu/surface/define"
import { surface as core } from "@olai/surface"
import { surface as vault } from "olai-plugin-vault/surface"
import { surface as outlines } from "olai-plugin-outlines/surface"
import { surface as markdown } from "olai-plugin-markdown/surface"
import { surface as files } from "olai-plugin-files/surface"
import { surface as pins } from "olai-plugin-pins/surface"
import { surface as capture } from "olai-plugin-capture/surface"
import { surface as trash } from "olai-plugin-trash/surface"
import { surface as search } from "olai-plugin-search/surface"
import { surface as definitions } from "olai-plugin-vault-plugins/surface"
export const surface = defineSurface({
  cells: { ...core.spec.cells, ...vault.spec.cells, ...pins.spec.cells, ...capture.spec.cells },
  collections: { ...vault.spec.collections, ...outlines.spec.collections, ...markdown.spec.collections },
  streams: { ...outlines.spec.streams, ...markdown.spec.streams, ...search.spec.streams },
  procedures: {
    ...core.spec.procedures, ...outlines.spec.procedures, ...search.spec.procedures,
    plugins: { ...core.spec.procedures.plugins, ...definitions.spec.procedures.plugins },
    ops: { ...outlines.spec.procedures.ops, ...markdown.spec.procedures.ops, ...files.spec.procedures.ops, ...trash.spec.procedures.ops },
  },
})
