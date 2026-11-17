/**
 * THE LINE AT THE TOP OF A NOTE, as this page places it — the location's one
 * occupant, told which note it is over and what that note is called
 * (`../index.ts`'s {@link noteLine}).
 *
 * Nothing contributed, nothing drawn: the row is the occupant's whole height,
 * so a page with no chat plugin running has no line and no gap where one
 * would be.
 *
 * THE NAME IS THE DIRECTORY'S WORD for the file (`plan` for `notes/plan.md`),
 * the same word the sidebar and every list use. Before the claim table has
 * arrived the file's last segment is handed over instead, which is the honest
 * answer rather than a guess at what a suffix means.
 */
import { Show } from "solid-js"
import { nameOf } from "@olai/format"

import { noteLine } from "../index.ts"
import { readLocation } from "./locations.ts"
import { servedDirectory } from "./vault.ts"

export function NoteLine(props: { readonly file: string }) {
  const name = () => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? props.file.slice(props.file.lastIndexOf("/") + 1) : nameOf(claims, props.file)
  }
  return <Show when={readLocation(noteLine)[0]} keyed>
    {entry => entry.value({ get path() { return props.file }, get name() { return name() } })}
  </Show>
}
