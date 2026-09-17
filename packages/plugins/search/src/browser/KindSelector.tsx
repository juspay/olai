import { For } from "solid-js"
import { type Claims } from "@olai/format"
import type { Search } from "../contracts/reading.ts"
import type { Kind, KindPick } from "../contracts/box.ts"

const choicesFor = (claims: Claims): ReadonlyArray<{ readonly value: Kind; readonly label: string }> => {
  const categories = new Set([...claims.byKind.values()].map(claim => claim.holds === "nodes" ? "node" : "file"))
  return [
    { value: undefined, label: "All" },
    ...(categories.has("node") ? [{ value: "node" as const, label: "Nodes" }] : []),
    ...(categories.has("file") ? [{ value: "file" as const, label: "Files" }] : []),
  ]
}
export const cycleKind = (claims: Claims, state: KindPick): void => {
  const choices = choicesFor(claims)
  const index = choices.findIndex(choice => choice.value === state.pick())
  state.set(choices[(index + 1) % choices.length]!.value)
}

export function KindSelector(props: { readonly claims: () => Claims; readonly state: KindPick; readonly search: Search }) {
  const count = (kind: Kind) => {
    if (props.search.answering() === null) return undefined
    const picked = props.state.pick()
    if (picked !== undefined) return picked === kind ? props.search.total() : undefined
    return kind === undefined ? props.search.total() : props.search.totals()?.[kind]
  }
  return <div role="radiogroup" aria-label="Search kind" class="flex gap-1 px-3 py-2">
    <For each={choicesFor(props.claims())}>{choice => <button type="button" role="radio" aria-checked={props.state.pick() === choice.value}
      aria-label={choice.label} tabIndex={-1}
      class={`rounded px-3 py-1 text-xs ${props.state.pick() === choice.value ? "bg-rule text-ink" : "text-muted hover:bg-rule/60"}`}
      onMouseDown={event => event.preventDefault()} onClick={() => props.state.set(choice.value)}>
      {choice.label}{" "}<span hidden={count(choice.value) === undefined} class="ml-2 font-mono text-[0.6875rem]">{count(choice.value)}</span>
    </button>}</For>
  </div>
}
