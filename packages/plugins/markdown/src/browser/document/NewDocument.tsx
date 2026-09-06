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
 * Every rule about the path is `markdown_create`'s — a path that exists, a
 * `..` — and its sentence is what the box draws, verbatim. The one thing the
 * box settles before asking is the SUFFIX, which is the door's own half:
 * `notes/idea` is asked for as `notes/idea.md` (`../file/completing.ts`).
 */

import { useHistory } from "../history.ts"
import { MAKING_DOCUMENT } from "olai-plugin-files/making"
import { NewFile } from "olai-plugin-files/contract"
import { useRouter } from "olai-plugin-navigation/routing"
import { mintAndOpen } from "./minted.ts"

export function NewDocument() {
  const undo = useHistory()
  const router = useRouter()

  return (
    <NewFile
      making={MAKING_DOCUMENT}
      create={(file) => mintAndOpen({ verb: "docNew", file }, undo.record, router)}
    />
  )
}
