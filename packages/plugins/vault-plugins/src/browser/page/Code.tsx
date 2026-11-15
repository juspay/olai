/**
 * **The code** — the three files, read-only, under the folder they live in.
 *
 * ## Why the source is on the page at all
 *
 * Because this is the one screen in olai where a person decides about CODE
 * rather than about a setting, and the code will run with the server's whole
 * authority. A page that asked somebody to approve a content hash would be
 * asking them to approve something they cannot see. So the decision is made in
 * front of the thing being decided about — *Read it, or don't. It is all here.*
 *
 * It is a long way down the page and that is deliberate: *What it does* and
 * *What it uses* come first, because they are the questions a person actually
 * has, and the source is one scroll further for whoever wants it.
 *
 * ## ...and why a PAUSED plugin gets a diff instead
 *
 * Approving once is not approving whatever the plugin becomes, so an edit to
 * approved code pauses it and asks again — but *asks again* must not mean *read
 * all of it again*. The person already read this file and said yes to it; what
 * is new is the lines that moved. Re-presenting the whole file would be asking
 * a question whose answer it already has, and that is how a careful gesture
 * becomes a reflex. `../diff.ts` is the walk; this draws it.
 *
 * ## No highlighter
 *
 * The body is a `<pre>` of the file's own characters. Colouring it would mean
 * this row carrying a TypeScript tokenizer into the browser chunk to decorate
 * a block somebody reads once per approval — the bytes are better spent on the
 * markdown pipeline the README is already rendered through.
 */

import { PLUGIN_BROWSER_FILE, PLUGIN_README_FILE, PLUGIN_SERVER_FILE } from "@olai/surface"
import { createMemo, createSignal, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { diffLines, type Line } from "../diff.ts"
import type { Defined } from "../state.ts"

type Source = Defined["source"]

/** One choice in the strip: which file, its text, and the approved text where
 *  this view is a diff and the file has an approved version to differ from. */
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

/** Which file opens first. On a paused plugin it is the half that MOVED — the
 *  only reason this block is being looked at — and otherwise the server half,
 *  which every plugin has. */
const firstOf = (choices: ReadonlyArray<Choice>): string =>
  choices.find((one) => one.was !== undefined)?.file
    ?? choices.find((one) => one.file === PLUGIN_SERVER_FILE)?.file
    ?? choices[0]?.file ?? PLUGIN_SERVER_FILE

export function Code(props: {
  readonly source: Source
  /** Draw the chosen file as a diff against the approved version — the paused
   *  plugin, and nothing else. */
  readonly diffing?: boolean
}) {
  const choices = createMemo(() => choicesOf(props.source, props.diffing === true))
  const [picked, pick] = createSignal<string>()
  const shown = createMemo(() =>
    choices().find((one) => one.file === picked()) ?? choices().find((one) => one.file === firstOf(choices())) ?? choices()[0])
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
        {/* WHERE IT IS ON DISK, beside the strip rather than in a sentence
            under it: the folder is the plugin, and somebody who wants to open
            these three in their own editor should not have to read a paragraph
            to find out where they are. */}
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
            {/* The sign is a character of the line rather than a decoration,
                so a reader who copies the block out gets a patch-shaped thing
                and a screen reader hears which side a line is on. */}
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
