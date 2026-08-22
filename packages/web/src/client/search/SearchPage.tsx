/**
 * `/search?q=…` — the whole directory, as a page.
 *
 * It is the page the shortlist could never be. What was there before was eight
 * rows in a popover: no address, no back button, not pinnable, gone the moment
 * the box lost the caret — so a tag written on five nodes in three outlines was
 * a thing this app could match and could not SHOW. This is that answer as a
 * place you can stand in, link to and keep
 * (docs/brainstorming/one-search-box.md).
 *
 * ## It is the filter, widened — and it looks it
 *
 * Rows are grouped by the outline they live in, and inside a group they are
 * that file's own tree pruned to the matches: **a match keeps its subtree, and
 * a row that did not match is kept as the ancestry that leads to one.** That is
 * not a shape invented here, it is `keeping` — the same prune every narrowed
 * page uses, run over every file (`@olai/format`'s `everywhere.ts`). A bare
 * `order` means nothing until you can see what it is under, which is the whole
 * argument the filter already won.
 *
 * **Every row says why it is drawn**, and for free: this page is narrowable
 * like any other, so the narrowing beside it answers which rows the query
 * selected and the lit needles and the context dim come out of the same
 * `../filter/why.ts` the outline tree reads. There is no second highlighter
 * here and no `matched` field on these rows.
 *
 * ## What a row is, and what it is not
 *
 * A TITLE AND A LINK. From a row, Enter or a click goes to that node's page —
 * which is what a hit is for once you can come back to it. What a row is NOT is
 * an editor: this page draws rows from every file in the directory at once, and
 * putting a caret in one would be an edit surface whose scope is the vault. The
 * verbs live where the node does, one press away.
 *
 * The trash page is the near neighbour and the model (`../trash/TrashPage.tsx`):
 * read-only rows, a file heading per pile, the same title rendering, the same
 * lit/dim rules. What differs is that a row here goes somewhere.
 *
 * ## Documents
 *
 * Under the groups, because they are the other half of the directory and not
 * rows of a tree ([docs/search.md](../../../../../docs/search.md)'s *…and
 * documents*): a `.md` whose prose holds the word, a `.html` found by its name.
 * They wear the sidebar's own glyph, so a file in a list of strangers looks
 * like the file in the tree.
 */

import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import type { DocumentHit, EverywhereGroup, Row } from "@olai/format"
import { bodyKind, customOf, isMirror, shownRecord } from "@olai/format"

import { Glyph } from "../file/icons.tsx"
import { useNarrowed } from "../filter/narrowed.tsx"
import { CONTEXT_DIM, lighting, matchedAttr, propsOf, unfiltered } from "../filter/why.ts"
import { PAGE_TITLE } from "../look.ts"
import { PropsLine } from "./PropsLine.tsx"
import { RowTitle } from "../RowTitle.tsx"
import { atFile } from "../routes.ts"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"

export function SearchPage(props: {
  /** One outline that holds a match, and its tree pruned to what matched. */
  readonly groups: ReadonlyArray<EverywhereGroup>
  /** …and the `.md`s and `.html`s the same query selected. */
  readonly documents: ReadonlyArray<DocumentHit>
}) {
  const empty = () => props.groups.length === 0 && props.documents.length === 0

  return (
    <div data-testid={TESTID.searchPage}>
      <header class="mb-8">
        <h1 class={`${PAGE_TITLE} italic text-ink`}>Search</h1>
        <p class="m-0 mt-1 text-sm text-muted">
          Every outline and every document, asked one question. The same grammar
          the box above every page speaks.
        </p>
      </header>

      {/* THE PAGE'S OWN EMPTY SENTENCE, and only when there is no query — the
          rule every page in this app keeps: "nothing has been typed" is a claim
          about the page, and "no matches" is a claim about the query, which the
          bar makes in its own words (`../filter/why.ts`'s `unfiltered`). */}
      <Show when={!empty()} fallback={<Waiting />}>
        <Key each={props.groups} by="file">
          {(group) => (
            <section data-testid={TESTID.searchGroup} data-file={group().file}>
              <h2 class="mb-1 mt-4 font-mono text-sm text-muted">
                {/* The file, as a link: a reader who has found three matches in
                    one outline usually wants that outline. */}
                <Link route={atFile(group().file)} testid={TESTID.searchGroupFile}>
                  {group().file}
                </Link>
              </h2>
              <Rows rows={group().rows} />
            </section>
          )}
        </Key>

        <Show when={props.documents.length > 0}>
          <section class="mt-6" data-testid={TESTID.searchDocuments}>
            <h2 class="mb-1 mt-4 font-mono text-sm text-muted">documents</h2>
            <ul class="m-0 list-none p-0">
              <Key each={props.documents} by={(one) => one.at.path}>
                {(document) => <Found document={document()} />}
              </Key>
            </ul>
          </section>
        </Show>
      </Show>
    </div>
  )
}

