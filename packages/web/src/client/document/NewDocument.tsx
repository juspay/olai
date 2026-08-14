/**
 * The sidebar's way to a document that does not exist yet.
 *
 * A quiet affordance under the file tree — the tree is where files ARE, so it
 * is where one begins — that opens into a path box. The BOX is
 * `../file/NewFile.tsx`, shared with the outline's door beside it; what is left
 * here is what is actually this file's: the op it sends, and the fact that the
 * page it lands on opens EDITING (./minted.ts), because an empty page is not
 * what "start writing" means.
 *
 * Every rule about the path is `create_document`'s — a path that exists, a
 * `..`, a name that is not `.md` — and its sentence is what the box draws,
 * verbatim.
 */

import { useUndo } from "../edit/undoing.ts"
import { MAKING_DOCUMENT } from "../file/making.ts"
import { NewFile } from "../file/NewFile.tsx"
import { useRouter } from "../router.tsx"
import { mintAndOpen } from "./minted.ts"

export function NewDocument() {
  const undo = useUndo()
  const router = useRouter()

  return (
    <NewFile
      making={MAKING_DOCUMENT}
      create={(file) => mintAndOpen({ verb: "docNew", file }, undo.record, router.go)}
    />
  )
}
