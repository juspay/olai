/**
 * THE LINE AT THE TOP OF A NOTE, as this page places it — the location's one
 * occupant, told which note it is over (`../index.ts`'s {@link noteLine}).
 *
 * Nothing contributed, nothing drawn: the row is the occupant's whole height,
 * so a page with no chat plugin running has no line and no gap where one
 * would be.
 *
 * WHAT THE NOTE IS CALLED IS NOT HANDED OVER: the occupant names it by its
 * own rule, which is the rule its page, its row and its tab already use.
 */
import { Show } from "solid-js"

import { noteLine } from "../index.ts"
import { readLocation } from "./locations.ts"

export function NoteLine(props: { readonly file: string }) {
  return <Show when={readLocation(noteLine)[0]} keyed>
    {entry => entry.value({ get path() { return props.file } })}
  </Show>
}
