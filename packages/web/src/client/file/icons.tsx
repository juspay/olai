/**
 * What KIND of thing in the directory this is, said in a glyph.
 *
 * The complaint this answers was filed from a screenshot: the sidebar's tree
 * drew `garden.org`, `finishes.md` and `notes` in the same ink at the same
 * weight, so the only thing separating an OUTLINE from a DOCUMENT was four
 * characters of extension the eye has to read, and the only thing marking a
 * FOLDER was a triangle it shares with every fold control in the app. Three
 * kinds, one face — seven now, since a `.html`, a `.csv`, a picture and a
 * `.pdf` in the vault are four more things a row can be. A glyph is the
 * cheapest fix that is also the right one: it is read before the word beside
 * it, it costs no row height, and it is the one thing Workflowy's own quiet
 * leaves room for.
 *
 * ## A file of its own, where every other icon in this client is inline
 *
 * The house pattern for an icon is an `<svg>` written where it is drawn, with
 * a comment naming it (`../layout/Rail.tsx` still has three, `../Sidebar.tsx`'s
 * collapse chevron is a fourth). Two things make these ones not that, and both
 * are about the SET rather than about any one of them.
 *
 * They have to agree: seven drawings in one column, at one weight, in one
 * optical box, chosen by a value the tree already carries. That is a table,
 * and a table wants a home — inline, the folder's box and the folder's shape
 * would sit in one file while the document's sat in another, and the rule that
 * they match would be nowhere. The box is the folder's (18×16): it is the
 * widest of them, and a square `size-*` letterboxes it — the drawing sits
 * in a cell it does not fill, so a column of "the same size" was a column of
 * different optical sizes. The others meet against the left of that cell and
 * fill its height. The tree still has to reserve the fold-control's width on
 * a file row (`../Sidebar.tsx`) or the cell never becomes a column.
 *
 * And two of them are not ours. Vendored path data carries an attribution
 * obligation, which is a fact about specific bytes; one file holding all of
 * them, with the notice at the top, is the only arrangement where that notice
 * cannot drift away from what it is a notice FOR.
 *
 * Two surfaces draw from here, and that is the third reason: `../Sidebar.tsx`
 * puts a glyph on every row of the tree, and `../layout/Rail.tsx` — the same
 * column COLLAPSED — puts two of them on the buttons that stand for outlines
 * and for documents. Both faces of this column already agree about what is
 * owed (`../agenda/owed.ts`, drawn on each); they agree about what an outline
 * looks like for the same reason, and a reader who collapses the column has
 * not gone somewhere else.
 *
 * ## Where they come from
 *
 * The folder is VERBATIM from Pierre Computer Company's icon set
 * (https://github.com/pierrecomputer/icons, Apache-2.0): `IconFolder.svg`.
 * What changed on the way in is the wrapper and nothing inside it —
 * `fill="black"` becomes `currentColor` so a row's own ink reaches the glyph
 * (see below), the `width`/`height` attributes give way to a Tailwind size so
 * the glyph tracks the type scale, and `aria-hidden` is added because the word
 * beside it already says the name. The paths are untouched.
 *
 * That paragraph is the licence being satisfied and not merely a courtesy:
 * Apache-2.0 §4 wants the notices retained and the changes stated, and for a
 * path string shipped inside a browser bundle, the source, the licence and the
 * sentence above are where a reader will actually look. **The rule if a second
 * arrives** — and it is written here rather than remembered, because the habit
 * is what rots: one vendored snippet in one file is a header; vendored bytes
 * in a SECOND file is the moment this repo owes a real `NOTICE`, collected at
 * the dist root by `../build.ts` so the shipped artifact carries it and not
 * just the source.
 *
 * The OTHERS have no upstream, each for its own reason, and each says it at the
 * function that draws it.
 *
 * The outline, because no icon set has an olai outline in it.
 * It is drawn here, to the set's own metrics rather than to a guess at them:
 * `IconListUnordered.svg` is bullets of `r=1` against bars of `h=1.5` and
 * `rx=0.75`, and this is that with the second and third rows indented — which
 * is the whole of what an outline is and the whole of what distinguishes it
 * from the flat list it was traced from. It is spelled with `<circle>` and
 * `<rect>` where the vendored folder carries exported `<path>` data: same
 * shapes, and the source says what it draws.
 *
 * The markdown, because a page with lines on it is a generic file, and the
 * tree no longer writes `.md` after the name. What is drawn instead is the
 * markdown mark — an M and a down-arrow — the one shape in a directory that
 * can only mean markdown, the way `</>` can only mean markup.
 *
 * The hypertext mark, because the icon a set WOULD have for a `.html` is a page
 * with something on it. What is drawn instead is `</>`.
 *
 * The last three arrived with the viewers, and each answers the same question
 * this file has answered three times: what can this file be, that nothing else
 * in a directory is? A GRID is a table and a `.csv` is a table. A FRAMED
 * PICTURE — a rectangle with a horizon and a sun in it — is the one drawing
 * everybody already reads as "an image", and it is what an `<img>` shows. And
 * the `.pdf` is the one that had to take the shape the others turned down: a
 * SHEET with a folded corner. A page with lines on it was rejected twice above,
 * for markdown and for hypertext, on the argument that it is a generic file —
 * and that argument is exactly why it is right here. Every other kind in this
 * column says what it IS instead of what shape it comes in, so the shape is
 * free, and a `.pdf` is the one file in a vault whose whole nature is that it
 * is a sheet of paper somebody laid out and nobody can reflow.
 *
 * ## They take the row's ink, and that is a decision
 *
 * `currentColor`, never a colour of their own. Pierre's own tree paints its
 * icons per file type (a green markdown, an orange JSON — the probe in this
 * PR's evidence shows it), and that is right for a code host with forty
 * extensions to tell apart. This directory has SIX, and it is Workflowy-quiet:
 * every row is the column's own ink, the open file's row is the wash, and the
 * glyph is simply part of whichever of those the row already is. It also means
 * no second utility setting `color` on a row that has one — the trap
 * `../Sidebar.tsx`'s `ENTRY_SHAPE` is split in two to avoid.
 */

