/**
 * The two ways around the set: the month, and the outlines found.
 *
 * One entry per `.jsonl` under the served directory, and above them a calendar
 * of the whole set's dated nodes. They sit in that order because they are two
 * axes over the same files rather than a list and an ornament beside it: the
 * outlines are where a node is written, the month is when — and the month is
 * the one whose length is fixed, so a long directory never pushes it off the
 * screen.
 *
 * It is the only navigation that is always on screen, so a zoomed page can go
 * as deep as it likes: the crumbs walk up within an outline, and this walks
 * out of one.
 *
 * The entry that lights up is the outline the OPEN PAGE lives in — for a
 * zoomed node, the file of the canonical record, which is not something the
 * URL says (see ./page.ts). A day page lights none: a day crosses every
 * outline, and the calendar is where it says which day it is. An entry is
 * marked when its file could not be read: the rest of the directory is still
 * live, and which one is broken is something a reader should be able to see
 * without opening it.
 */

import type { BrokenFile } from "@olai/format"
import { For, Show } from "solid-js"

import { Calendar } from "./calendar/Calendar.tsx"
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly today: string
  /** The day the open page is of, if it is one. */
  readonly openDay: string | undefined
  readonly datedDays: (month: string) => ReadonlySet<string>
}) {
  return (
    <nav class="overflow-y-auto border-r border-rule p-4">
      <h1 class="m-0 mb-4 text-base uppercase tracking-widest text-muted">olai</h1>
      <Calendar today={props.today} open={props.openDay} days={props.datedDays} />
      <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
        <For each={props.files}>
          {(file) => (
            <li class="mb-1">
              <Link
                route={{ kind: "outline", file }}
                class="block break-all rounded px-2 py-1 text-sm no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent aria-[current=page]:text-paper"
                testid={TESTID.outlineLink}
                current={props.active === file}
                broken={props.broken.has(file)}
              >
                {file}
                <Show when={props.broken.has(file)}>
                  <span class="ml-1 text-alarm" title="this file could not be read">
                    ⚠
                  </span>
                </Show>
              </Link>
            </li>
          )}
        </For>
      </ul>
    </nav>
  )
}
