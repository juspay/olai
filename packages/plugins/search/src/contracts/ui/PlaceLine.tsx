/** The shared place drawing, including chat and title completions. */
import type { Claims } from "@olai/format"
import { Show } from "solid-js"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import type { Place } from "./place.ts"

/** Preserve both spaces even at the start of a flex item. */
const Separator = () => <span data-place="separator" class="whitespace-pre">{" · "}</span>

export function PlaceLine(props: {
  readonly claims: Claims | undefined; readonly place: Place; readonly testid?: string }) {
  return <span class="flex w-full min-w-0 overflow-hidden font-mono text-[0.6875rem] text-muted" data-testid={props.testid}>
    <span class="shrink-0" data-place="file">{props.place.file}</span>
    <Show when={props.place.middle}>{middle => <span class="min-w-0 truncate" data-place="middle"><Separator /><TitleHtml drawing={renderTitle(props.claims, middle(), "", { links: false })} /></span>}</Show>
    <Show when={props.place.nearest}>{nearest => <span class="max-w-[45%] shrink-0 truncate" data-place="nearest"><Separator /><TitleHtml drawing={renderTitle(props.claims, nearest(), "", { links: false })} /></span>}</Show>
  </span>
}
