/**
 * Every other dirty file in the repository — one row, one path, one word.
 *
 * This is the whole of what `commit-whole-repo` added to the panel, and its
 * poverty is the design. A document, a source file, an outline olai does not
 * serve: nothing here can be parsed into nodes, so the only richer thing on
 * offer would be a text diff — and this feature has never shown one, because
 * what it is is an audit-trail recorder rather than a git client. A path and
 * what happened to it is exactly what a person needs to decide whether it
 * belongs in this commit.
 *
 * Paths are REPO-ROOT-RELATIVE, which is both the honest spelling (the row may
 * be two directories above anything olai serves) and the one that cannot
 * collide with a served outline's own name.
 */

import type { Other } from "@olai/format"
import { For } from "solid-js"

import { HOW, HOW_TONE } from "./said.ts"
import type { Selection } from "./selection.ts"
import { TESTID } from "../testids.ts"
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
          >
            <Tick
              path={other.path}
              ticked={props.selection.ticked(other.path)}
              toggle={() => props.selection.toggle(other.path)}
              label={`commit ${other.path}`}
            />
            <span class="min-w-0 truncate font-mono text-xs">{other.path}</span>
            <span class={`ml-auto shrink-0 text-xs ${HOW_TONE[other.how]}`}>
              {HOW[other.how]}
            </span>
          </li>
        )}
      </For>
    </ul>
  )
}
