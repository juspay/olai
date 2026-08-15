/**
 * What KIND of thing in the directory this is, said in a glyph.
 *
 * The complaint this answers was filed from a screenshot: the sidebar's tree
 * drew `garden.olai`, `finishes.md` and `notes` in the same ink at the same
 * weight, so the only thing separating an OUTLINE from a DOCUMENT was four
 * characters of extension the eye has to read, and the only thing marking a
 * FOLDER was a triangle it shares with every fold control in the app. Three
 * kinds, one face. A glyph is the cheapest fix that is also the right one: it
 * is read before the word beside it, it costs no row height, and it is the one
 * thing Workflowy's own quiet leaves room for.
 *
 * ## A file of its own, where every other icon in this client is inline
 *
 * The house pattern for an icon is an `<svg>` written where it is drawn, with
 * a comment naming it (`../layout/Rail.tsx` still has three, `../Sidebar.tsx`'s
 * collapse chevron is a fourth). Two things make these three not that, and both
 * are about the SET rather than about any one of them.
 *
 * They have to agree: three drawings in one column, at one weight, in one
 * optical box, chosen by a value the tree already carries. That is a table,
 * and a table wants a home — inline, the folder's box and the folder's shape
 * would sit in one file while the document's sat in another, and the rule that
 * they match would be nowhere.
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
 * The folder and the text document are VERBATIM from Pierre Computer Company's
 * icon set (https://github.com/pierrecomputer/icons, Apache-2.0):
 * `IconFolder.svg` and `IconFileText.svg`. What changed on the way in is the
 * wrapper and nothing inside it — `fill="black"` becomes `currentColor` so a
 * row's own ink reaches the glyph (see below), the `width`/`height` attributes
 * give way to a Tailwind size so the glyph tracks the type scale, and
 * `aria-hidden` is added because the word beside it already says the name. The
 * paths are untouched; that is what makes the third one drawable.
 *
 * That paragraph is the licence being satisfied and not merely a courtesy:
 * Apache-2.0 §4 wants the notices retained and the changes stated, and for two
 * path strings shipped inside a browser bundle, the source, the licence and the
 * sentence above are where a reader will actually look. **The rule if a third
 * arrives** — and it is written here rather than remembered, because the
 * habit is what rots: two vendored snippets in one file is a header; vendored
 * bytes in a SECOND file is the moment this repo owes a real `NOTICE`,
 * collected at the dist root by `../build.ts` so the shipped artifact carries
 * it and not just the source. Reviewer's nit, adopted as the trigger rather
 * than as the file, because a `NOTICE` naming one file is the drift it exists
 * to prevent.
 *
 * The THIRD has no upstream, because no icon set has an olai outline in it.
 * It is drawn here, to the set's own metrics rather than to a guess at them:
 * `IconListUnordered.svg` is bullets of `r=1` against bars of `h=1.5` and
 * `rx=0.75`, and this is that with the second and third rows indented — which
 * is the whole of what an outline is and the whole of what distinguishes it
 * from the flat list it was traced from. It is spelled with `<circle>` and
 * `<rect>` where the vendored two carry exported `<path>` data: same shapes,
 * and the source says what it draws.
 *
 * ## They take the row's ink, and that is a decision
 *
 * `currentColor`, never a colour of their own. Pierre's own tree paints its
 * icons per file type (a green markdown, an orange JSON — the probe in this
 * PR's evidence shows it), and that is right for a code host with forty
 * extensions to tell apart. This directory has TWO, and it is Workflowy-quiet:
 * a folder row is `text-muted`, a file row is `text-ink`, the open file's row
 * is `text-accent` and semibold, and the glyph is simply part of whichever of
 * those the row already is. It also means no second utility setting `color` on
 * a row that has one — the trap `../Sidebar.tsx`'s `ENTRY_SHAPE` is split in
 * two to avoid.
 */

import type { JSX } from "solid-js"

import { type FileOf } from "../fileTree.ts"
import { TESTID } from "../testids.ts"

