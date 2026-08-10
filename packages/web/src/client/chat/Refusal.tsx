/**
 * A write that was refused, drawn from its structured detail.
 *
 * This is the component the error taxonomy exists for. A `derived` refusal
 * carries the children that are in the way as DATA, so they are drawn as rows
 * a reader can act on — "mark those instead" is a list, not a sentence — and a
 * `validation` refusal carries the validator's own report, so a refused write
 * and a broken file on disk are explained by the same rows.
 *
 * Nothing here summarises. Everything the refusal knows is on screen, because
 * the whole rule is that only a SUCCEEDING retry is invisible: a genuine
 * failure renders, with its detail (docs/brainstorming/acp.md).
 */

import { kindOf, type OpFailure } from "@olai/surface"
import { For, Match, Switch } from "solid-js"

import { Rows } from "../errors/Report.tsx"
import { TESTID } from "../testids.ts"

export function Refusal(props: { readonly failure: OpFailure }) {
  return (
    <div
      class="rounded border-l-[3px] border-alarm bg-alarm/5 py-1.5 pl-3 text-sm"
      data-testid={TESTID.chatRefusal}
      data-kind={kindOf(props.failure)}
    >
      <p class="m-0">{props.failure.reason}</p>

      <Switch>
        <Match when={onlyDerived(props.failure)}>
          {(derived) => (
            <ul class="mt-1 list-none p-0" data-testid={TESTID.chatUnfinished}>
              <For each={derived().children}>
                {(child) => (
                  <li
                    class="py-0.5 text-sm"
                    data-testid={TESTID.chatUnfinishedChild}
                    data-node-id={child.id}
                    data-status={child.status}
                  >
                    <span class="mr-2 font-mono text-[0.6875rem] text-muted">
                      {child.status}
                    </span>
                    {child.title}
                  </li>
                )}
              </For>
            </ul>
          )}
        </Match>

        <Match when={onlyValidation(props.failure)}>
          {(invalid) => (
            <div class="mt-1 text-sm">
              <Rows errors={invalid().errors} />
            </div>
          )}
        </Match>
      </Switch>
    </div>
  )
}

const onlyDerived = (failure: OpFailure) =>
  failure._tag === "DerivedFailure" ? failure : undefined

const onlyValidation = (failure: OpFailure) =>
  failure._tag === "ValidationFailure" && failure.errors.length > 0 ? failure : undefined
