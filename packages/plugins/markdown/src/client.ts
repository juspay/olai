import type { Subscription, SurfaceClient, UseCollectionResult } from "@kolu/surface/solid"
import type { Accessor } from "solid-js"
import type { DocumentPageRequest, PageReading } from "@olai/format"
import type { DocumentEntry } from "./wire.ts"
import type { surface } from "./surface.ts"
export type Client = SurfaceClient<typeof surface.spec>
let held: (() => Client) | undefined
export function holdClient(read: () => Client): () => void {
  if (held !== undefined) throw new Error("markdown client already acquired")
  held = read
  return () => { if (held === read) held = undefined }
}
function client(): Client {
  if (held === undefined) throw new Error("markdown client read outside its activation")
  return held()
}

export const documentEntries = (
  keys: Accessor<string[]>,
): UseCollectionResult<string, DocumentEntry> => client().collections.documents.use({ keys })

export const documentPageReading = (
  request: Accessor<DocumentPageRequest | null>,
): Subscription<PageReading> => client().streams.documentPage.use(request)
