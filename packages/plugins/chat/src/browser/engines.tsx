import { Show } from "solid-js"
import type { EnginesService } from "../browser-engines.ts"
import type { Roster } from "./agents/answered.tsx"
import { TESTID } from "../testids.ts"
import { EngineAbsence } from "./agents/EngineAbsence.tsx"

export const enginesService = (roster: Pick<Roster, "missing" | "engines">): EnginesService => ({
  installed: () => roster.engines().map(({ id, name }) => ({ id, name })),
  row: engine => ({
    needs: () => roster.missing(engine) !== null,
    body: () => <Show when={roster.missing(engine)}>{reason =>
      <p class="text-label leading-relaxed text-muted">
        <EngineAbsence id={engine} missing={reason()} testid={TESTID.engineMissing} />
      </p>
    }</Show>,
  }),
})
