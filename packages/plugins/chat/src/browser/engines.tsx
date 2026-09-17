/** Chat owns both the machine reading and the sentence drawn from it.
 *
 * Build the index once inside chat's Solid root, not once per engine's service
 * request. A roster revision invalidates one memo; each inspector face reads
 * its row from that same frame. Consumers receive an ordinary PluginsRowFace,
 * not the wire schema or a second rendering gate to keep in agreement.
 */
import { createMemo, Show, type Accessor } from "solid-js"
import type { EnginesService } from "../browser-engines.ts"
import type { AgentChoice } from "../wire.ts"
import { TESTID } from "../testids.ts"
import { EngineAbsence } from "./agents/EngineAbsence.tsx"

export const enginesService = (standings: Accessor<ReadonlyArray<AgentChoice>>): EnginesService => {
  const byEngine = createMemo(() => new Map(standings().map(row => [row.id, row])))
  return {
    row: engine => {
      const missing = () => {
        const value = byEngine().get(engine)
        return value?.standing === "not-here" ? value.missing : null
      }
      return {
        needs: () => missing() !== null,
        body: () => <Show when={missing()}>{reason =>
          <p class="text-xs leading-relaxed text-muted">
            <EngineAbsence id={engine} missing={reason()} testid={TESTID.engineMissing} />
          </p>
        }</Show>,
      }
    },
  }
}
