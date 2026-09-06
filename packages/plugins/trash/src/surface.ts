import { defineSurface } from "@kolu/surface/define"
import { surface as legacy } from "@olai/surface"

/** Static compatibility contract; live handlers belong to this capability. */
export const surface = defineSurface({
  procedures: {
    edit: legacy.spec.procedures.edit,
    ops: { run: legacy.spec.procedures.ops.run },
  },
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["untrash", "emptyTrash"] },
  "surface/ops/run": { field: "op", cases: ["untrash", "empty"] },
} as const
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.run": "tool"
  }
} as const
