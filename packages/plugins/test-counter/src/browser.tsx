/** A tiny shell receives only a renderer mount and this capability's wire.
 * Requests and presentation are cancelled with the root contribution. */
import { definePlugin, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal, onCleanup, onMount } from "solid-js"
import type { SurfaceClient } from "@kolu/surface/solid"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { name, surface } from "./wire.ts"
export { name, surface } from "./wire.ts"

export default definePlugin({ name, needs: [Wired, rendererSlots], apply: Effect.gen(function*() {
  const wired = yield* Wired
  const slots = yield* rendererSlots
  yield* slots.contribute(root, () => {
    const [count, setCount] = createSignal<number>()
    const [failure, setFailure] = createSignal<string>()
    const [pending, setPending] = createSignal(false)
    const tasks = new Set<AbortController>()
    let active = true
    onCleanup(() => { active = false; for (const task of tasks) task.abort() })
    const run = (kind: "read" | "increment") => {
      if (!active || pending()) return
      const controller = new AbortController()
      tasks.add(controller)
      setPending(true)
      const client = wired.client() as SurfaceClient<typeof surface.spec>
      void Effect.runPromise(client.procedures.counter[kind]({}), { signal: controller.signal }).then(
        value => { if (active) { setCount(value); setFailure(undefined) } },
        error => { if (active) setFailure(String(error)) },
      ).finally(() => { tasks.delete(controller); if (active) setPending(false) })
    }
    onMount(() => run("read"))
    return <main aria-label="Non-notebook fixture" class="p-8">
      <h1>A capability without a notebook</h1>
      <output aria-label="Counter value">{count()}</output>
      <button type="button" disabled={pending()} onClick={() => run("increment")}>Increment counter</button>
      {failure() && <p role="alert">{failure()}</p>}
    </main>
  })
}) })
