import { Show } from "solid-js"
import { servedDirectory } from "../vault.ts"
import { Result } from "effect"

import { useUndo } from "../edit/undoing.ts"
import { MAKING_OUTLINE } from "olai-plugin-files/making"
import { NewFile } from "../files.tsx"
import { useRouter } from "olai-plugin-navigation/routing"
import { applied } from "../writes.ts"
import { atFile } from "olai-plugin-navigation/routes"

export const outlineMaking = () => {
  const row = servedDirectory()?.outlineRow()
  return row ? MAKING_OUTLINE(row) : undefined
}

export function NewOutline() {
  const undo = useUndo()
  const router = useRouter()

  return (
    <Show when={outlineMaking()}>{making => <NewFile
      making={making()}
      create={async (file) => {
        const started = router.workspace()
        const outcome = await applied({ verb: "outlineNew", file }, undo.record)
        if (Result.isFailure(outcome)) return outcome.failure.message
        if (router.workspace() === started) router.go(atFile(outcome.success.file))
        return null
      }}
    />}</Show>
  )
}
