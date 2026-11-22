/** A pure storage format. The caller supplies the claims snapshot against
 * which this parse is interpreted; a format never reads a live registry. */
import type { Result } from "effect"
import type { Document, Outline } from "./document.ts"
import type { OutlineError } from "./errors.ts"
import type { Claims } from "./kinds.ts"
import type { Node } from "./node.ts"
export interface OutlineFormat {
  /** `previous`, when the caller holds it, is what this file decoded to at the
   *  revision before: its unchanged records keep their readings. */
  readonly parse: (file: string, contents: string, claims: Claims, previous?: Document) => Result.Result<Outline, ReadonlyArray<OutlineError>>
  readonly serialize: (nodes: ReadonlyArray<Node>) => string
}