/** The three kinds of thing this directory is made of — the two kinds of FILE,
 *  plus the folders they sit under.
 *
 *  Named for the DIRECTORY and not for a row of the tree, because the tree is
 *  not the only place they are drawn: the rail draws two of them while the
 *  column is collapsed, and neither of those is a row. Not exported — the tree
 *  passes a `FileRow`'s own `of`, the rail passes the literal it means. */
type DirectoryKind = FileOf | "folder"

/** One kind, drawn: the box it is drawn in and the shape drawn in it, in one
 *  place because they are one drawing. Held apart — a `viewBox` chosen by one
 *  condition and a shape by another — the folder's 18-wide box and the
 *  folder's paths would be two answers to one question, agreeing by a rule
 *  nothing enforces, and a fourth kind would have to remember both. */
interface Drawn {
  readonly box: string
  readonly shape: () => JSX.Element
}

/** Every kind, and everything that is true of how it is drawn — the shape this
 *  client already reaches for whenever a closed set of kinds each carries a
 *  few facts (`../Checkbox.tsx`'s `FACE`, `../agenda/owed.ts`'s `PAINT`,
 *  `../commit/said.ts`'s `MARK`, `../chat/Diff.tsx`'s `LOOK`). It is a
 *  `Record` over the union for the reason `Checkbox.tsx` spells out beside its
 *  own: a fourth kind is then a compile error here rather than a row that
 *  quietly draws whatever the last arm of a chain of ternaries was. */
const GLYPHS: Record<DirectoryKind, Drawn> = {
  // Wider than tall, as a folder is; the square box would letterbox it.
  folder: { box: "0 0 18 16", shape: FolderPaths },
  document: { box: "0 0 16 16", shape: DocumentPaths },
  outline: { box: "0 0 16 16", shape: OutlinePaths },
}

/** One kind's glyph. `data-glyph` is the fact a test reads; the shape is the
 *  fact a reader reads, and neither is the colour it happens to be painted.
 *
 *  The SIZE is the site's and not the drawing's, which is what the second
 *  consumer made obvious: a tree row is 0.875rem of glyph against 0.8125rem of
 *  type, and a rail button is 1rem of glyph beside four other 1rem buttons.
 *  Same drawing, two rooms. The default is the tree's, because that is where
 *  three of the four are drawn. */
export function Glyph(props: { readonly of: DirectoryKind; readonly size?: string }) {
  const glyph = (): Drawn => GLYPHS[props.of]

  return (
    <svg
      class={`${props.size ?? "size-3.5"} shrink-0`}
      viewBox={glyph().box}
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

/** pierrecomputer/icons `IconFileText.svg`, verbatim (Apache-2.0) — a page
 *  with lines on it, which is what a `.md` under this directory is. */
function DocumentPaths() {
  return (
    <>
      <path d="M11.25 10C11.6642 10 12 10.3358 12 10.75C12 11.1642 11.6642 11.5 11.25 11.5H4.75C4.33579 11.5 4 11.1642 4 10.75C4 10.3358 4.33579 10 4.75 10H11.25ZM11.25 7C11.6642 7 12 7.33579 12 7.75C12 8.16421 11.6642 8.5 11.25 8.5H4.75C4.33579 8.5 4 8.16421 4 7.75C4 7.33579 4.33579 7 4.75 7H11.25ZM7.25 4C7.66421 4 8 4.33579 8 4.75C8 5.16421 7.66421 5.5 7.25 5.5H4.75C4.33579 5.5 4 5.16421 4 4.75C4 4.33579 4.33579 4 4.75 4H7.25Z" />
      <path d="M10.75 0C10.9489 0 11.1396 0.0790743 11.2803 0.219727L14.7803 3.71973C14.9209 3.86038 15 4.05109 15 4.25V13.25C15 14.7688 13.7688 16 12.25 16H3.75C2.23122 16 1 14.7688 1 13.25V2.75C1 1.23122 2.23122 0 3.75 0H10.75ZM3.75 1.5C3.05964 1.5 2.5 2.05964 2.5 2.75V13.25C2.5 13.9404 3.05964 14.5 3.75 14.5H12.25C12.9404 14.5 13.5 13.9404 13.5 13.25V5H12.25C11.0074 5 10 3.99264 10 2.75V1.5H3.75Z" />
    </>
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
