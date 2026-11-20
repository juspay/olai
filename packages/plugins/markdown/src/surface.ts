import { OpFailure, DocumentAnswer, DocumentBody, DocumentRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { FiledPageReading, DocumentPageRequest } from "@olai/format"
import { DocumentEntry } from "./wire.ts"
export const surface = defineSurface({
collections: {
    documents: {
      keySchema: Schema.String,
      schema: DocumentEntry,
      verbs: ["keys", "get"],
    }
},
streams: {
    documentPage: { inputSchema: DocumentPageRequest, outputSchema: FiledPageReading, arrayKey: "key" }
},
procedures: {
edit: editProcedures,
ops: {
  documents: { output: DocumentAnswer, error: OpFailure },
  document: { input: DocumentRequest, output: DocumentBody, error: OpFailure }, run: writeProcedure }
}
})
export const dispatch = {
  "edit.apply": ["doc", "docNew"],
  "ops.run": ["doc", "create-doc"],
} as const
export const resources = {
  documents: "resource",
} as const

/** The general rule this is written against — a cell is exposable iff its value
 * is O(1)-ish, and anything O(corpus) must be a COLLECTION — is
 * `@olai/surface/host`'s `hostFaces`. */
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
