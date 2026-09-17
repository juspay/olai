/**
 * WHAT POINTS AT THIS DOCUMENT, under its heading — the reverse reading a
 * `.md` could not have.
 *
 * Every reference points ONE WAY on disk: a note writes `[the plan](notes/plan.md)`, another document links it in its
 * prose — and the plan's own file says nothing about any of them. A node's page
 * has had the reverse since the outlines plugin's backlinks; a document's could
 * not, because a document had no identity below the file and nothing carried
 * what a file points AT (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/first-class-documents.md).
 *
 * It does now: every document travels with its FACE (`@olai/format`'s
 * `Face`), and the ONE reading answers who points where — the same
 * `referencesOf` the node page's backlinks ask, over the set the server
 * holds. Nothing here walks the corpus or fetches a second body.
 *
 * THE SECTION ITSELF IS THE SHARED ONE (`@olai/markdown-ui`'s
 * `ReferrersSection`), which both this page and a node's page draw — the same
 * wire shape, the same collapse, the same labels, the same rows, and the same
 * open-state memory: ONE store, minted by THIS plugin's activation and
 * offered behind `olai-plugin-markdown/contract`'s `referrerMemory`. This
 * page's own caller hands the value in as a prop — a document's page reads
 * its own activation's copy (`./memory.ts`), and a body page's host names
 * the service and passes it through `<BodyPage>`. What is left HERE is what
 * only this page knows:
 *
 *   - WHICH references to draw, off the page's own reading —
 *     `@olai/format`'s `referencesOf`, answered by the server as
 *     `shows.document.referrers` (one entry per source, with the ways it
 *     refers — a record linked from its note or title, a document linked in
 *     its prose);
 *   - the ROWS, shaped per way — a record opens its node page, a document
 *     opens its file, and the two are different routes this plugin knows how
 *     to spell (`olai-plugin-navigation`);
 *   - the testids each row answers to (the labels are the shared section's);
 *   - the KEY this section remembers its open state under — (pane, file).
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
 */
import type { Claims, PageReading, Reference } from "@olai/format"
import type { Accessor } from "solid-js"
import { TESTID } from "olai-plugin-markdown/testids"
import { createMemo, Show, untrack } from "solid-js"

import { makeReferrerWays, ReferrersSection, type ReferrerRow } from "@olai/markdown-ui/ReferrersSection.tsx"
import { only } from "@olai/web/client/narrow.ts"
import { atFile, atNode, type Route } from "olai-plugin-navigation/routes"
import { useHere } from "olai-plugin-navigation/routing"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

export function Referrers(props: {
  /** The document this page is about — read for the KEY below rather than for
   *  a lookup: who points here rides on the page's own reading, which is a
   *  reading OF this file. */
  readonly file: string
  readonly reading: Accessor<PageReading | undefined>
  readonly claims: Claims | undefined
  readonly memory: ReferrerMemory
  readonly href: (route: Route) => string
}) {
  const reading = props.reading
  const found = createMemo(() => {
    const shows = reading()?.shows
    // A page whose reading has not arrived draws no section rather than
    // waiting, which is the same nothing the `<Show>` below already means.
    return (shows === undefined ? undefined : only(shows, "document")?.referrers) ?? []
  })
  return (
    // ONE `<Show>`, keyed on the file while there is anything to say about it.
    // It carries both rules at once: a file nobody points at draws NOTHING
    // (the absence is the answer, as it is for every relation row on this
    // page), and a page reused from one document to another gets a NEW
    // element rather than the reader's answer about the first.
    <Show when={found().length > 0 ? props.file : undefined} keyed>
      {(file) => <Section file={file} found={found} claims={props.claims} href={props.href} reading={reading} memory={props.memory} />}
    </Show>
  )
}

/** The section, its own component so that the open state is MINTED WITH IT:
 *  a signal declared one level up would outlive the keyed block and carry
 *  one document's answer onto the next, which is the very thing the key is
 *  for. */
function Section(props: {
  readonly file: string
  readonly found: () => ReadonlyArray<Reference>
  readonly claims: Claims | undefined
  readonly href: (route: Route) => string
  readonly reading: Accessor<PageReading | undefined>
  readonly memory: ReferrerMemory
}) {
  const pane = useHere()()
  const key = JSON.stringify([pane, `referrers:${props.file}`])
  const memory = props.memory
  const stillShown = () => {
    const shows = untrack(props.reading)?.shows
    const doc = shows === undefined ? undefined : only(shows, "document")
    return doc !== undefined && doc.file === props.file && props.found().length > 0
  }
  return (
    <ReferrersSection
      found={props.found()}
      claims={props.claims}
      ways={makeReferrerWays({
        see: TESTID.documentSeeRefs,
        mention: TESTID.documentMentionRefs,
        link: TESTID.documentLinkRefs,
      })}
      row={rowOf(props.href)}
      stillShown={stillShown}
      memoryKey={key}
      testid={TESTID.documentReferrers}
      summaryTestid={TESTID.documentReferrersSummary}
      linkTestid={TESTID.documentReferrer}
      summary={said}
      memory={memory}
    />
  )
}

/** ONE row per reference — a record opens its node page, a document its own.
 *  The per-way split is the shared section's. */
const rowOf =
  (href: (route: Route) => string) =>
  (one: Reference): ReferrerRow =>
    "path" in one.source
      ? {
        key: `doc:${one.source.path}`,
        opens: href(atFile(one.source.path)),
        calls: one.source.title,
        callsFrom: one.source.path,
        ref: one.source.path,
      }
      : {
        key: `node:${one.source.node.id}`,
        opens: href(atNode(one.source.node.id)),
        calls: one.source.node.title,
        callsFrom: one.source.file,
        where: one.source.file,
        ref: one.source.node.id,
      }

/** The summary line: a count in a sentence rather than a bare number, because
 *  it is the whole of what a shut section says. */
const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "thing" : "things"}`