/**
 * A served `.csv`, drawn — a header row and the rows under it, as a table, and
 * the honest sentence about the rows that would not fit.
 *
 * VIEW ONLY, which is a decision and not a stage of one. A `.csv` is somebody's
 * export — from a bank, a spreadsheet, a script — and what a person opening one
 * in their notes wants is to SEE it: which columns are in there, what the first
 * rows look like, whether it is the file they meant. An editable grid is a
 * different product, and half of one — cells you can type in that write back
 * through an op nobody has written — would be a page that looks like it holds
 * your changes. So there is no editor, no create verb, and `write_document`
 * refuses the file if anything asks (`@olai/ops`). That is the registry's
 * `edits: false` (./faces.tsx) rather than a `Show` in this file.
 *
 * IT ASKS FOR THE BODY, unlike the `.html` face next door, and the difference
 * between them is the whole of what `holds` means. A saved page is fetched by
 * the frame that draws it, over HTTP, because the browser is what interprets it
 * (`./Hypertext.tsx`). A `.csv` is interpreted HERE — `@olai/format`'s `csvRows`
 * is what turns the text into rows — so the text has to arrive, and it arrives
 * the way a document's body does: one key of the documents collection, read for
 * whoever is holding it open and kept by nobody (`@olai/server`'s `bodies.ts`).
 * One read of the disk, at the revision the rest of the page is at, and a file
 * rewritten under an open page redraws it.
 *
 * THE FIRST ROW IS THE HEADER, and nothing in the file says so. Every tool that
 * writes a `.csv` writes one, and there is no mark in the format to detect —
 * so the convention is stated once, in the format's own reading, and drawn here
 * as a `<th>` row. That is the FACT this page asserts: it is a header cell,
 * which is what a screen reader announces and what a scenario reads. Whether a
 * header is bold is a look.
 *
 * THE CLAMP IS SAID. A vault can hold a million-row export and this is a page,
 * not a database viewer, so what is drawn is bounded (`@olai/format`'s
 * `CSV_ROWS`, `CSV_COLUMNS`) — and a table showing the first five hundred rows
 * of twelve thousand with nothing saying so is a lie the reader cannot see. The
 * NUMBERS are the format's and the SENTENCE is ./clamped.ts's, which is the one
 * place this page's own voice is decided — so a change to the wording is one
 * file and one test rather than markup in the middle of a table.
 *
 * WHAT IS NOT DONE, said rather than left to be discovered: the clamp is on the
 * DRAWING and not on the wire, so the whole file's text crosses the socket even
 * when a fraction of it is shown. That is what a `.md` body has always cost,
 * this is the same member, and paging the read would be a second protocol for
 * one kind of file. The day somebody keeps a hundred-megabyte export in a vault
 * it is the READ that has to learn about ranges, for every bodied kind at once.
 */

import { csvTable } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { SaidLine } from "../SaidLine.tsx"
import { TESTID } from "../testids.ts"
import { BodyRefused } from "./BodyRefused.tsx"
import { clampSaid } from "./clamped.ts"
import { isServed, useDocument } from "./documents.tsx"

/** The file, and nothing else — ./faces.tsx's `Reading`, spelled here rather
 *  than imported for the reason ./Hypertext.tsx spells its own: the table
 *  imports this component, so a type taken back out of it would be a cycle
 *  between a registry and one of its entries. */
export function Csv(props: { readonly file: string }) {
  // THE BODY, asked for by the face that draws from it — the rule ./faces.tsx
  // states: a face asks the wire for what it needs, so what a kind costs this
  // tab is a fact about that kind's own component.
  const served = useDocument(() => props.file)
  // ONE PARSE per body, not one per row drawn. A memo rather than a call in the
  // markup: `<For>` reads its source once per change, but the clamp line below
  // reads the same table, and two calls would be two walks of a file that can
  // be megabytes.
  const table = createMemo(() => {
    const entry = served()
    return isServed(entry) ? csvTable(entry.text) : null
  })
  /** WHAT THIS PAGE IS NOT SHOWING, in one sentence or none — the bound said
   *  out loud, or the honest nothing for a file that is empty (./clamped.ts,
   *  which owns both moods and the words). */
  const said = () => {
    const read = table()
    return read === null ? null : clampSaid(read)
  }
  /** The header row and the rows under it, apart — the split is the drawing's,
   *  since the format hands back one list of rows and says the first is the
   *  header (`@olai/format`'s `csv.ts`). */
  const header = () => table()?.rows[0]
  const body = () => table()?.rows.slice(1) ?? []

  return (
    <>
      <Show when={served()?.refused}>
        <BodyRefused />
      </Show>
      <Show when={table()}>
        {(read) => (
          <>
            {/* NO TABLE FOR A FILE WITH NOTHING IN IT — a bordered rectangle
                with no rows reads as a page that failed to load. What is drawn
                instead is the line below, which is already the one place this
                page says what it is not showing. */}
            <Show when={read().totalRows > 0}>
              {/* The table is its own scroll container, for the reason a
                  rendered markdown table is (`../styles.css`): a file wide
                  enough to overflow scrolls WITHIN the column instead of
                  widening the page under everything else, and a column of a
                  table cannot be broken mid-word without lying about the value
                  in it. */}
              <div class="overflow-x-auto">
                <table
                  class="w-max border-collapse text-[0.8125rem]"
                  data-testid={TESTID.csvTable}
                >
                  <thead>
                    <tr>
                      <For each={header() ?? []}>
                        {(cell) => (
                          <th class="border-b border-muted bg-rule/45 px-2 py-1 text-left align-top font-semibold whitespace-pre">
                            {cell}
                          </th>
                        )}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={body()}>
                      {(row) => (
                        <tr>
                          <For each={row}>
                            {(cell) => (
                              <td class="border-b border-rule px-2 py-1 text-left align-top whitespace-pre">
                                {cell}
                              </td>
                            )}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            {/* WHAT THIS PAGE IS NOT SHOWING, under the table — through the
                one component that owns what a mood MEANS (`../SaidLine.tsx`).
                Nothing at all when the whole file is drawn, which is the
                ordinary page: a line saying "showing all of it" under every
                table is noise that teaches a reader to skip the line that
                matters. */}
            <Show when={said()}>
              {(one) => (
                <SaidLine
                  said={one()}
                  class="mt-2 mb-0 text-[0.8125rem]"
                  testid={TESTID.csvClamp}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </>
  )
}
