import { isClean } from "@olai/format"
import { kindOf, type OpFailure } from "@olai/format"
import { Show } from "solid-js"

import { Rows } from "olai-plugin-vault/errors/Report.tsx"
import { TESTID } from "../../testids.ts"

export function Refusal(props: { readonly failure: OpFailure }) {
  return (
    <div
      class="rounded-control border-l-[3px] border-alarm bg-alarm/10 px-3 py-1.5 text-body"
      data-testid={TESTID.chatRefusal}
      data-kind={kindOf(props.failure)}
    >
      <p class="m-0 whitespace-pre-line">{props.failure.reason}</p>

      <Show when={onlyValidation(props.failure)}>
        {(invalid) => (
          <div class="mt-1 text-body">
            <Rows errors={invalid().verdict.findings} />
          </div>
        )}
      </Show>
    </div>
  )
}

const onlyValidation = (failure: OpFailure) =>
  failure._tag === "ValidationFailure" && !isClean(failure.verdict) ? failure : undefined
