/**
 * WHAT REFERS TO A PLACE, drawn — the ONE section both pages that ask the
 * question share.
 *
 * A node's page and a document's page used to draw two sections: the outlines
 * plugin's `backlinks/Backlinks.tsx` and the markdown plugin's
 * `document/Referrers.tsx`. They answered the same wire shape (`@olai/format`'s
 * `Reference` — one entry per source, with the ways it refers), collapsed for
 * the same reason (a reference is context rather than content), and split
 * their rows the same way (a `see`, a mention and a link are three sentences
 * about one source). Two chapters of one book, each with its own spelling of
 * the same `<details>`, its own open-state memory and its own rows — so the
 * two pages could drift, and one of them (the document's) remembered nothing
 * at all.
 *
 * This is that section, once. The one thing it does NOT do is know what a row
 * IS: a record opens a node page, a document opens a file, and which route
 * and which title each gets is a plugin's own question (the routes come from
 * `olai-plugin-navigation`, which this general package must not name). So a
 * caller hands it ROWS — already shaped, with their href — and the ways, and
 * the testids. What is shared is the whole of the rest: the counts, the
 * per-way split, the collapse, and the memory of whether the reader left it
 * open.
 *
 * COLLAPSED, and the collapse is the browser's — a `<details>`, the shape
 * `../document/Toc.tsx` already uses, so it works before this app's
 * JavaScript has an opinion about it and is announced without an
 * `aria-expanded` to keep in step. The default is shut because a reference is
 * context rather than content, and a place everything in the vault points at
 * would otherwise open with a wall of links above its own first line.
 *
 * ...AND THE ROWS ARE NOT BUILT WHILE IT IS SHUT, which the `<details>` alone
 * does not give: that element renders its children whether or not it is open,
 * so on the place this feature is for — a curated list several hundred
 * sources point at — every frame the store published was minting several
 * hundred rows and diffing several hundred anchors nobody could see. The
 * element's own `toggle` drives a signal, and the rows live behind it; the
 * SUMMARY needs only the count, which is a length the caller already has.
 * The caller's `rows` function is what keeps that true: this component calls
 * it ONLY inside the open `<Show>`, because the mapping itself — however
 * cheap — is the thing a shut section must not do.
 *
 * A ROW PER WAY, because the ways are not the same claim: a `see` is an edge
 * somebody wrote with a verb, a mention is a word in a sentence, and a link
 * written in a body or a note is a third. Each row is drawn under the label
 * the caller's table gives it, and a source that refers several ways appears
 * in several rows, which is what it is doing.
 *
 * KEYED ON THE PLACE, which is the caller's. A page reused from one node to
 * another would otherwise carry the reader's answer about the first onto the
 * second: `open` is an attribute the browser then owns, and a different place
 * must be a different element by construction. The caller keys its `<Show>`
 * on the place and mints this component inside that keyed block, so the
 * signal is reset with it. It is NOT keyed on the count: the section staying
 * open while a reference is added elsewhere is exactly the live update this
 * feature is for.
 */
import { Key } from "@solid-primitives/keyed"
import { createSignal, For, Show } from "solid-js"

import type { Claims, Reference, Way } from "@olai/format"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

import { TitleHtml } from "./TitleHtml.tsx"
import { renderTitle } from "./title.ts"

/** One row of the section, already shaped by the caller: where it opens, what
 *  it is called there, and — for a record — the outline it was written in. */
export interface ReferrerRow {
  /** Names the row, unique within its way. A document is its path, a record
   *  its node id; the caller prefixes the namespace (`doc:` / `node:`),
   *  because the two are both strings and a key that collided would hand one
   *  element to the framework twice. */
  readonly key: string
  /** What this row opens — the caller's own href, so this component never
   *  has to know how a place is addressed. */
  readonly opens: string
  /** The title, as written. */
  readonly calls: string
  /** The file the title's prose is written in — the outline for a record,
   *  the document's own path for a body. */
  readonly callsFrom: string
  /** `undefined` for a document's own body, which has said its file already. */
  readonly where?: string
  /** The hover text: what the link does, or what it is a link ABOUT. */
  readonly title?: string
  /** What the row's anchor carries in `data-ref`, when a browser test picks
   *  the link by what it opens. A record answers its node id; a body answers
   *  its path; a caller that needs no `data-ref` leaves it out. */
  readonly ref?: string
}

/** One way a row can be drawn, as a value — the caller's own table, handed in
 *  rather than imported, because the label is a reader's sentence that each
 *  page says in its own words; this general package must not carry it. */
export interface ReferrerWay {
  readonly way: Way
  /** The label on the row — "sees this", "mentions this", "links this". */
  readonly label: string
  /** What that row is called to the browser tests. */
  readonly refs: AnyTestId
}
export type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"


