/**
 * WHAT POINTS AT THIS DOCUMENT, under its heading — the reverse reading a
 * `.md` could not have.
 *
 * Every reference points ONE WAY on disk: a node writes `doc: notes/plan.md`,
 * a note writes `[the plan](notes/plan.md)`, another document links it in its
 * prose — and the plan's own file says nothing about any of them. A node's page
 * has had the reverse since `../backlinks/Backlinks.tsx`; a document's could
 * not, because a document had no identity below the file and nothing carried
 * what a file points AT (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/first-class-documents.md).
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
 * "house.org points here" where the honest answer is "the node `kitchen`
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

import { renderTitle } from "../markdown/title.ts"
import { TitleHtml } from "../markdown/TitleHtml.tsx"
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
  /** The referrers as the ROWS they draw — the arm decided once per row rather
   *  than once per fact the arm decides (see {@link rowOf}). */
  const rows = createMemo(() => props.found.map(rowOf))
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
          {/* `<Key>`, not `<For>`, for the reason the tree and the refs row use
              it (../Tree.tsx, ../NodeRefs.tsx, which say it in full). Keyed by
              which of the two arms the row is and what that arm names — see
              {@link rowOf}, which is where the arm is decided. */}
          <Key each={rows()} by="key">
            {(row) => (
              <li class="min-w-0">
                <a
                  class="text-sm text-accent no-underline hover:underline"
                  data-testid={TESTID.documentReferrer}
                  href={hrefOf(row().opens)}
                >
                  {/* A referrer's title is rendered like every other
                      title: its `#tags` are styled and hued
                      (`../markdown/title.ts`) — inside the anchor, so its
                      links stay unwrapped (`links` false). */}
                  <TitleHtml
                    drawing={renderTitle(row().calls, row().callsFrom, { links: false })}
                  />
                </a>
                {/* WHERE it was written, muted beside it — a title in a list of
                    strangers means nothing, and for a record it is the outline
                    the reference is in. A document's own row says the file
                    twice otherwise, so it says it once. */}
                <Show when={row().where}>
                  {(where) => (
                    <span class="ml-1 font-mono text-xs text-muted">{where()}</span>
                  )}
                </Show>
              </li>
            )}
          </Key>
        </ul>
      </Show>
    </details>
  )
}

/** One row of the section: what identifies it, where it opens, what it is
 *  called there, and — for a record — the outline it was written in. */
interface Row {
  readonly key: string
  readonly opens: Route
  readonly calls: string
  /** The file the title's prose is written in (`../NodeTitle.tsx`): the
   *  outline for a record, the document's own path for a body. */
  readonly callsFrom: string
  /** `undefined` for a document's own body, which has said its file already. */
  readonly where?: string
}

/**
 * A REFERRER, READ AS THE ROW IT DRAWS — which of the two arms it is, decided
 * once.
 *
 * Four facts turn on that decision and they must all be about the same arm.
 * Asked four times, that agreement is a rule somebody has to keep; asked once,
 * it is the shape of the answer.
 *
 * THE KEY CARRIES ITS NAMESPACE, because a path and a node id are both strings
 * and `referrersTo` names each POINTING document once and each of its records
 * once (its index says which documents those are, and the records of one are
 * walked once) — so within an arm the key is unique by construction, and across
 * the arms only the prefix says so. A key that collided would hand one element to the framework
 * twice, which is the crash `../edges/named.ts` argues at length.
 */
const rowOf = (one: Referrer): Row =>
  one.at === undefined
    ? {
      key: `doc:${one.face.path}`,
      opens: atFile(one.face.path),
      calls: one.face.title,
      callsFrom: one.face.path,
    }
    : {
      key: `node:${one.at.node.id}`,
      opens: atNode(one.at.node.id),
      calls: one.at.node.title,
      callsFrom: one.at.file,
      where: one.face.path,
    }

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says. */
const said = (total: number): string =>
  `Referred to by ${total} ${total === 1 ? "thing" : "things"}`
