/** Chat spends the vault.files method held by its activation. Parsing belongs
 * to the vault; cancelling the drawing cancels this request too. */
import type { FileDiff } from "@olai/acp/wire"
import type { Directory } from "olai-plugin-vault/file-state"
import type { OutlineDiff } from "olai-plugin-vault/surface"
import { Effect } from "effect"
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"
export const outlineDiffOf = (vault: Pick<Directory, "outlineDiff">, diff: FileDiff) =>
  vault.outlineDiff(diff.path, diff.oldText, diff.newText)

export const createOutlineDiff = (vault: Accessor<Pick<Directory, "outlineDiff"> | undefined>, diff: Accessor<FileDiff>) => {
  const [read, setRead] = createSignal<OutlineDiff | undefined>()
  const [failed, setFailed] = createSignal(false)
  createEffect(() => {
    const directory = vault(), change = diff()
    setRead(undefined)
    setFailed(false)
    if (directory === undefined) { setFailed(true); return }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void Effect.runPromise(outlineDiffOf(directory, change), { signal: controller.signal }).then(
      answer => { if (!controller.signal.aborted) setRead(answer) },
      () => { if (!controller.signal.aborted) setFailed(true) },
    )
  })
  return { read, line: () => failed() ? "the outline is unreadable, so what changed in it cannot be told" : "reading outline changes…" }
}