import type { FileKind } from "@olai/format"
import type { JSX } from "solid-js"

import { TESTID } from "../testids.ts"

/** The kinds of thing this directory is made of — every kind of FILE the format
 *  claims (`@olai/format`'s registry), plus the folders they sit under.
 *
 *  Named for the DIRECTORY and not for a row of the tree, because the tree is
 *  not the only place they are drawn: the rail draws two of them while the
 *  column is collapsed, and neither of those is a row. Exported for the sweep
 *  that says every registered kind has a drawing (../file/kinds.test.ts) — the
 *  tree passes a `FileRow`'s own `of`, the rail passes the literal it means. */
export type DirectoryKind = FileKind | "folder"

/** One kind, drawn: the box it is drawn in and the shape drawn in it, in one
 *  place because they are one drawing. Held apart — a `viewBox` chosen by one
 *  condition and a shape by another — the folder's 18-wide box and the
 *  folder's paths would be two answers to one question, agreeing by a rule
 *  nothing enforces, and every kind added since would have had to remember
 *  both. */
interface Drawn {
  readonly box: string
  readonly shape: () => JSX.Element
}

/** Every kind, and everything that is true of how it is drawn — the shape this
 *  client already reaches for whenever a closed set of kinds each carries a
 *  few facts (`../marks.tsx`'s `FACE`, `../agenda/owed.ts`'s `PAINT`,
 *  `../commit/said.ts`'s `MARK`, `../chat/Diff.tsx`'s `LOOK`). It is a
 *  `Record` over the union for the reason `marks.tsx` spells out beside its
 *  own: a kind added to the format's registry is then a compile error here —
 *  which is exactly what this file wants to be, since a drawing is the one
 *  thing no table can derive — rather than a row that quietly draws whatever
 *  the last arm of a chain of ternaries was. */
export const GLYPHS: Record<DirectoryKind, Drawn> = {
  // Wider than tall, as a folder is. The TREE cell below is this aspect, so
  // the square that used to wrap every glyph cannot letterbox it.
  folder: { box: "0 0 18 16", shape: FolderPaths },
  document: { box: "0 0 16 16", shape: DocumentPaths },
  outline: { box: "0 0 16 16", shape: OutlinePaths },
  hypertext: { box: "0 0 16 16", shape: HypertextPaths },
  csv: { box: "0 0 16 16", shape: CsvPaths },
  image: { box: "0 0 16 16", shape: ImagePaths },
  pdf: { box: "0 0 16 16", shape: PdfPaths },
}

