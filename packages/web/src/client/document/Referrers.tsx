/**
 * WHAT POINTS AT THIS DOCUMENT, under its heading — the reverse reading a
 * `.md` could not have.
 *
 * Every reference points ONE WAY on disk: a node writes `doc: notes/plan.md`,
 * a note writes `[the plan](notes/plan.md)`, another document links it in its
 * prose — and the plan's own file says nothing about any of them. A node's page
 * has had the reverse since `../backlinks/Backlinks.tsx`; a document's could
 * not, because a document had no identity below the file and nothing carried
 * what a file points AT (docs/brainstorming/first-class-documents.md).
 *
 * It does now: every document travels with its FACE, and a face carries the
 * addresses its content points at (`@olai/format`'s `Face`). So this is a
 * lookup over the faces the tab is already holding — no walk of the corpus, no
 * body fetched, and nothing asked of the server that was not already on its
 * way.
 *
 * TWO KINDS OF ROW, because there are two kinds of referrer and they are not
 * the same claim (`@olai/format`'s `referrersTo`): a RECORD that attached this
 * document or linked it in its prose, drawn as the node it is and opening its
 * page; and a DOCUMENT whose body links here, drawn as the file it is. Saying
 * "house.olai points here" where the honest answer is "the node `kitchen`
 * attaches it" would be the coarser answer offered because it was the easier
 * one.
 *
 * THE WHOLE FILE is what it asks about, never one heading of it: what points
 * at `README.md#install` is pointing at this document, and a section that
 * split the two would answer half the question twice (`referrersTo` reads it
 * that way round).
 *
 * COLLAPSED, and the collapse is the browser's — a `<details>`, the shape
 * `./Toc.tsx` and the node's own backlinks already use — for that section's
 * reason exactly: a reference is context rather than content, and a document
 * everything in the vault points at would otherwise open with a wall of links
 * above its own first line. The rows are not built while it is shut, which the
 * element alone does not give.
 */

import type { Referrer } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, Show } from "solid-js"

import { only } from "../narrow.ts"
import { useReading } from "../reading.tsx"
import { atFile, atNode, hrefOf, type Route } from "../routes.ts"
import { TESTID } from "../testids.ts"

export function Referrers(props: {
  /** The document this page is about — read for the KEY below rather than for
   *  a lookup: who points here rides on the page's own reading, which is a
   *  reading OF this file. */
  readonly file: string
}) {
  const reading = useReading()
  const found = createMemo(() => {
    const shows = reading()?.shows
    // A page whose reading has not arrived draws no section rather than
    // waiting, which is the same nothing the `<Show>` below already means.
    return (shows === undefined ? undefined : only(shows, "document")?.referrers) ?? []
  })

  // KEYED ON THE FILE, for the reason the node's section is keyed on its node:
  // `open` is an attribute the browser then owns, so a page reused from one
  // document to another would carry the reader's answer about the first onto
  // the second.
  return (
    <Show when={found().length > 0 ? props.file : undefined} keyed>
      <Section found={found()} />
    </Show>
  )
}

/**
 * The section itself, its own component so the open state is MINTED WITH IT: a
 * signal one level up would outlive the keyed block and carry one document's
 * answer onto the next, which is what the key is for.
 */
function Section(props: { readonly found: ReadonlyArray<Referrer> }) {
  const [open, setOpen] = createSignal(false)
  return (
    <details
      class="mt-6 border-t border-rule pt-2"
      data-testid={TESTID.documentReferrers}
      data-count={props.found.length}
      // The element's own state, read back rather than commanded: `<details>`
      // opens itself on a press, on a keyboard activation and on a browser's
      // find-in-page.
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        class="cursor-pointer text-sm text-muted select-none"
        data-testid={TESTID.documentReferrersSummary}
      >
        {said(props.found.length)}
      </summary>
      <Show when={open()}>
        <ul class="m-0 mt-2 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
          {/* `<Key>`, not `<For>`: this list rides on the page's reading, and
              every frame the page publishes replaces every element of that
              array with a fresh object (../NodeRefs.tsx says it in full). A
              `<For>` keys by reference, so an open section rebuilt every row
              on every frame — under a reader's pointer, mid-scroll. */}
          <Key each={props.found} by={keyOf}>
            {(one) => (
              <li class="min-w-0">
                <a
                  class="text-sm text-accent no-underline hover:underline"
                  data-testid={TESTID.documentReferrer}
                  href={hrefOf(opens(one()))}
                >
                  {calls(one())}
                </a>
                {/* WHERE it was written, muted beside it — a title in a list of
                    strangers means nothing, and for a record it is the outline
                    the reference is in. A document's own row says the file
                    twice otherwise, so it says it once. */}
                <Show when={one().at !== undefined}>
                  <span class="ml-1 font-mono text-xs text-muted">{one().face.path}</span>
                </Show>
              </li>
            )}
          </Key>
        </ul>
      </Show>
    </details>
  )
}

/**
 * WHAT IDENTIFIES A ROW, for the key above — the record that wrote the
 * reference, or the document whose own body did.
 *
 * The two arms are two namespaces and the key says which, because that is the
 * only spelling that is honest without a second belief: a path and a node id
 * are both strings, `referrersTo` walks each document once and each of its
 * records once, and a key that collided would hand one element to the
 * framework twice — the crash `../edges/named.ts` argues at length.
 */
const keyOf = (one: Referrer): string =>
  one.at === undefined ? `doc:${one.face.path}` : `node:${one.at.node.id}`

/** Where a row OPENS: the record, or the document itself. */
const opens = (one: Referrer): Route =>
  one.at === undefined ? atFile(one.face.path) : atNode(one.at.node.id)

/** ...and what it is CALLED there — the same division, drawn. */
const calls = (one: Referrer): string =>
  one.at === undefined ? one.face.title : one.at.node.title

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says. */
const said = (total: number): string =>
  `Referred to by ${total} ${total === 1 ? "thing" : "things"}`
