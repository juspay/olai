import { TESTID } from "olai-plugin-outlines/testids"
import { DOT } from "@olai/web/client/marks.tsx"

import { CONTROL, GLYPH_BOX, HOVER_CELL, HOVER_GUTTER, ROW_LINE } from "@olai/ui-primitives/touch.ts"
import { clearNode } from "../focus.ts"
import type { Ghost } from "./draft.ts"
import { DraftSaid, TitleEditor } from "./RowEditor.tsx"
import { DOTS } from "../menu/Dots.tsx"

export function NewRow(props: {
  readonly line: Ghost
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
  readonly active?: boolean
  readonly onActivate?: () => void
  readonly onParkedInput?: (text: string) => void
}) {
  return (
    <div class="my-0">
      <div
        class={`${ROW_LINE} rounded-control`}
        classList={{ "bg-accent/10 ring-1 ring-accent/40": props.active !== false }}
        onFocusIn={() => clearNode()}
        data-testid={TESTID.newRow}
      >
        <span class={HOVER_GUTTER}>
          <span class="absolute inset-y-0 left-0 w-0 shrink-0 md:relative md:w-auto" aria-hidden="true">
            <span class={`${DOTS} invisible`}>•••</span>
          </span>
          <span class={HOVER_CELL} aria-hidden="true" />
        </span>
        <span class={GLYPH_BOX} aria-hidden="true">
          <span
            class={CONTROL}
            classList={{ "text-accent": props.active !== false }}
            data-testid={TESTID.newRowGlyph}
            aria-hidden="true"
          >
            <span
              class={props.active === false ? `${DOT} border-[1.5px] border-muted` : `${DOT} bg-current`}
            />
          </span>
        </span>
        <TitleEditor
          slot={{ row: props.line.slot, field: "new" }}
          text={props.line.draft.text}
          onInput={props.onInput}
          onKey={props.onKey}
          onBlur={props.onBlur}
          active={props.active}
          onActivate={props.onActivate}
          onParkedInput={props.onParkedInput}
          placeholder="New line"
          fillsLine
        />
      </div>
      <DraftSaid draft={props.line.draft} />
    </div>
  )
}
