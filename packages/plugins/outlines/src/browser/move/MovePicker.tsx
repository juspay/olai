import { servedDirectory } from "../vault.ts"
import { crumbAsides } from "../faces.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import type { Edit } from "@olai/surface"
import type { Accessor, Signal } from "solid-js"

import type { Moved } from "@olai/format"

import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { Shortlist, type ShortlistTestids } from "olai-plugin-search/ui/Shortlist.tsx"
import { createSearch } from "../search.ts"

import { PANEL_OUT } from "@olai/web/client/pill.ts"

const MOVE_LIST: ShortlistTestids = {
  box: TESTID.moveSearch,
  row: {
    row: TESTID.moveHit,
    place: TESTID.moveHitPlace,
    prop: TESTID.moveHitProp,
  },
  failed: TESTID.moveSearchFailed,
}

export function MovePicker(props: {
  readonly query: Signal<string>
  readonly moved: Moved
  readonly refusals: ReadonlyMap<string, string>
  readonly onAimed: (ids: Accessor<ReadonlyArray<string>>) => void
  readonly onWrite: (edit: Edit) => void
  readonly onClose: () => void
}) {
  return (
    <div
      class="my-1 w-[min(28rem,90vw)] rounded-control border border-rule/60 bg-panel p-2"
      data-testid={TESTID.movePicker}
      data-row={props.moved.id}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      <p
        class="m-0 mb-1 text-label text-muted"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("[data-tag]") !== null
          ) {
            event.preventDefault()
          }
        }}
      >
        Move{" "}
        <span class="text-ink">
          <TitleHtml
            drawing={renderTitle(servedDirectory()?.claims(), props.moved.title, props.moved.file, {
              links: false,
            })}
          />
        </span>{" "}
        under…
      </p>

      <Shortlist
        claims={servedDirectory()?.claims()}
        nodes={createSearch}
        query={props.query}
        label="Search for where to move it"
        testids={MOVE_LIST}
        faces={crumbAsides()}
        refusing={{
          testid: TESTID.moveRefused,
          asked: (hits) => props.onAimed(() => hits().map((hit) => hit.id)),
          why: (hit) => props.refusals.get(hit.id) ?? null,
        }}
        onTake={(hit) => props.onWrite({ verb: "under", id: props.moved.id, parent: hit.id })}
      />

      <div class="mt-1 flex items-center justify-end">
        <button
          type="button"
          class={PANEL_OUT}
          data-testid={TESTID.movePickerClose}
          onClick={() => props.onClose()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
