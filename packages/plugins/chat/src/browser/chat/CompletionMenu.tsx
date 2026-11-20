import { useShown } from "olai-plugin-navigation/routing"
import { servedDirectory } from "../vault.ts"
import type { Place } from "olai-plugin-search/ui/place.ts"
import { PlaceLine } from "olai-plugin-search/ui/PlaceLine.tsx"
import { crumbMarks } from "../faces.ts"
import { createMemo, createSignal, Index, onCleanup, onMount, Show } from "solid-js"

import { listKey } from "@olai/web/client/keys.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { renderTitle, sameDrawing } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { type Completing, requiresSelection } from "./completion.ts"
import { createCompletionSelection } from "./selection.ts"
import { spend, type Taking } from "@olai/web/client/settled.ts"
import { TESTID } from "../../testids.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"

export interface MenuRow {
  readonly value: string
  readonly label: string
  readonly from?: string
  readonly hint?: string
  readonly place?: Place
  readonly section?: string
  readonly take: () => void
  readonly taking: Taking
}

function RowLabel(props: { readonly row: MenuRow }) {
  const drawing = createMemo(
    () =>
      props.row.from === undefined
        ? undefined
        : renderTitle(servedDirectory()?.claims(), props.row.label, props.row.from, {
          links: false,
        }),
    undefined,
    {
      equals: (was, now) =>
        was === undefined || now === undefined
          ? was === now
          : sameDrawing(was, now),
    },
  )
  return (
    <Show
      when={drawing()}
      fallback={<span class="font-mono">{props.row.label}</span>}
    >
      {(drawn) => <TitleHtml drawing={drawn()} />}
    </Show>
  )
}

const SECTION_WORDS: Readonly<Record<string, string>> = { files: "Files", nodes: "Rows" }

export function CompletionMenu(props: {
  readonly completing: Completing | null
  readonly rows: ReadonlyArray<MenuRow>
  readonly asked?: string
  readonly within: () => HTMLElement | undefined
  readonly onDismiss: () => void
}) {
  const shown = useShown()
  const selection = createCompletionSelection(() => props.completing, () => props.rows)

  const [focused, setFocused] = createSignal(false)
  onMount(() => {
    const input = props.within()
    if (!input) return
    const focus = () => setFocused(true)
    const blur = () => setFocused(false)
    setFocused(document.activeElement === input)
    input.addEventListener("focus", focus)
    input.addEventListener("blur", blur)
    onCleanup(() => {
      input.removeEventListener("focus", focus)
      input.removeEventListener("blur", blur)
    })
  })
  const topmost = topmostWhileOpen(() => shown() && focused())

  const take = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const accept = (event: KeyboardEvent, at: number | null) => {
    const chosen = at === null ? undefined : props.rows[at]
    if (chosen === undefined) return
    take(event)
    spend(chosen, (row) => row.take())
  }

  const onKey = (event: KeyboardEvent) => {
    if (!shown()) return
    if (event.target !== props.within()) return
    if (!topmost()) return
    if (event.key === "Tab") {
      accept(event, selection.suggested())
      return
    }
    const action = listKey(event)
    if (action === null) return
    if (action === "next") {
      take(event)
      selection.step(1)
    }
    if (action === "prev") {
      take(event)
      selection.step(-1)
    }
    if (action === "take") accept(event, selection.selected())
    if (action === "dismiss") {
      take(event)
      props.onDismiss()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onKey, true)
    onCleanup(() => document.removeEventListener("keydown", onKey, true))
  })

  return (
    <ul
      class={`absolute bottom-full left-2 right-2 ${WITHIN.pop} mb-1 max-h-64 list-none overflow-y-auto rounded-surface border border-rule/60 bg-panel p-1 shadow-raised`}
      data-testid={TESTID.chatCompletion}
      data-kind={props.completing?.kind}
      data-asked={props.asked}
    >
      <Index each={props.rows}>
        {(row, index) => (
          <>
            <Show when={row().section !== props.rows[index - 1]?.section}>
              <li
                class="px-2 pb-0.5 pt-1 text-caption uppercase tracking-wide text-muted"
                data-testid={TESTID.chatCompletionSection}
                data-section={row().section}
              >
                {SECTION_WORDS[row().section ?? ""] ?? row().section}
              </li>
            </Show>
            <li>
              <button
                type="button"
                class={`block w-full truncate rounded-control px-2 py-1 text-left text-label ${
                  index === selection.selected() ? "bg-rule" : ""
                }`}
                data-testid={TESTID.chatCompletionRow}
                data-value={row().value}
                data-active={index === selection.selected()}
                onClick={() => row().take()}
              >
                <RowLabel row={row()} />{" "}
                <span class="ml-1 text-muted">{row().hint}</span>
                {" "}<Show when={row().place}>{place => <PlaceLine claims={servedDirectory()?.claims()} place={place()} faces={crumbMarks()} />}</Show>
              </button>
            </li>
          </>
        )}
      </Index>
      <Show when={requiresSelection(props.completing)}>
        <li class="px-2 py-1 text-label text-muted">
          {selection.selected() !== null ? "Enter completes" : "↑/↓ select · Tab completes · Enter sends"}
        </li>
      </Show>
    </ul>
  )
}
