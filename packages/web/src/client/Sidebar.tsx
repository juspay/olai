/**
 * The ways around the set: the month, the outlines found, and the documents.
 *
 * One entry per `.jsonl` under the served directory, one per `.md` below them,
 * and above both whatever the app puts in the slot — the month of the whole
 * set's dated nodes. They sit in that order because they are axes over the same
 * directory rather than a list and an ornament beside it: the outlines are
 * where a node is written, the month is when — and the month is the one whose
 * length is fixed, so a long directory never pushes it off the screen.
 *
 * The documents are a list of their own rather than entries under the nodes
 * that attach them, because most of them are attached by nothing: a `.md` in
 * the directory is a file somebody put there to read, and the sidebar is what
 * says the directory holds it. A node's own `doc` is drawn on the node.
 *
 * A SLOT rather than the calendar's own inputs threaded through: what the
 * month needs is the month's business, and a sidebar that declared three props
 * it never reads would be a sidebar whose signature was a function of a
 * child's needs rather than of what it draws.
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

import type { BrokenFile, Document } from "@olai/format"
import { For, type JSX, Show } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly documents: ReadonlyArray<Document>
  /** The file the open page is of, in whichever of the two lists it is in. */
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** What sits above the list: the month. */
  readonly children?: JSX.Element
}) {
  return (
    // Below 48rem there is no second column to be, so it is a HEADER: full
    // width, above the outline, capped at 42dvh and scrolling inside itself.
    // Capped rather than left to grow because a directory of thirty outlines
    // would otherwise be a whole screen a reader has to scroll past to reach
    // what they opened; a header they can scroll THROUGH keeps both axes one
    // gesture away and the outline visible under it.
    //
    // No drawer, no overlay, no toggle: those need a state, a backdrop, a
    // focus trap and a way to close, and all of it exists to hide something
    // that fits. This is the smallest thing that is honest about the space.
    <nav class="max-h-[42dvh] overflow-y-auto border-b border-rule p-4 md:max-h-none md:border-b-0 md:border-r">
      <h1 class="m-0 mb-4 text-base uppercase tracking-widest text-muted">olai</h1>
      {props.children}
      <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
        <For each={props.files}>
          {(file) => (
            <li class="mb-1">
              <Link
                route={{ kind: "outline", file }}
                // A row a finger aims at (./touch.ts), back to a line of text
                // where the pointer is a mouse.
                class={`flex ${TARGET} items-center break-all rounded px-2 py-1 text-sm no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent aria-[current=page]:text-paper md:block md:min-h-0`}
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

      <Show when={props.documents.length > 0}>
        <h2 class="mt-4 mb-1 px-2 text-[0.6875rem] uppercase tracking-widest text-muted">
          Documents
        </h2>
        <ul class="m-0 list-none p-0" data-testid={TESTID.documentList}>
          <For each={props.documents}>
            {(document) => (
              <li class="mb-1">
                <Link
                  route={{ kind: "document", file: document.file }}
                  // The same row an outline gets, for the same reason: a
                  // finger aims at both (./touch.ts).
                  class={`flex ${TARGET} items-center break-all rounded px-2 py-1 text-sm no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent aria-[current=page]:text-paper md:block md:min-h-0`}
                  testid={TESTID.documentLink}
                  current={props.active === document.file}
                >
                  {document.file}
                </Link>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </nav>
  )
}
