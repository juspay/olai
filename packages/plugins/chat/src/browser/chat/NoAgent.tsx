import { For, Show } from "solid-js"
import { useAgents } from "../agents/answered.tsx"
import { EngineAbsence } from "../agents/EngineAbsence.tsx"
import { TESTID } from "../../testids.ts"

export function NoAgent() {
  const agents = useAgents()
  const missing = () => agents.standings().filter(engine => engine.standing === "not-here")
  return <div class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-body text-muted" data-testid={TESTID.chatNoAgent}>
    <p class="m-0 mb-3 text-ink">No agent yet.</p>
    <Show when={missing().length > 0}>
      <p class="m-0 mb-2 text-ink">Install one of these to start an agent:</p>
      <ul class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        <For each={missing()}>{engine => <li>
          <EngineAbsence id={engine.id} missing={engine.missing} testid={TESTID.chatInstall} />
        </li>}</For>
      </ul>
    </Show>
    <p class="m-0">Your notes work without one. Only chat needs an agent.</p>
  </div>
}
