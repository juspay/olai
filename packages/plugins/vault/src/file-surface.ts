import { ClaimData, DocumentPath, DocumentPageRequest, FiledPageReading, NodeChange, NOTHING_WRONG, Verdict } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { Head, Manifest } from "./wire.ts"
export const Body = Schema.Struct({ text: Schema.NullOr(Schema.String), refused: Schema.Boolean })
export type Body = typeof Body.Type
export const OutlineDiff = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Changes"), changes: Schema.Array(NodeChange) }),
  Schema.Struct({ _tag: Schema.Literal("Unreadable"), side: Schema.Literals(["before", "after"]) }),
])
export type OutlineDiff = typeof OutlineDiff.Type
export const FileKindsState = Schema.Struct({
  claims: Schema.Array(ClaimData),
  outlineRow: Schema.String,
})
export type FileKindsState = typeof FileKindsState.Type
const sameSet = (a: Manifest, b: Manifest): boolean => (a === null) === (b === null)
export const surface = defineSurface({
streams: { bodyPage: { inputSchema: DocumentPageRequest, outputSchema: FiledPageReading, arrayKey: "key" } },
procedures: {
  bodies: { get: { input: Schema.Struct({ path: DocumentPath }), output: Body } },
  files: { outlineDiff: {
    input: Schema.Struct({ path: DocumentPath, oldText: Schema.NullOr(Schema.String), newText: Schema.String }),
    output: OutlineDiff,
  } },
},
cells: {
    "file-kinds": { schema: Schema.NullOr(FileKindsState), default: null, verbs: ["get"] },
    errors: {
      schema: Verdict,
      default: NOTHING_WRONG,
      verbs: ["get"],
    },
    manifest: {
      schema: Manifest,
      default: null,
      verbs: ["get"],
      equals: sameSet,
    }
},
collections: {
    heads: {
      keySchema: Schema.String,
      schema: Head,
      verbs: ["keys", "get", "deltas"],
    }
}
})
export const resources = {
  errors: "resource",
} as const

export const faces = {
  browser: {
    bodyPage: "resource",
    "files.outlineDiff": { tool: { mutates: false } },
    "bodies.get": { tool: { mutates: false } },
    "file-kinds": "resource",
    errors: "resource",
    manifest: "resource",
    heads: "resource",
  },
  agent: {
    errors: "resource",
  },
} as const
