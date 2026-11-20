import { TESTID } from "olai-plugin-outlines/testids"
import { For } from "solid-js"


import { TARGET } from "@olai/ui-primitives/touch.ts"
import { type Relation, RELATIONS } from "./relation.ts"

export function EdgeVerbs(props: {
  readonly open: (relation: Relation) => void
  readonly openFor: Relation | null
}) {
  return (
    <div class="mt-1 flex flex-wrap items-center gap-1">
      <For each={RELATIONS}>
        {(one) => (
          <button
            type="button"
            class={`${TARGET} md:min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-1.5 py-0.5 text-label text-muted hover:bg-rule/40 hover:text-ink`}
            data-testid={TESTID.edgeVerb}
            data-relation={one.relation}
            aria-expanded={props.openFor === one.relation}
            onClick={() => props.open(one.relation)}
          >
            {one.verb}
          </button>
        )}
      </For>
    </div>
  )
}
