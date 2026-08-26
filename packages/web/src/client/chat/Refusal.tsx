/**
 * A write that was refused, drawn from its structured detail.
 *
 * This is the component the error taxonomy exists for. A `validation` refusal
 * carries the validator's own report as DATA, so it is drawn as rows a reader
 * can act on — a refused write and a broken file on disk are explained by the
 * same lines, each pinned to its `file:line`.
 *
 * Nothing here summarises. Everything the refusal knows is on screen, because
 * the whole rule is that only a SUCCEEDING retry is invisible: a genuine
 * failure renders, with its detail (docs/brainstorming/acp.md).
 */

import { isClean } from "@olai/format"
import { kindOf, type OpFailure } from "@olai/surface"
import { Show } from "solid-js"

import { Rows } from "../errors/Report.tsx"
import { TESTID } from "../testids.ts"

export function Refusal(props: { readonly failure: OpFailure }) {
  return (
    <div
      class="rounded border-l-[3px] border-alarm bg-alarm/5 px-3 py-1.5 text-sm"
      data-testid={TESTID.chatRefusal}
      data-kind={kindOf(props.failure)}
    >
      {/* Line breaks in the reason are KEPT: one refusal can be about several
          things at once — a drop of five files where two are not pictures is
          refused for both of them, by name — and run together into a
          paragraph those two sentences are one nobody finishes reading. */}
      <p class="m-0 whitespace-pre-line">{props.failure.reason}</p>

      <Show when={onlyValidation(props.failure)}>
        {(invalid) => (
          <div class="mt-1 text-sm">
            <Rows errors={invalid().verdict.findings} />
          </div>
        )}
      </Show>
    </div>
  )
}

const onlyValidation = (failure: OpFailure) =>
  failure._tag === "ValidationFailure" && !isClean(failure.verdict) ? failure : undefined
