import { servedDirectory } from "../vault.ts"
import { crumbAsides } from "../faces.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import type { Signal } from "solid-js"
import type { RegularNode } from "@olai/format"
import type { Edit } from "@olai/surface"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { useNames } from "../reading.tsx"
import { Shortlist, type ShortlistTestids } from "olai-plugin-search/ui/Shortlist.tsx"
import { createSearch } from "../search.ts"

import { PANEL_OUT } from "@olai/web/client/pill.ts"
import { NodeTitle } from "../NodeTitle.tsx"
import { DropRef } from "./DropRef.tsx"
import { namedBy } from "./named.ts"
import { linking, type Relation, relating, unlinking } from "./relation.ts"

const EDGE_LIST: ShortlistTestids = {
  box: TESTID.edgeSearch,
  row: {
    row: TESTID.edgeHit,
    place: TESTID.edgeHitPlace,
    prop: TESTID.edgeHitProp,
  },
  failed: TESTID.edgeSearchFailed,
}

export function EdgePanel(props: {
  readonly query: Signal<string>
  readonly node: RegularNode
  readonly relation: Relation
  readonly onWrite: (edit: Edit) => void
  readonly onClose: () => void
}) {
  const names = useNames()
  const words = () => relating(props.relation)

  const held = createMemo(() => namedBy(props.node, props.relation, names))

  return (
    <div
      class="my-1 w-[min(28rem,90vw)] rounded-control border border-rule/60 bg-panel p-2"
      data-testid={TESTID.edgePanel}
      data-relation={props.relation}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      <p class="m-0 mb-1 text-label text-muted">{words().heading}</p>

      <Show when={held().length > 0}>
        <ul
          class="m-0 mb-1 flex list-none flex-wrap gap-1 p-0"
          data-testid={TESTID.edgeHeld}
        >
          <Key each={held()} by="id">
            {(one) => (
              <li class="flex items-center gap-1 rounded-control border border-rule/60 px-1.5 py-0.5 text-body text-ink">
                <span
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("[data-tag]") !== null
                    ) {
                      event.preventDefault()
                    }
                  }}
                  data-ref={one().id}
                >
                  <NodeTitle title={one().title} from={one().from} links={false} />
                </span>
                <DropRef
                  testid={TESTID.edgeDrop}
                  relation={props.relation}
                  id={one().id}
                  title={one().title}
                  onDrop={(target) =>
                    props.onWrite(unlinking(props.node.id, props.relation, target))}
                />
              </li>
            )}
          </Key>
        </ul>
      </Show>

      <Shortlist
        claims={servedDirectory()?.claims()}
        nodes={createSearch}
        query={props.query}
        label={words().placeholder}
        testids={EDGE_LIST}
        faces={crumbAsides()}
        onTake={(hit) => props.onWrite(linking(props.node.id, props.relation, hit.id))}
      />

      <div class="mt-1 flex items-center justify-end">
        <button
          type="button"
          class={PANEL_OUT}
          data-testid={TESTID.edgePanelClose}
          onClick={() => props.onClose()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
