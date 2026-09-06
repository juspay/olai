import { defineSurface } from "@kolu/surface/define"
import { surface as legacy } from "@olai/surface"

/** Static compatibility contract; live handlers belong to this capability. */
export const surface = defineSurface({
  collections: { documents: legacy.spec.collections.documents },
  streams: { documentPage: legacy.spec.streams.documentPage },
  procedures: {
    edit: legacy.spec.procedures.edit,
    ops: { documents: legacy.spec.procedures.ops.documents, document: legacy.spec.procedures.ops.document, run: legacy.spec.procedures.ops.run },
  },
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["doc", "docNew"] },
  "surface/ops/run": { field: "op", cases: ["doc", "create-doc"] },
} as const
export const faces = {
  "browser": {
    "documents": "resource",
    "documentPage": "resource",
    "edit.apply": "tool"
  },
  "agent": {
    "documents": "resource",
    "ops.documents": "tool",
    "ops.document": "tool",
    "ops.run": "tool"
  }
} as const