/** What the page says with nothing typed into it — a page rather than a hole.
 *  Never over a query: "no matches" is the bar's sentence, not this one. */
function Waiting() {
  const narrowed = useNarrowed()
  return (
    <Show when={unfiltered(narrowed)}>
      <p class="m-0 py-8 text-muted" data-testid={TESTID.searchWaiting}>
        Type in the box above to search every outline and document.
      </p>
    </Show>
  )
}

function Rows(props: { readonly rows: ReadonlyArray<Row> }) {
  return (
    <ul class="m-0 list-none p-0">
      <Key each={props.rows} by="key">
        {(row) => <Branch row={row()} />}
      </Key>
    </ul>
  )
}

function Branch(props: { readonly row: Row }) {
  const narrowed = useNarrowed()

  /** The node this row SHOWS — a placement matches, lights and dims by what it
   *  stands for, which is the rule a fold and the filter already follow. One
   *  accessor because four bindings ask it and `props.row` is a fresh object on
   *  every frame the store publishes. */
  const shown = createMemo(() => shownRecord(props.row))

  /** …and what it says about ITSELF that the query asked about — the matched
   *  property keys first (`../filter/why.ts`). A memo because the list is
   *  walked twice, once to know whether to draw the line at all. */
  const properties = createMemo(() => {
    const node = shown().node
    // A PLACEMENT carries no properties of its own — the only row that reaches
    // here with one is a mirror whose chain died, which shows no node and so
    // answers nothing about why anything is drawn.
    return propsOf(narrowed, node.id, isMirror(node) ? {} : customOf(node))
  })

  return (
    <li
      data-testid={TESTID.searchRow}
      data-node-id={props.row.at.node.id}
      // Whether the query SELECTED this row or kept it as the ancestry that
      // leads to one — one spelling for every surface that says it
      // (`../filter/why.ts`).
      data-match={matchedAttr(narrowed, shown().node.id)}
    >
      {/* The dim is on the LINE, never on the `<li>`: rows nest, and an item
          would take every match under this one down with it. */}
      <div
        class={`flex min-h-6 items-baseline gap-2 py-0.5 ${
          CONTEXT_DIM(narrowed, shown().node.id)
        }`}
      >
        <span class="select-none text-muted" aria-hidden="true">
          {isMirror(props.row.at.node) ? "⇢" : "•"}
        </span>
        <span
          class="flex-1 text-ink"
          // What a row is CALLED, said the way every other surface says it: a
          // title span is a title span, and a reader of this page should not
          // have to know a different component drew it.
          data-testid={TESTID.nodeTitle}
          classList={{ "line-through opacity-60": props.row.status === "done" }}
        >
          <RowTitle
            row={props.row}
            needles={lighting(narrowed, shown().node.id)}
            opens={TESTID.searchRowLink}
          />
        </span>
      </div>
      {/* WHY THIS ROW IS HERE, when the reason was a PROPERTY — the matched key
          first, in the reading ink, and the rest of the map beside it. It is
          the line the ⌘K palette's hit rows drew, moved to the page that
          answers a `prop:` query now that the shortlist doors are gone
          (`../filter/why.ts`'s `propsOf` for WHICH keys, `./PropsLine.tsx` for
          what the line says about them). Nothing at all on a row the query did
          not select on a property, which is most rows on most queries.

          The layout is this page's own: a page may WRAP where a popover's row
          truncates, because there is a column's width to spend and no panel to
          push sideways. */}
      <PropsLine
        of={properties()}
        testid={TESTID.searchRowProp}
        class="ml-5 flex flex-wrap gap-x-4 text-xs"
      />
      <Show when={props.row.children.length > 0}>
        <div class="ml-5">
          <Rows rows={props.row.children} />
        </div>
      </Show>
    </li>
  )
}

/** One document the query found: the sidebar's glyph, what the file is called,
 *  and the path under it — the same three facts a document row has ever drawn
 *  in this app. */
function Found(props: { readonly document: DocumentHit }) {
  const kind = () => bodyKind(props.document.at.path) ?? "document"
  return (
    <li data-testid={TESTID.searchDocument} data-file={props.document.at.path}>
      <Link
        route={atFile(props.document.at.path)}
        class="flex items-baseline gap-2 py-0.5 text-ink no-underline hover:underline"
        testid={TESTID.searchDocumentLink}
      >
        <span aria-hidden="true" class="shrink-0 self-center text-muted">
          <Glyph of={kind()} />
        </span>
        <span class="min-w-0 flex-1 truncate">{props.document.title}</span>
        <span class="shrink-0 font-mono text-xs text-muted">
          {props.document.at.path}
        </span>
      </Link>
    </li>
  )
}
