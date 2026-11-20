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
type Verb = {
  [Member in keyof typeof surface.spec.procedures]: `${Member & string}.${keyof (typeof surface.spec.procedures)[Member] & string}`
}[keyof typeof surface.spec.procedures]

export const dispatch = {
  "edit.apply": ["doc", "docNew"],
  "ops.run": ["doc", "create-doc"],
} as const satisfies Partial<Record<Verb, ReadonlyArray<string>>>
export const resources = {
  documents: "resource",
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
