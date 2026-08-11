/**
 * A title, printed.
 *
 * Tags live inline in the title verbatim — the format stores no tag list — so
 * the split into text and tags happens at view time, and it happens HERE: a
 * tree row and a zoomed page's heading are the same title in two type sizes,
 * and two copies of this loop would be two chances for one of them to eat the
 * `#` or to style a tag the other did not.
 *
 * Decorative for now. Clicking a tag becomes a filter when the filter
 * machinery exists (docs/brainstorming/viewing-web.md); until then styling one
 * as a link would promise something nothing answers.
 */

import { titleParts } from "@olai/format"
import { For } from "solid-js"

import { TESTID } from "./testids.ts"

export function NodeTitle(props: { readonly title: string }) {
  return (
    <For each={titleParts(props.title)}>
      {(part) =>
        part.kind === "tag"
          ? (
            <span
              class="mx-0.5 inline-block max-w-full rounded-sm bg-accent/15 px-1 py-px text-[0.8125rem] font-normal leading-snug text-accent"
              data-testid={TESTID.tag}
            >
              #{part.tag}
            </span>
          )
          : <>{part.text}</>}
    </For>
  )
}
