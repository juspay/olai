/** The standing cell and its sentence renderer belong to chat's activation. */
import { Show, type Accessor } from "solid-js"
import type { EnginesService } from "../browser-engines.ts"
import type { AgentChoice } from "../wire.ts"
import { TESTID } from "../testids.ts"
import { Missing } from "./agents/Missing.tsx"

export const enginesService = (standings: Accessor<ReadonlyArray<AgentChoice>>): EnginesService => {
  const standing = (engine: string) => () => standings().find(row => row.id === engine) ?? null
  return {
    standing,
    missing: engine => {
      const row = standing(engine)
      const missing = () => {
        const value = row()
        return value?.standing === "not-here" ? value.missing : null
      }
      return <Show when={missing()}>{reason =>
        <p class="text-xs leading-relaxed text-muted">
          <Missing id={engine} missing={reason()} testid={TESTID.engineMissing} />
        </p>
      }</Show>
    },
  }
}