/** The cell every tree glyph occupies. Height is the tree's 0.875rem; width
 *  follows the folder's 18×16 viewBox (`0.875rem * 18/16`). A square of that
 *  height letterboxes the folder — `size-3.5` was that square, and the four
 *  drawings that were supposed to share an optical box did not. The others
 *  meet against the left (`xMinYMid`) and fill the height, so the left edge
 *  is one edge and the names after the cell start in one column.
 *
 *  The rail passes a square of its own (`size-4`) and does not draw the
 *  folder, so this is the default and not the only size. */
const TREE_CELL = "h-3.5 w-[calc(0.875rem*18/16)]"

/** One kind's glyph. `data-glyph` is the fact a test reads; the shape is the
 *  fact a reader reads, and neither is the colour it happens to be painted.
 *
 *  The SIZE is the site's and not the drawing's, which is what the second
 *  consumer made obvious: a tree row is 0.875rem of glyph against 0.8125rem of
 *  type, and a rail button is 1rem of glyph beside four other 1rem buttons.
 *  Same drawing, two rooms. The default is the tree's, because that is where
 *  all but the rail's two are drawn. */
export function Glyph(props: { readonly of: DirectoryKind; readonly size?: string }) {
  const glyph = (): Drawn => GLYPHS[props.of]

  return (
    <svg
      class={`${props.size ?? TREE_CELL} shrink-0`}
      viewBox={glyph().box}
      preserveAspectRatio="xMinYMid meet"
      fill="currentColor"
      aria-hidden="true"
      data-testid={TESTID.fileGlyph}
      data-glyph={props.of}
    >
      {/* Called, not handed to `<Dynamic>`: that primitive is for a component
          that arrives at RUNTIME (`../menu/NodeMenu.tsx` says so beside its
          own), and these three are module-level functions over a closed union.
          Solid compiles this to the one insert `Dynamic` would have wrapped in
          two memos and a `splitProps`. */}
      {glyph().shape()}
    </svg>
  )
}

/** pierrecomputer/icons `IconFolder.svg`, verbatim (Apache-2.0). */
function FolderPaths() {
  return (
    <path d="M3.25 1C2.00736 1 1 2.00736 1 3.25V12.75C1 13.9926 2.00736 15 3.25 15H14.75C15.9926 15 17 13.9926 17 12.75V4.75C17 3.50736 15.9926 2.5 14.75 2.5H9.91548C9.77954 2.5 9.64617 2.46306 9.5296 2.39312L7.74214 1.32064C7.39246 1.11083 6.99232 1 6.58452 1H3.25ZM2.5 3.25C2.5 2.83579 2.83579 2.5 3.25 2.5H6.58452C6.72046 2.5 6.85383 2.53694 6.9704 2.60688L8.75786 3.67936C9.10754 3.88917 9.50768 4 9.91548 4H14.75C15.1642 4 15.5 4.33579 15.5 4.75V5H2.5V3.25Z" />
  )
}

/** The markdown mark — an M and a down-arrow — drawn here for the outline's
 *  reason and for one more: a page WITH LINES ON IT is a generic file, and
 *  this row no longer writes `.md` after the name, so the drawing has to say
 *  markdown and nothing else.
 *
 *  STROKED where the folder is filled, at the set's own 1.5, for the
 *  hypertext's reason: the outline's bars are 1.5 units thick, so a 1.5 stroke
 *  lands at the same weight. Inset to `2.5..14.5` for the same reason the
 *  outline is — it sits in a column beside a folder that occupies `1..17`. */
function DocumentPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 12.25 V3.75 L5.75 9.75 L9 3.75 V12.25" />
      <path d="M12.5 3.75 V10.5" />
      <path d="M10.5 8.5 L12.5 11.5 L14.5 8.5" />
    </g>
  )
}

/** The olai outline, drawn here — three bullets with the last two indented,
 *  on `IconListUnordered.svg`'s metrics (see the header).
 *
 *  Inset to `x≈1.5..14.5` rather than that icon's own `1..16`, because it does
 *  not stand alone: it sits in a column beside the vendored document, whose
 *  page occupies `1..15`. A list ruled to the very edge of its box read as a
 *  glyph CLIPPED by the one next to it — the same drawing, one unit narrower,
 *  reads as a list. */
