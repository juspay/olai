import type { Other } from "@olai/format"
import { For } from "solid-js"

import { Moved } from "./Moved.tsx"
import { HOW, HOW_TONE } from "./said.ts"
import type { Selection } from "./selection.ts"
import { TESTID } from "../../testids.ts"
import { Tick } from "./Tick.tsx"

export function Others(props: {
  readonly others: ReadonlyArray<Other>
  readonly selection: Selection
}) {
  return (
    <ul>
      <For each={props.others}>
        {(other) => (
          <li
            class={`flex items-baseline gap-2 py-0.5 ${
              props.selection.ticked(other.path) ? "" : "opacity-40"
            }`}
            data-testid={TESTID.commitOther}
            data-path={other.path}
            data-how={other.how}
            data-from={other.from ?? undefined}
          >
            <Tick
              path={other.path}
              ticked={props.selection.ticked(other.path)}
              toggle={() => props.selection.toggle(other.path)}
              label={`Commit ${other.path}`}
            />
            <Moved from={other.from} />
            <span class="min-w-0 truncate font-mono text-label">{other.path}</span>
            <span class={`ml-auto shrink-0 text-label ${HOW_TONE[other.how]}`}>
              {HOW[other.how]}
            </span>
          </li>
        )}
      </For>
    </ul>
  )
}
