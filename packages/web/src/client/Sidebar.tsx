/**
 * The outlines found, and the way home.
 *
 * One entry per `.jsonl` under the served directory. It is the only navigation
 * that is always on screen, so a zoomed page can go as deep as it likes: the
 * crumbs walk up within an outline, and this walks out of one.
 *
 * The entry that lights up is the outline the OPEN PAGE lives in — for a
 * zoomed node, the file of the canonical record, which is not something the
 * URL says (see ./page.ts).
 */

import { For } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly active: string | undefined
}) {
  return (
    <nav class="overflow-y-auto border-r border-rule p-4">
      <h1 class="m-0 mb-4 text-base uppercase tracking-widest text-muted">olai</h1>
      <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
        <For each={props.files}>
          {(file) => (
            <li class="mb-1">
              <Link
                route={{ kind: "outline", file }}
                class="block break-all rounded px-2 py-1 text-sm no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent aria-[current=page]:text-paper"
                testid={TESTID.outlineLink}
                current={props.active === file}
              >
                {file}
              </Link>
            </li>
          )}
        </For>
      </ul>
    </nav>
  )
}
