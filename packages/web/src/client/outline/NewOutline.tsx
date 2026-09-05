/**
 * The sidebar's way to an outline that does not exist yet.
 *
 * MCP could mint one — `create_outline` — and a person could not: the tree
 * listed every file in the directory and offered no way to start another. A
 * standing consistency deviation rather than a missing feature
 * (`parity-create-outline`), and this closes it.
 *
 * The BOX is `../file/NewFile.tsx`, shared with the document's door, so what is
 * left here is the two things that are actually this file's: the op it sends,
 * and where a write that landed goes. Every rule about the path belongs to
 * neither — `create_outline` judges it and its sentence is what is drawn. The
 * box settles the SUFFIX before it asks, because that half is the door's own
 * and this file is the door (`../file/completing.ts`).
 *
 * IT SENDS NO SEED, and that is the one place this verb says less than the tool
 * it maps to. The op may mint an outline holding a whole tree, which is what
 * saves an agent a second call; a person types the first row where it will live
 * — the empty outline's page offers exactly that line (`../edit/StartLine.tsx`,
 * the `first` anchor) — so there is nothing here for a seed to be filled from.
 * Nothing this face can reach is out of the agent's reach, which is the
 * direction the consistency rule runs.
 *
 * It lands on the new outline's page, and the sidebar lists it on the same
 * frame — both off the collection the write published, never an echo.
 */

import { Result } from "effect"

import { useUndo } from "../edit/undoing.ts"
import { MAKING_OUTLINE } from "../file/making.ts"
import { NewFile } from "../file/NewFile.tsx"
import { useRouter } from "../router.tsx"
import { applied } from "../writes.ts"
import { atFile } from "../routes.ts"

export function NewOutline() {
  const undo = useUndo()
  const router = useRouter()

  return (
    <NewFile
      making={MAKING_OUTLINE}
      create={async (file) => {
        const started = router.workspace()
        const outcome = await applied({ verb: "outlineNew", file }, undo.record)
        if (Result.isFailure(outcome)) return outcome.failure.message
        // WHERE it landed is the ANSWER's, not the box's: the ops layer says
        // which file the write produced, and reading it back off what was typed
        // would be a second spelling of a path (`../document/minted.ts`'s rule).
        if (router.workspace() === started) router.go(atFile(outcome.success.file))
        return null
      }}
    />
  )
}