export interface ReferrersSectionProps {
  /** The references, in `@olai/format`'s one wire shape. */
  readonly found: ReadonlyArray<Reference>
  /** The set's claims, for rendering titles' `#tags`. */
  readonly claims: Claims | undefined
  /** The ways this page draws, in the order the rows should appear. */
  readonly ways: ReadonlyArray<ReferrerWay>
  /** The rows one way draws. The per-way SPLIT is the caller's — it is the
   *  same order as the references, one pass, and only the caller knows which
   *  way a reference's `ways` belong to this page's drawing. Called only
   *  inside the open `<Show>`: a shut section never maps a reference. */
  readonly rows: (way: Way) => ReadonlyArray<ReferrerRow>
  /** The key this section remembers its open state under — the caller's own
   *  (pane, place) spelling, unique per place on screen. */
  readonly memoryKey: string
  readonly testid: AnyTestId
  readonly summaryTestid: AnyTestId
  /** The testid each row's anchor wears. One per row, whatever the row opens. */
  readonly linkTestid: AnyTestId
  /** The summary line — a count in a sentence rather than a bare number,
   *  because it is the whole of what a shut section says. */
  readonly summary: (total: number) => string
  readonly memory: ReferrerMemory
}

/** The section, minted PER PLACE by the caller's keyed `<Show>`, so the open
 *  signal is born with the place and dies with it. */
export function ReferrersSection(props: ReferrersSectionProps) {
  const [open, setOpen] = createSignal(false)
  /** The remembered answer, read ONCE at mount: `<details>` reads its `open`
   *  attribute at parse time, so the element must be BORN open, not opened a
   *  frame later by a command. */
  const initiallyOpen = () => props.memory.opened?.get(props.memoryKey) ?? false
  return (
    <details
      ref={(element) => { element.open = initiallyOpen() }}
      class="mt-3 border-t border-rule pt-2"
      data-testid={props.testid}
      data-count={props.found.length}
      // The element's own state, read back rather than commanded: `<details>`
      // opens itself on a press, on a keyboard activation and on a browser's
      // find-in-page, and a component that set `open` from a signal would be
      // fighting all three.
      onToggle={(event) => {
        const now = event.currentTarget.open
        setOpen(now)
        props.memory.remember(props.memoryKey, now)
      }}
    >
      <summary
        class="cursor-pointer text-sm text-muted select-none"
        data-testid={props.summaryTestid}
      >
        {props.summary(props.found.length)}
      </summary>
      <Show when={open()}>
        {/* A row per WAY, out of the caller's table — never a label written
            here beside a testid picked by hand, which is the fragmentation
            the outlines plugin's `referrings.ts` exists to have stopped. An
            empty way draws nothing, which is the same rule every relation row
            on this page follows. */}
        <For each={props.ways}>
          {(way) => (
            <Show when={props.rows(way.way).length > 0}>
              <div
                class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                data-testid={way.refs}
              >
                <span class="text-muted">{way.label}</span>
                {/* `<Key>`, not `<For>`, for the reason the tree and the refs
                    row use it (`../plugins/outlines`' Tree/NodeRefs, which
                    say it in full): an element keyed by IDENTITY stands while
                    the list around it moves, and what a live section owes its
                    reader is that the anchors under a pointer are the ones
                    they were. */}
                <Key each={props.rows(way.way)} by="key">
                  {(row) => (
                    <>
                      <a
                        class="inline-flex items-center text-accent no-underline hover:underline md:min-h-0"
                        data-testid={props.linkTestid}
                        href={row().opens}
                        title={row().title}
                      >
                        {/* WHAT it opens, in `data-ref`, when the caller says
                            so — a browser test picks the link by what it
                            opens, because ids outlive titles. Carried on an
                            INNER span, for the selector's own grammar: the
                            step asks for a `node-ref` that HAS a `data-ref`
                            child (`NODE_REF:has([data-ref])`), so the anchor
                            must contain it rather than wear it. */}
                        <Show when={row().ref}>
                          {(ref) => <span data-ref={ref()} />}
                        </Show>
                        {/* A referrer's title is rendered like every other
                            title: its `#tags` are styled and hued
                            (`./title.ts`) — inside the anchor, so its links
                            stay unwrapped (`links` false). */}
                        <TitleHtml
                          drawing={renderTitle(props.claims, row().calls, row().callsFrom, { links: false })}
                        />
                      </a>
                      {/* WHERE it was written, muted beside it — a title in a
                          list of strangers means nothing, and for a record it
                          is the outline the reference is in. A document's own
                          row says the file twice otherwise, so it says it
                          once. */}
                      <Show when={row().where}>
                        {(where) => (
                          <span class="ml-1 font-mono text-xs text-muted">{where()}</span>
                        )}
                      </Show>
                    </>
                  )}
                </Key>
              </div>
            </Show>
          )}
        </For>
      </Show>
    </details>
  )
}