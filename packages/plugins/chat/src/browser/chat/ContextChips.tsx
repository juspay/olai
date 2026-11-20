import { servedDirectory } from "../vault.ts"
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { TESTID } from "../../testids.ts"
import { Reference } from "./Reference.tsx"

export interface Chip {
  readonly id: string
  readonly title: string
}

export function ContextChips(props: {
  readonly nodes: ReadonlyArray<Chip>
  readonly onRemove?: (id: string) => void
}) {
  return (
    <Show when={props.nodes.length > 0}>
      <ul class="mb-1 flex flex-wrap gap-1" data-testid={TESTID.chatContext}>
        <Key each={props.nodes} by="id">
          {(node) => (
            <li
              class="flex max-w-full items-center gap-1 rounded-control border border-accent/40 bg-paper px-1.5 py-0.5 text-caption"
              data-testid={TESTID.chatContextChip}
              data-node={node().id}
            >
              <span class="text-muted" aria-hidden="true">◦</span>
              <Reference id={node().id} class="min-w-0 truncate">
                <TitleHtml
                  drawing={renderTitle(servedDirectory()?.claims(), node().title, "", { links: false })}
                />
              </Reference>
              <Show when={props.onRemove}>
                {(remove) => (
                  <button
                    type="button"
                    class="shrink-0 text-muted hover:text-alarm"
                    aria-label={`Send without ${node().title}`}
                    data-testid={TESTID.chatContextRemove}
                    onClick={() => remove()(node().id)}
                  >
                    ×
                  </button>
                )}
              </Show>
            </li>
          )}
        </Key>
      </ul>
    </Show>
  )
}
