import { PLUGIN_BROWSER_FILE, PLUGIN_README_FILE, PLUGIN_SERVER_FILE } from "@olai/surface"
import { createMemo, createSignal, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { diffLines, type Line } from "../diff.ts"
import type { Defined } from "../state.ts"

type Source = Defined["source"]

interface Choice {
  readonly file: string
  readonly text: string
  readonly was: string | undefined
}

const choicesOf = (source: Source, diffing: boolean): ReadonlyArray<Choice> => [
  ...(source.readme === undefined ? [] : [{ file: PLUGIN_README_FILE, text: source.readme, was: undefined }]),
  { file: PLUGIN_SERVER_FILE, text: source.server, was: diffing ? source.approvedServer : undefined },
  ...(source.browser === undefined ? [] : [{ file: PLUGIN_BROWSER_FILE, text: source.browser, was: diffing ? source.approvedBrowser : undefined }]),
]

const firstOf = (choices: ReadonlyArray<Choice>): string =>
  choices.find((one) => one.was !== undefined)?.file
    ?? choices.find((one) => one.file === PLUGIN_SERVER_FILE)?.file
    ?? choices[0]?.file ?? PLUGIN_SERVER_FILE

export function Code(props: {
  readonly source: Source
  readonly at?: string
  readonly diffing?: boolean
}) {
  const choices = createMemo(() => choicesOf(props.source, props.diffing === true))
  const [picked, pick] = createSignal<string>()
  const shown = createMemo(() =>
    choices().find((one) => one.file === picked())
      ?? choices().find((one) => one.file === props.at)
      ?? choices().find((one) => one.file === firstOf(choices()))
      ?? choices()[0])
  return (
    <div class="overflow-hidden rounded-control border border-line/60" data-testid={TESTID.pageCode} data-file={shown()?.file}>
      <div class="flex items-center gap-1 border-b border-line/60 bg-desk px-2 py-1" role="tablist" aria-label="Which file to read">
        <For each={choices()}>
          {(one) => (
            <button
              type="button"
              role="tab"
              aria-selected={shown()?.file === one.file}
              data-testid={TESTID.pageCodeTab}
              data-file={one.file}
              class="rounded-control px-2 py-0.5 text-label text-muted hover:text-ink aria-selected:bg-ink/8 aria-selected:font-medium aria-selected:text-ink"
              onClick={() => pick(one.file)}
            >
              {one.file}
            </button>
          )}
        </For>
        <span class="ml-auto truncate font-mono text-caption text-muted" data-testid={TESTID.pageFolder}>{props.source.folder}</span>
      </div>
      <Show when={shown()}>
        {(one) => (
          <Show
            when={one().was}
            fallback={<pre class="m-0 max-h-[28rem] overflow-auto px-3 py-2 font-mono text-label leading-relaxed">{one().text}</pre>}
          >
            {(was) => <Diff before={was()} after={one().text} />}
          </Show>
        )}
      </Show>
    </div>
  )
}

function Diff(props: { readonly before: string; readonly after: string }) {
  const lines = createMemo(() => diffLines(props.before, props.after))
  return (
    <pre class="m-0 max-h-[28rem] overflow-auto py-2 font-mono text-label leading-relaxed" data-testid={TESTID.pageDiff}>
      <For each={lines()}>
        {(line) => (
          <span class={`block px-3 ${PAINT[line.kind]}`} data-line={line.kind}>
            {line.kind === "del" ? "-" : line.kind === "add" ? "+" : " "}
            {line.text}
          </span>
        )}
      </For>
    </pre>
  )
}

const PAINT: { readonly [K in Line["kind"]]: string } = {
  same: "text-muted",
  del: "bg-alarm/10 text-alarm",
  add: "bg-done/10 text-ink",
}
