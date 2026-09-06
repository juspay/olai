/** A document's metadata is keyed by its file. A fragment remains on the
 * navigation route for landing and history, never on the metadata request. */
import { bodyKind, DocumentPath } from "@olai/format"
import type { DocumentPageRequest } from "@olai/surface"
import type { Route } from "olai-plugin-navigation/contract"

export const documentFile = (route: Route): DocumentPath | undefined => {
  if (route.kind !== "at" || route.address === null || route.address.kind === "node") return undefined
  const path = route.address.path
  return bodyKind(path) === null ? undefined : DocumentPath.make(path)
}

export const documentRequest = (route: Route): DocumentPageRequest | null => {
  const path = documentFile(route)
  return path === undefined ? null : { kind: "at", address: { kind: "document", path } }
}
