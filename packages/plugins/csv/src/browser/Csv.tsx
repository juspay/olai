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
 * your changes. So there is no editor, no create verb, and `markdown_write`
 * refuses the file if anything asks (`@olai/ops`). That is the registry's
 * `edits: false` (../browser.tsx) rather than a `Show` in this file.
 *
 * IT ASKS FOR THE BODY, unlike the `.html` face next door, and the difference
 * between them is the whole of what `holds` means. A saved page is fetched by
 * the frame that draws it, over HTTP, because the browser is what interprets it
 * (the hypertext row's iframe). A `.csv` is interpreted HERE — `@olai/format`'s `csvRows`
 * is what turns the text into rows — so the text has to arrive, and it arrives
 * through `vault.files.body`, read for whoever is holding it open and kept by
 * nobody (the vault's `server/bodies.ts`).
 * One read of the disk, at the revision the rest of the page is at, and a file
 * rewritten under an open page redraws it.
 *
 * THE FIRST ROW IS THE HEADER, and nothing in the file says so. Every tool that
 * writes a `.csv` writes one, and there is no mark in the format to detect —
 * so the convention is stated once, in the format's own reading, and drawn here
 * as a `<th scope="col">` row. That is the FACT this page asserts: these cells
 * name the COLUMNS under them, which is what a screen reader announces when it
 * reaches a cell and what a scenario reads. Whether a header is bold is a look.
 * There is no `scope="row"` anywhere here, and that is a refusal rather than an
 * omission: a `.csv` declares a header ROW and nothing else, so calling the
 * first column a row header would be this page inventing a fact about somebody's
 * export — the one lie the format cannot correct.
 *
 * THE TABLE IS A REGION SOMEBODY CAN REACH. A wide export overflows, and a
 * scroll container is reachable with a pointer and with a trackpad and — unless
 * it is told to be — by nobody travelling with a keyboard, because nothing in a
 * table of text takes focus. So the scroller carries `tabindex="0"`, which is
 * what hands the arrow keys to it, `role="region"` and a name, so that landing
 * in it is announced as arriving somewhere rather than as a silent stop; the
 * name is the `<caption>`, which is the table's own name as well.
 *
 * THE RING IS THE APP'S, and that is a decision rather than a default. A
 * focusable scroll container is exactly where a focus ring gets lost: the ring
 * is drawn two pixels outside the box (`@olai/appearance`'s `chrome.css`, the
 * one place a ring is described), and this box sits inside a pane that CLIPS.
 * It survives because the pane's clip edge is its padding box and that padding
 * is wider than the ring — so the answer here is to leave the ring alone and
 * hold the geometry, which a scenario reads as a rectangle inside a rectangle
 * rather than as a class name. A second ring spelled on this element would be
 * outranked anyway: everything in `chrome.css` is unlayered and Tailwind's
 * utilities are not.
 *
 * THE HEADER STAYS while the rows move. A bounded preview is still five hundred
 * rows, and a column of numbers with its name scrolled off the top is data
 * nobody can read — so the scroller has a height, the `<thead>` sticks to the
 * top of it, and the borders are `separate` because a collapsed border belongs
 * to the grid rather than to the cell and travels away from the sticky row.
 * The opaque surface under the header is load-bearing in the same way: rows
 * passing under a translucent one read as a smear.
 *
 * THE BOUND IS SAID, and it is a bound on the READING and not a slice taken
 * afterwards. A vault can hold a million-row export and this is a page, not a
 * database viewer, so the scan stops — rows, columns and the length of one cell
 * (`@olai/format`'s `csv.ts`, which argues all three) — and a table showing
 * part of a file with nothing saying so is a lie the reader cannot see. The
 * FACTS are the format's and the SENTENCE is ./clamped.ts's, which is the one
 * place this page's own voice is decided, so a change to the wording is one
 * file and one test rather than markup in the middle of a table.
 *
 * WHAT IS NOT BOUNDED, said rather than left to be discovered: the WIRE. The
 * whole file's text crosses the socket even though a fraction of it is read
 * here — that is what a `.md` body has always cost, this is the same member,
 * and paging it would be a second protocol for one kind of file. So the memory
 * a huge `.csv` costs this tab is one string rather than one string plus every
 * field of every row of it, which is the difference the reading's bound makes
 * and the whole of what it can make from this side. The day somebody keeps a
 * hundred-megabyte export in a vault it is the READ that has to learn about
 * ranges, for every bodied kind at once.
 */
import { TESTID } from "olai-plugin-csv/testids"
import { csvTable } from "@olai/format"
import { createEffect, createSignal, onCleanup, createMemo, createUniqueId, Index, Show } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { WITHIN } from "@olai/web/client/layer.ts"

import { BodyRefused } from "olai-plugin-markdown/body-refused"
import { clampSaid } from "./clamped.ts"
import { Effect } from "effect"
import type { Body } from "olai-plugin-vault/surface"
import { servedDirectory } from "./vault.ts"

/** The file, and nothing else — ../browser.tsx’s page props, spelled here rather
 *  than imported from the page contribution that imports this component. */
export function Csv(props: { readonly file: string }) {
  // THE BODY, asked for by the face that draws from it — the rule ../browser.tsx
  // states: a face asks the wire for what it needs, so what a kind costs this
  // tab is a fact about that kind's own component.
  const [served, setServed] = createSignal<Body>()
  createEffect(() => {
    const directory = servedDirectory()
    const file = props.file
    const revision = directory?.head(() => file)()
    if (directory === undefined || revision === undefined) { setServed(undefined); return }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void Effect.runPromise(directory.body(file), { signal: controller.signal }).then(
      body => { if (!controller.signal.aborted) setServed(body) },
      () => { if (!controller.signal.aborted) setServed({ text: null, refused: true }) },
    )
  })
  // ONE PARSE per body, not one per row drawn. A memo rather than a call in the
  // markup: `<For>` reads its source once per change, but the clamp line below
  // reads the same table, and two calls would be two walks of a file that can
  // be megabytes.
  const table = createMemo(() => {
    const entry = served()
    return entry !== undefined && !entry.refused && entry.text !== null ? csvTable(entry.text) : null
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
  /** The id the scroller borrows its name from — minted per instance, because
   *  two panes can hold two csv pages at once and a duplicate id would point
   *  both regions at whichever caption the document found first. */
  const caption = createUniqueId()

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
            <Show when={read().rows.length > 0}>
              {/* The table is its own scroll container, for the reason a
                  rendered markdown table is (`../styles.css`): a file wide
                  enough to overflow scrolls WITHIN the column instead of
                  widening the page under everything else, and a column of a
                  table cannot be broken mid-word without lying about the value
                  in it. The height is the other half of that bargain — it is
                  what gives the sticky header something to stick to, and it
                  bounds how much of the pane one file may claim. */}
              <div
                tabindex={0}
                role="region"
                aria-labelledby={caption}
                data-testid={TESTID.csvScroller}
                class="max-h-[min(32rem,80vh)] overflow-auto"
              >
                <table
                  class="w-max border-separate border-spacing-0 text-body"
                  data-testid={TESTID.csvTable}
                >
                  {/* THE NAME, said once and heard twice: it names the table
                      for a screen reader's table list and, through
                      `aria-labelledby`, the region around it. Unseen, because
                      the page's own heading is already this path in full
                      (`BodyPage`) and a caption repeating it under the heading
                      is a second title nobody asked for. */}
                  <caption id={caption} class="sr-only">{props.file}</caption>
                  {/* `WITHIN.raised`, not a number: `web/src/client/layer.ts`
                      is the one place this client spells a z-index, and the
                      header stacking over the rows that scroll under it is
                      exactly what that file's single-digit band is for — a
                      fact about the inside of this box, saying nothing about
                      the page. */}
                  <thead class={`sticky top-0 ${WITHIN.raised} bg-paper`}>
                    <tr>
                      <Index each={header() ?? []}>
                        {(cell) => (
                          <th scope="col" class="border-b border-muted bg-rule/40 px-2 py-1 text-left align-top font-semibold whitespace-pre">
                            {cell()}
                          </th>
                        )}
                      </Index>
                    </tr>
                  </thead>
                  <tbody>
                    <Index each={body()}>
                      {(row) => (
                        <tr>
                          <Index each={row()}>
                            {(cell) => (
                              <td class="border-b border-rule px-2 py-1 text-left align-top whitespace-pre">
                                {cell()}
                              </td>
                            )}
                          </Index>
                        </tr>
                      )}
                    </Index>
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
                  class="mt-2 mb-0 text-body"
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