function OutlinePaths() {
  return (
    <>
      <circle cx="2.5" cy="3" r="1" />
      <rect x="5.5" y="2.25" width="9" height="1.5" rx="0.75" />
      <circle cx="6" cy="8" r="1" />
      <rect x="9" y="7.25" width="5.5" height="1.5" rx="0.75" />
      <circle cx="6" cy="13" r="1" />
      <rect x="9" y="12.25" width="5.5" height="1.5" rx="0.75" />
    </>
  )
}

/** A `.csv`: a grid, which is a table, which is what the file is. Two rules
 *  and not more — a header row across the top and one column division — because
 *  at fourteen units square a third of either reads as a hatch rather than as
 *  cells. The header rule sits higher than the middle for the same reason the
 *  page draws the first row as a header: that is what a `.csv` is written with.
 *
 *  STROKED at the set's own 1.5, inset to `2..14`, for the hypertext mark's
 *  reason — it sits in a column beside a page that occupies `1..15`. */
function CsvPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
      <path d="M2 6.25 H14" />
      <path d="M8 6.25 V13.25" />
    </g>
  )
}

/** A picture: a frame with a horizon and a sun in it — the one drawing a reader
 *  does not have to be taught, and the thing an `<img>` puts on the page.
 *
 *  The SUN is a filled circle where everything else here is stroked, and that is
 *  the one exception in this file worth stating: a stroked ring at `r=1` inside
 *  a 1.5-weight frame reads as a hole rather than as a mark. It is the same
 *  shape the outline's bullets are drawn as, at the same radius, so the two
 *  glyphs still belong to one set.
 *
 *  Inset to `2..14` for the two beside it. */
function ImagePaths() {
  return (
    <>
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
        <path d="M2.75 11.5 L6.25 7.75 L8.75 10.25 L10.25 8.75 L13.25 11.75" />
      </g>
      <circle cx="10.25" cy="6" r="1" />
    </>
  )
}

/** A `.pdf`: a sheet with its corner folded, which is the one shape left in
 *  this column and the right one for the reason the header gives — a printed
 *  page laid out once and reflowed by nobody.
 *
 *  The FOLD is what stops it being the generic file this file rejected twice:
 *  a plain rectangle is a card, and the turned corner is what says paper. Two
 *  rules under it, short, so the sheet reads as a page with something on it
 *  without pretending to say what.
 *
 *  Stroked at 1.5 and inset to `3..13` — narrower than its neighbours, because
 *  a sheet of paper is taller than it is wide and a square one is a card. */
function PdfPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 2 H4.5 A1.5 1.5 0 0 0 3 3.5 V12.5 A1.5 1.5 0 0 0 4.5 14 H11.5 A1.5 1.5 0 0 0 13 12.5 V6 Z" />
      <path d="M9 2 V6 H13" />
      <path d="M5.75 9.5 H10.25" />
      <path d="M5.75 11.75 H8.75" />
    </g>
  )
}

/** Hypertext: `</>`, the mark every editor on earth uses for markup, drawn
 *  here for the reason the outline is — and for one more.
 *
 *  A page WITH LINES ON IT is taken: that used to be the document, and a
 *  `.html` drawn as a page with something else on it would be the same glyph
 *  at a glance, which is exactly the complaint #174 was filed against. So the
 *  drawing says what the file IS rather than what shape it comes in — angle
 *  brackets are markup and nothing else in a directory is.
 *
 *  STROKED where the other three are filled, at the set's own 1.5: the document's
 *  rules and the outline's bars are 1.5 units thick, so a 1.5 stroke lands at the
 *  same weight in the same optical box, and drawing chevrons as filled outlines
 *  would be four times the path data for a shape the eye reads as two lines.
 *  Inset to `2..14` for the outline's reason — it sits in a column beside a page
 *  that occupies `1..15`, and a mark ruled to the edge of its box reads as
 *  clipped by the one next to it. */
function HypertextPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M5.75 4.5 L2 8 L5.75 11.5" />
      <path d="M10.25 4.5 L14 8 L10.25 11.5" />
      <path d="M9 3.25 L7 12.75" />
    </g>
  )
}
