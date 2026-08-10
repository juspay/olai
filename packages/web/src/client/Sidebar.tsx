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
 * It is the only navigation there is, so a zoomed page can go as deep as it
 * likes: the crumbs walk up within an outline, and this walks out of one. On a
 * phone it is one row until the burger is pressed — see the comment on the
 * `<nav>` for why that beats the capped header it replaces. Below the lists is where the app's own chrome lives — the
 * connection dot and the agent toggle — because those two are about the APP
 * rather than about the page, and a pill fixed to the corner of the viewport is
 * a pill on top of whatever is being read.
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
import { createSignal, For, type JSX, Show } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { TARGET, TARGET_BOX } from "./touch.ts"

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly documents: ReadonlyArray<Document>
  /** The file the open page is of, in whichever of the two lists it is in. */
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** What sits above the list: the month. */
  readonly children?: JSX.Element
  /** What sits BELOW both lists: the chrome that belongs to the app rather than
   *  to the page — is the server still there, and open the agent. A slot for
   *  the same reason the month is one, and because these two have a second
   *  home: the screens with no sidebar draw them in a corner instead (see
   *  `App.tsx`). */
  readonly footer?: JSX.Element
}) {
  const [open, setOpen] = createSignal(false)

  return (
    // Below 48rem there is no second column to be, so it is a HEADER above the
    // outline — and behind a BURGER, because everything in it has to fit on a
    // screen 390 points wide and the reader is usually not looking for any of
    // it. A capped, always-open header was the first answer and it was worse
    // in both directions: it took a third of the screen from the outline to
    // show a list nobody had asked for, and the one control that HAS to be
    // reachable — the way into the agent — was somewhere down inside a strip
    // that scrolled. Shut, this is one row and the outline has the rest;
    // open, it is the whole sidebar, chrome and all.
    //
    // Above 48rem none of that applies: there is a column, everything is in
    // it, and the burger is not drawn.
    <nav
      class="overflow-y-auto border-b border-rule p-4 md:max-h-none md:border-b-0 md:border-r"
      data-testid={TESTID.sidebar}
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class={`${TARGET_BOX} -ml-2 inline-flex items-center justify-center rounded text-muted hover:text-ink md:hidden`}
          data-testid={TESTID.sidebarToggle}
          data-open={open()}
          aria-expanded={open()}
          aria-label={open() ? "hide the sidebar" : "show the sidebar"}
          onClick={() => setOpen(!open())}
        >
          <span aria-hidden="true" class="text-lg leading-none">☰</span>
        </button>
        <h1 class="m-0 text-base uppercase tracking-widest text-muted">olai</h1>
      </div>

      {/* Everything else. Hidden below 48rem until the burger is pressed, and
          capped when it is so the outline it is a header FOR is still on
          screen under it. Any tap inside SHUTS it: every control in here
          either goes somewhere or opens something over it, and a panel left
          standing on top of what you just asked for is a second tap the
          reader did not ask to make. */}
      <div
        class={`${open() ? "max-h-[42dvh] overflow-y-auto" : "hidden"} mt-4 md:mt-4 md:block md:max-h-none md:overflow-visible`}
        data-testid={TESTID.sidebarBody}
        onClick={() => setOpen(false)}
      >
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

        <Show when={props.footer}>
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
            {props.footer}
          </div>
        </Show>
      </div>
    </nav>
  )
}
