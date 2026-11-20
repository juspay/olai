import { TESTID } from "olai-plugin-search/testids"
import { Show } from "solid-js"


import { countLine } from "olai-plugin-search/ui/count.ts"
import type { Search } from "olai-plugin-search/reading"

export function SearchCount(props: {
  readonly of: Pick<Search, "hits" | "total">
  readonly class?: string
  readonly empty?: boolean
}) {
  const said = () =>
    countLine({ drawn: props.of.hits().length, total: props.of.total() }) ??
    (props.empty && props.of.total() === 0 ? "No matches" : undefined)
  return (
    <Show when={said()}>
      {(line) => (
        <p class={props.class} data-testid={TESTID.searchCount}>{line()}</p>
      )}
    </Show>
  )
}
