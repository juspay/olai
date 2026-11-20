import { TESTID } from "olai-plugin-outlines/testids"
import { createMemo, type JSX, Match, Show, Switch } from "solid-js"

import { createConfirming } from "@olai/web/client/confirming.ts"

import { LAYER } from "@olai/web/client/layer.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"

import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { trashQuestion } from "olai-plugin-trash/questions"
import { archivable } from "./bulk.ts"
import { useSelection } from "./selection.ts"

function Pill(props: {
  readonly testid: TestId
  readonly onPress: () => void
  readonly children: JSX.Element
}) {
  return (
    <button
      type="button"
      class={`${QUIET_PILL} cursor-pointer`}
      data-testid={props.testid}
      onClick={() => props.onPress()}
    >
      {props.children}
    </button>
  )
}

export function SelectionBar() {
  const selection = useSelection()


  const rows = () => selection.rows()

  const confirm = createConfirming(() => rows().map((row) => row.key).join(" "))

  const hanging = createMemo(() =>
    rows().reduce((count, row) => count + row.under, 0)
  )

  const trash = () => {
    confirm.drop()
    selection.run("trash")
  }

  return (
    <Show when={rows().length > 0 || selection.said() !== null}>
      <div
        class={`pointer-events-none fixed inset-x-0 bottom-4 ${LAYER.chrome} flex justify-center px-4`}
        data-testid={TESTID.selectionBar}
        data-rows={String(rows().length)}
      >
        <div class="pointer-events-auto flex max-w-xl flex-col gap-1 rounded-surface border border-rule bg-panel px-3 py-2 text-body leading-snug shadow-raised">
          <Show when={rows().length > 0}>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-muted" data-testid={TESTID.selectionCount}>
                {rows().length === 1 ? "1 row selected" : `${rows().length} rows selected`}
              </span>
              <Switch>
                <Match when={!archivable(rows())}>
                  <span class="text-muted" data-testid={TESTID.selectionNote}>
                    A mirrored row is selected. Remove it from its own ••• menu.
                  </span>
                </Match>
                <Match when={confirm.where() === "asking"}>
                  <span data-testid={TESTID.selectionConfirm}>
                    {trashQuestion({ kind: "rows", count: rows().length }, hanging())}
                  </span>
                  <Pill testid={TESTID.selectionTrash} onPress={trash}>
                    Move to Trash
                  </Pill>
                  <Pill testid={TESTID.selectionCancel} onPress={() => confirm.drop()}>
                    Cancel
                  </Pill>
                </Match>
                <Match when={true}>
                  <Pill testid={TESTID.selectionTrash} onPress={() => confirm.ask()}>
                    Move to Trash
                  </Pill>
                </Match>
              </Switch>
              <span class="text-muted">Esc to clear</span>
            </div>
          </Show>
          <Show when={selection.said()}>
            {(said) => (
              <SaidLine said={said()} class="m-0" testid={TESTID.selectionSaid} />
            )}
          </Show>
        </div>
      </div>
    </Show>
  )
}
