/**
 * WHAT POINTS AT THIS DOCUMENT, under its heading — the reverse reading a
 * `.md` could not have.
 *
 * Every reference points ONE WAY on disk: a note writes `[the plan](notes/plan.md)`, another document links it in its
 * prose — and the plan's own file says nothing about any of them. A node's page
 * has had the reverse since `../backlinks/Backlinks.tsx`; a document's could
 * not, because a document had no identity below the file and nothing carried
 * what a file points AT (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/first-class-documents.md).
 *
 * It does now: every document travels with its FACE (`@olai/format`'s
 * `Face`), and the ONE reading answers who points where — the same
 * `referencesOf` the node page's backlinks ask, over the set the server
 * holds. Nothing here walks the corpus or fetches a second body.
 *
 * TWO KINDS OF ROW, because there are two kinds of referrer and they are not
 * the same claim (`@olai/format`'s `referencesOf`): a RECORD that linked this
 * document in its title or note, drawn as the node it is and opening its
 * page; and a DOCUMENT whose body links here, drawn as the file it is. Saying
 * "house.olai points here" where the honest answer is "the node `kitchen`
 * links it" would be the coarser answer offered because it was the easier
 * one.
 *
 * THE WHOLE FILE is what it asks about, never one heading of it: what points
 * at `README.md#install` is pointing at this document, and a section that
 * split the two would answer half the question twice (`referencesOf` reads it
 * that way round).
 *
 * COLLAPSED, and the collapse is the browser's — a `<details>`, the shape
 * `./Toc.tsx` and the node's own backlinks already use — for that section's
 * reason exactly: a reference is context rather than content, and a document
 * everything in the vault points at would otherwise open with a wall of links
 * above its own first line. The rows are not built while it is shut, which the
 * element alone does not give.
 */
import type { Claims, PageReading } from "@olai/format"
import type { Accessor } from "solid-js"
import { TESTID } from "olai-plugin-markdown/testids"
import type { Reference } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, Show } from "solid-js"

import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { only } from "@olai/web/client/narrow.ts"
import { atFile, atNode, type Route } from "olai-plugin-navigation/routes"


export function Referrers(props: {
  /** The document this page is about — read for the KEY below rather than for
   *  a lookup: who points here rides on the page's own reading, which is a
   *  reading OF this file. */
  readonly file: string
  readonly reading: Accessor<PageReading | undefined>
  readonly claims: Claims | undefined
  readonly href: (route: Route) => string
}) {
  const reading = props.reading
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
      <Section found={found()} claims={props.claims} href={props.href} />
    </Show>
  )
}

/**
 * The section itself, its own component so the open state is MINTED WITH IT: a
 * signal one level up would outlive the keyed block and carry one document's
 * answer onto the next, which is what the key is for.
 */
function Section(props: { readonly found: ReadonlyArray<Reference>; readonly claims: Claims | undefined; readonly href: (route: Route) => string }) {
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
                  href={props.href(row().opens)}
                >
                  {/* A referrer's title is rendered like every other
                      title: its `#tags` are styled and hued
                      (`../markdown/title.ts`) — inside the anchor, so its
                      links stay unwrapped (`links` false). */}
                  <TitleHtml
                    drawing={renderTitle(props.claims, row().calls, row().callsFrom, { links: false })}
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
 * and `referencesOf` names each referencing source once (it collects into a map
 * keyed by the record or the face) — so within an arm the key is unique by
 * construction, and across the arms only the prefix says so. A key that collided
 * would hand one element to the framework twice, which is the crash
 * `../edges/named.ts` argues at length.
 */
const rowOf = (one: Reference): Row =>
  "path" in one.source
    ? {
      key: `doc:${one.source.path}`,
      opens: atFile(one.source.path),
      calls: one.source.title,
      callsFrom: one.source.path,
    }
    : {
      key: `node:${one.source.node.id}`,
      opens: atNode(one.source.node.id),
      calls: one.source.node.title,
      callsFrom: one.source.file,
      where: one.source.file,
    }

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says. */
const said = (total: number): string =>
  `Referred to by ${total} ${total === 1 ? "thing" : "things"}`
