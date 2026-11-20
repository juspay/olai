import { servedDirectory } from "../vault.ts"
import { For, Show } from "solid-js"

import { GLYPH, SAID } from "olai-plugin-outlines/changes"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { Moved } from "./Moved.tsx"
import { type Group, HOW, HOW_TONE, localOf } from "./said.ts"
import type { Selection } from "./selection.ts"
import { TESTID } from "../../testids.ts"
import { Tick } from "./Tick.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"

export function Outlines(props: {
  readonly groups: ReadonlyArray<Group>
  readonly served: string
  readonly selection: Selection
}) {
  return (
    <For each={props.groups}>
      {({ outline, changes }) => (
        <div
          data-testid={TESTID.commitGroup}
          data-file={outline.file}
          data-path={outline.path}
          data-from={outline.from ?? undefined}
          class={props.selection.ticked(outline.path) ? "" : "opacity-40"}
        >
          <p class="flex items-baseline gap-2">
            <Tick
              path={outline.path}
              ticked={props.selection.ticked(outline.path)}
              toggle={() => props.selection.toggle(outline.path)}
              label={`Commit ${outline.path}`}
            />
            <Moved from={localOf(outline.from, props.served)} />
            <span class="min-w-0 truncate font-mono text-label text-muted">
              {outline.file}
            </span>
            <Show when={outline.how !== "modified"}>
              <span class={`ml-auto shrink-0 text-label ${HOW_TONE[outline.how]}`}>
                {HOW[outline.how]}
              </span>
            </Show>
          </p>
          <ul class="pl-5">
            <For each={changes}>
              {(change) => (
                <li
                  class="flex items-baseline gap-2 py-0.5"
                  data-testid={TESTID.commitChange}
                  data-node-id={change.id}
                  data-sort={change.sort}
                >
                  <Tip text={change.fields.join(", ")} disabled={change.fields.length === 0}>
                    <span class="w-3 shrink-0 text-muted" aria-hidden="true">
                      {GLYPH[change.sort]}
                    </span>
                    <span class="min-w-0 truncate">
                      <TitleHtml drawing={renderTitle(servedDirectory()?.claims(), change.title, change.file)} />
                    </span>
                    <span class="ml-auto shrink-0 text-label text-muted">
                      {SAID[change.sort]}
                    </span>
                    <Show when={change.fields.length > 0}>
                      <span class="sr-only">{change.fields.join(", ")}</span>
                    </Show>
                  </Tip>
                </li>
              )}
            </For>
          </ul>
        </div>
      )}
    </For>
  )
}
