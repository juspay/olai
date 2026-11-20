import { TESTID } from "olai-plugin-csv/testids"
import { csvTable } from "@olai/format"
import { createEffect, createSignal, onCleanup, createMemo, createUniqueId, Index, Show } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { WITHIN } from "@olai/web/client/layer.ts"

import { BodyRefused } from "olai-plugin-markdown/body-refused"
import { clampSaid } from "./clamped.ts"
import { Effect } from "effect"
import type { Body } from "olai-plugin-vault/surface"
import { servedDirectory } from "./vault.ts"

export function Csv(props: { readonly file: string }) {
  const [served, setServed] = createSignal<Body>()
  createEffect(() => {
    const directory = servedDirectory()
    const file = props.file
    const revision = directory?.head(() => file)()
    if (directory === undefined || revision === undefined) { setServed(undefined); return }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void Effect.runPromise(directory.body(file), { signal: controller.signal }).then(
      body => { if (!controller.signal.aborted) setServed(body) },
      () => { if (!controller.signal.aborted) setServed({ text: null, refused: true }) },
    )
  })
  const table = createMemo(() => {
    const entry = served()
    return entry !== undefined && !entry.refused && entry.text !== null ? csvTable(entry.text) : null
  })
  const said = () => {
    const read = table()
    return read === null ? null : clampSaid(read)
  }
  const header = () => table()?.rows[0]
  const body = () => table()?.rows.slice(1) ?? []
  const caption = createUniqueId()

  return (
    <>
      <Show when={served()?.refused}>
        <BodyRefused />
      </Show>
      <Show when={table()}>
        {(read) => (
          <>
            <Show when={read().rows.length > 0}>
              <div
                tabindex={0}
                role="region"
                aria-labelledby={caption}
                data-testid={TESTID.csvScroller}
                class="max-h-[min(32rem,80vh)] overflow-auto"
              >
                <table
                  class="w-max border-separate border-spacing-0 text-body"
                  data-testid={TESTID.csvTable}
                >
                  <caption id={caption} class="sr-only">{props.file}</caption>
                  <thead class={`sticky top-0 ${WITHIN.raised} bg-paper`}>
                    <tr>
                      <Index each={header() ?? []}>
                        {(cell) => (
                          <th scope="col" class="border-b border-muted bg-rule/40 px-2 py-1 text-left align-top font-semibold whitespace-pre">
                            {cell()}
                          </th>
                        )}
                      </Index>
                    </tr>
                  </thead>
                  <tbody>
                    <Index each={body()}>
                      {(row) => (
                        <tr>
                          <Index each={row()}>
                            {(cell) => (
                              <td class="border-b border-rule px-2 py-1 text-left align-top whitespace-pre">
                                {cell()}
                              </td>
                            )}
                          </Index>
                        </tr>
                      )}
                    </Index>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show when={said()}>
              {(one) => (
                <SaidLine
                  said={one()}
                  class="mt-2 mb-0 text-body"
                  testid={TESTID.csvClamp}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </>
  )
}
