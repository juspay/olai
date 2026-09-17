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
 * This is that section, once. What it does NOT do is know what a row IS: a
 * record opens a node page, a document opens a file, and which route and
 * which title each gets is a plugin's own question (the routes come from
 * `olai-plugin-navigation`, which this general package must not name). So the
 * caller hands it the rows and the testids; what is shared here is the whole
 * of the rest — the counts, the per-way split, the labels, the collapse, the
 * open-state memory, and the forget rule that decides when a leaving section
 * stops remembering.
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
 * The caller's `row` function is what keeps that true: this component calls
 * it ONLY inside the open `<Show>`, because the mapping itself — however
 * cheap — is the thing a shut section must not do.
 *
 * A ROW PER WAY, out of the format's own list ({@link WAYS}), because the ways
 * are not the same claim: a `see` is an edge somebody wrote with a verb, a
 * mention is a word in a sentence, and a link written in a body or a note is
 * a third. Each row is drawn under the label {@link makeReferrerWays} gives its
 * way — the shared vocabulary "sees this", "mentions this", "links this",
 * once, not chased into a per-plugin table — and a source that refers several
 * ways appears in several rows, which is what it is doing.
 *
 * KEYED ON THE PLACE, which is the caller's. A page reused from one node to
 * another would otherwise carry the reader's answer about the first onto the
 * second: `open` is an attribute the browser then owns, and a different place
 * must be a different element by construction. The caller keys its `<Show>`
 * on the place and mints this component inside that keyed block, so the
 * signal is reset with it. It is NOT keyed on the count: the section staying
 * open while a reference is added elsewhere is exactly the live update this
 * feature is for.
 *
 * THE KEY THE MEMORY ANSWERS UNDER is the caller's (place) string, and what it
 * is made of is the caller's own business — the node pages read the pane
 * INDEX from `useHere()`, which revs on the layout clock when a pane is
 * reordered or closed. No pane identity exists on this wire today, so the
 * index is what there is; a key built on it merely starts a new visit when
 * the layout moves, which is the honest reading of a place that left.
 *
 * FORGETTING is the section's too, decided at the moment it leaves: the
 * {@link ReferrerMemory} is written on every toggle, and the caller's
 * `stillShown` says whether the same place is on screen any more (true = a
 * rebuild in place, and the remembered answer is still the reader's). When it
 * is not — the last referrer went, or the reader navigated away — the key is
 * FORGOTTEN, untracked at the leaving moment rather than as a subscription: a
 * cleanup that re-rendered the pane on every frame would be the section
 * keeping itself alive by what it was closing.
 */
import { Key } from "@solid-primitives/keyed"
import { createSignal, For, onCleanup, Show } from "solid-js"

import { type Claims, type Reference, type Way, WAYS } from "@olai/format"
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

/** One way a row is drawn, as a value — ONE table, shared by every page that
 *  draws this section. The labels are the section's own vocabulary (a reader's
 *  sentence on a row: "sees this", "mentions this", "links this"), the same
 *  way the summary line is; the testid is the caller's, because what a row is
 *  called to the browser tests is a fact about the surface that draws it. */
export interface ReferrerWay {
  readonly way: Way
  /** The label on the row of links. */
  readonly label: string
  /** What that row is called to the browser tests. */
  readonly refs: AnyTestId
}

/** ALL the ways, in the format's own order ({@link WAYS}: the edge first, the
 *  prose after it), READ rather than re-declared — the labels once, and a
 *  fourth way added where the rulings live is a compile error HERE plus a
 *  `refs` the caller's record must supply, not a row silently undrawn. The
 *  {@link ReferrerWay.refs} the page's own testids fill in is what the rows
 *  answer to; the labels are fixed, because a reader's sentence does not
 *  change with the page that draws it. */
export const makeReferrerWays = (refs: Record<Way, AnyTestId>): ReadonlyArray<ReferrerWay> =>
  WAYS.map((way) => ({ way, label: REFERRER_LABELS[way], refs: refs[way] }))

const REFERRER_LABELS: Record<Way, string> = {
  see: "sees this",
  mention: "mentions this",
  link: "links this",
}
export type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"


export interface ReferrersSectionProps {
  /** The references, in `@olai/format`'s one wire shape. */
  readonly found: ReadonlyArray<Reference>
  /** The set's claims, for rendering titles' `#tags`. */
  readonly claims: Claims | undefined
  /** The ways this page draws, in the order the rows appear — built from
   *  {@link makeReferrerWays} over the page's own testids, so the labels are
   *  the shared ones and the totality is the format's. */
  readonly ways: ReadonlyArray<ReferrerWay>
  /** ONE row per reference, in the section's own order — the per-way SPLIT is
   *  here (a reference whose `ways` carry two ways appears in two rows), and
   *  the mapping itself lives in the caller only because only it knows which
   *  route a record or a document opens. Called only inside the open
   *  `<Show>`: a shut section never maps a reference. */
  readonly row: (one: Reference) => ReferrerRow
  /** Whether the same place this section describes is still on screen — the
   *  caller's own answer, closed over its reading. TRUE is a rebuild in place
   *  (keep the remembered answer); anything else — the last referrer went, or
   *  the reader navigated away — forgets it. */
  readonly stillShown: () => boolean
  /** The key this section remembers its open state under — the caller's own
   *  (pane, place) spelling, unique per place on screen. */
  readonly memoryKey: string
  readonly testid: AnyTestId
  readonly summaryTestid: AnyTestId
  /** The testid each row's anchor wears. One per row, whatever the row opens. */
  readonly linkTestid: AnyTestId
  readonly memory: ReferrerMemory | undefined
}

/** THE SUMMARY LINE — the count in a sentence rather than a bare number,
 *  because it is the whole of what a shut section says and "Referenced by 3"
 *  beside a heading reads as a score. The section's own vocabulary, same as
 *  the way labels: nothing here is the caller's to spell. */
const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "thing" : "things"}`

/** The section, minted PER PLACE by the caller's keyed `<Show>`, so the open
 *  signal is born with the place and dies with it. */
export function ReferrersSection(props: ReferrersSectionProps) {
  const [open, setOpen] = createSignal(false)
  /** The remembered answer, read ONCE at mount: `<details>` reads its `open`
   *  attribute at parse time, so the element must be BORN open, not opened a
   *  frame later by a command. */
  const initiallyOpen = () => props.memory?.opened?.get(props.memoryKey) ?? false
  // WHAT LEAVING THE SECTION MEANS, decided at the moment it leaves — the
  // memory is already WRITTEN on every toggle, so the only question here is
  // when to FORGET: the same place is still shown AND still has referrers (a
  // rebuild in place), or the answer goes. Read UNTRACKED, because this is the
  // leaving moment, not a subscription: a cleanup that re-rendered the pane on
  // every frame would be the section keeping itself alive by what it was
  // closing.
  onCleanup(() => {
    if (!props.stillShown()) props.memory?.forget(props.memoryKey)
  })
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
        props.memory?.remember(props.memoryKey, now)
      }}
    >
      {/* THE WHOLE OF WHAT A SHUT SECTION SAYS — the count in a sentence,
          the section's own vocabulary, same as the way labels. The `<summary>`
          is what a `<details>` shows while shut; the rows live behind the
          `open` `<Show>` below. */}
      <summary
        data-testid={props.summaryTestid}
        class="cursor-pointer select-none text-muted hover:text-ink"
        data-count={props.found.length}
      >
        {said(props.found.length)}
      </summary>
      <Show when={open()}>
        {/* A row per WAY, out of ONE shared table — never a label written here
            beside a testid picked by hand, which is the fragmentation the
            outlines plugin's `referrings.ts` existed to have stopped. An
            empty way draws nothing, which is the same rule every relation row
            on this page follows. */}
        <For each={props.ways}>
          {(way) => (
            <Show when={props.found.some((one) => one.ways.includes(way.way))}>
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
                <Key
                  each={props.found.filter((one) => one.ways.includes(way.way)).map(props.row)}
                  by="key"
                >
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