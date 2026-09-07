/** Journal supplies dates; outlines supplies its row rendering through its owned location. */
import { For } from "solid-js"
import { readLocation } from "../locations.ts"
import { datedRows, type DatedRowProps } from "olai-plugin-outlines/contract"
export function DayNode(props: DatedRowProps) {
 return <For each={readLocation(datedRows)}>{entry => entry.value(props)}</For>
}
