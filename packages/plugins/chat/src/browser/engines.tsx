/** Chat owns both the machine reading and the sentence drawn from it.
 *
 * The activation-owned roster indexes absence once per revision. Composer and
 * inspector read that same answer; each engine receives an ordinary
 * PluginsRowFace, not the wire schema or a second narrowing of its union.
 */
import { Show } from "solid-js"
import type { EnginesService } from "../browser-engines.ts"
import type { Roster } from "./agents/answered.tsx"
import { TESTID } from "../testids.ts"
import { EngineAbsence } from "./agents/EngineAbsence.tsx"

export const enginesService = (missing: Roster["missing"]): EnginesService => ({
  row: engine => ({
    needs: () => missing(engine) !== null,
    body: () => <Show when={missing(engine)}>{reason =>
      <p class="text-xs leading-relaxed text-muted">
        <EngineAbsence id={engine} missing={reason()} testid={TESTID.engineMissing} />
      </p>
    }</Show>,
  }),
})
