/**
 * The type scale and the spacing scales rendered markdown is set on — the
 * closed sets every element of a document, a note and an agent's reply draws
 * from, and the one place any of those numbers is written.
 *
 * Why a table rather than the numbers in the sheet, where they used to be: a
 * `.md` file's tags carry no classes, so every rule for them is a descendant
 * rule in one shared stylesheet — which is exactly the place a drive-by
 * `margin: 6px` goes unnoticed. Off-scale values do not look broken one at a
 * time. They look like nothing at all until a page has four gaps that are
 * almost the same, and by then no one can say which was intended. So the
 * scales are DECLARED here, the sheet is generated from them (`scaleCss()`,
 * appended by `src/build.ts` exactly as the palettes are), and
 * `packages/tests` walks a rendered document and a rendered note asserting
 * that every computed size, gap, pad, weight and border is a value from these
 * sets — against the set for the context it is in. A rhythm nobody can measure
 * is a rhythm that lasts until the next edit.
 *
 * Everything is in `rem`, so a heading is the same size wherever markdown is
 * drawn: the chat drawer sets `text-sm` on its block, and a scale in `em`
 * would quietly shrink an agent's `##` to something else than a document's.
 *
 * ## Two densities, because there are two kinds of place
 *
 * A DOCUMENT is a reading page: it is the whole main pane, somebody opened it
 * to read it, and it is set like a page — a full line of air between blocks,
 * headings that carry their own weight. This is the base, `.olai-md`.
 *
 * Everything else is markdown drawn INSIDE the app's furniture — a note under
 * a node's title, the document an open node attaches, an agent's reply in a
 * 26rem drawer. Those are `.olai-md-compact`: the same proportions one notch
 * tighter, plus a ceiling on the heading sizes, because all three hang under a
 * title the page owns and a body that out-shouts its own title is a body
 * nobody can skim.
 *
 * The two are one table read twice, not two designs: every key in `reading`
 * exists in `compact`, which is what keeps them proportional and what lets the
 * test pick a set by asking the page which context it is in.
 *
 * ## The step
 *
 * Every value below is a whole multiple of 0.125rem (2px at the default root),
 * which is what makes "is this on the scale" a question with an answer. The
 * one exception is the compact heading ceiling — see `UNDER_TITLE`.
 *
 * ## Where this deviates from the reference, and why
 *
 * Compared against GitHub's own markdown stylesheet (`github-markdown-css`,
 * rendered side by side over this repository's own `docs/`):
 *
 *   - **The document scale follows it closely, and did not always.** It was
 *     denser — 4px between blocks, headings a step smaller and undecorated —
 *     on the argument that a note lives inside a tree row. That argument was
 *     tested against real documents and lost: paragraphs at 4px on 24px lines
 *     read as one wall, fences hugged their neighbours, and four heading
 *     levels at one weight were not tellable apart. A document is a reading
 *     page. The density argument was right about the OTHER context, which is
 *     what `compact` now is.
 *   - **`h1` and `h2` carry a rule, as GitHub's do.** The earlier objection —
 *     that `---` is also a rule an author writes — is real but smaller than
 *     the problem it was avoiding: a heading has a rule tight under it with
 *     text following, an `hr` has a full line of air on both sides, and they
 *     do not read alike. Distinguishable beats tidy.
 *   - **Six sizes, not five.** GitHub separates `h1`–`h5` by size and then
 *     falls back to muted grey for `h6`; we keep six distinct steps and reach
 *     for the same muted ink at the bottom, plus letterspaced caps — so the
 *     last two are told apart from each other as well as from the text.
 *   - **Tables are ruled, not gridded.** A table here is usually four rows
 *     inside a document about a decision, not a data sheet, and a full grid
 *     draws four borders around every cell to say what one line says.
 *   - **A compact block's headings are clamped** (`UNDER_TITLE`). GitHub has
 *     no such context — nothing there is drawn under a title that belongs to
 *     the page rather than to the text.
 */

/** The unit every value below is a whole multiple of. */
export const STEP_REM = 0.125

/** The two contexts a block of markdown can be set in. */
export type Density = "reading" | "compact"

export const DENSITIES: readonly Density[] = ["reading", "compact"]

/**
 * Vertical margins, per density. Same keys in both, so the two are one design
 * at two sizes rather than two designs:
 *
 *   - `none` — an edge: the last child of a container that already pads or
 *     rules its contents.
 *   - `item` — between two list items. Small, but never zero: a "tight" list
 *     whose items wrap to four lines has to still read as items.
 *   - `headBottomMinor` / `headBottomMajor` — a heading to its own first line.
 *   - `block` — under every block of prose. THE gap: this is what makes a
 *     paragraph a paragraph rather than part of the wall above it.
 *   - `headTopMinor` / `headTopMajor` — above a heading, and always clearly
 *     more than that heading leaves below itself, because the space belongs to
 *     the section that ended.
 *   - `rule` — around an `hr`, and above the footnotes: a break.
 */
export const SPACE = {
  reading: {
    none: 0,
    item: 0.25,
    headBottomMinor: 0.5,
    headBottomMajor: 0.75,
    block: 1,
    headTopMinor: 1.5,
    rule: 1.5,
    headTopMajor: 2,
  },
  compact: {
    none: 0,
    item: 0.25,
    headBottomMinor: 0.25,
    headBottomMajor: 0.5,
    block: 0.5,
    headTopMinor: 0.75,
    rule: 1,
    headTopMajor: 1,
  },
} as const satisfies Record<Density, Record<string, number>>

/**
 * Padding, per density. `chip` is the inline code background, `cell` a table
 * cell, `fence` a code block, `quote` the gap between a blockquote's rule and
 * its text, `list` the indent a marker hangs in, and `headRule` the gap
 * between a heading and the line under it — zero in a compact block, which
 * draws no such line.
 */
export const PAD = {
  reading: {
    none: 0,
    chipY: 0.125,
    chipX: 0.25,
    headRule: 0.25,
    cellY: 0.375,
    cellX: 0.75,
    fenceY: 0.75,
    fenceX: 1,
    quoteX: 1,
    listX: 1.5,
  },
  compact: {
    none: 0,
    chipY: 0.125,
    chipX: 0.25,
    headRule: 0,
    cellY: 0.25,
    cellX: 0.625,
    fenceY: 0.5,
    fenceX: 0.75,
    quoteX: 0.75,
    listX: 1.25,
  },
} as const satisfies Record<Density, Record<string, number>>

/**
 * Font sizes, by the element that draws them. `body` is not here on purpose: a
 * block of markdown inherits the size of whatever it is drawn in (16px on a
 * page, 14px in the chat drawer), and every element that is not a heading
 * inherits from it in turn.
 *
 * Six values with real distance between the top three, which is what makes a
 * level recognisable from across the page rather than only next to its
 * neighbour.
 */
export const TYPE = {
  h1: 2,
  h2: 1.5,
  h3: 1.25,
  h4: 1,
  h5: 0.875,
  h6: 0.875,
} as const

/**
 * The ceiling in a compact block — under a title the page owns. Three levels
 * are re-answered; `h4` down already sits at or below the body's size, and
 * re-stating those would be a second copy of the scale to keep in step for no
 * effect.
 *
 * 1.0625rem is the one half-step in the whole table (8.5 × 0.125rem). It is
 * spent here because the number it has to sit under is the node title's 1.5rem
 * and the number it has to stay above is the body's 1rem: a full step either
 * way is either shouting or invisible. A half-step is cheaper than a second
 * grid.
 */
export const UNDER_TITLE = {
  h1: 1.0625,
  h2: 1.0625,
  h3: 1,
} as const

/**
 * Sizes that are a FRACTION of whatever they sit in, rather than a step on the
 * scale — because each is a mark about its surroundings, not a level of its
 * own. Code is smaller than the prose it interrupts at any size; a footnote is
 * smaller than the document it belongs to; `sup` is the browser's own (from
 * Tailwind's preflight) and is here so the test knows it was not an accident.
 */
export const RELATIVE = {
  code: 0.875,
  footnotes: 0.875,
  sup: 0.75,
} as const

/**
 * Line heights, as a ratio of the element's own size. Two, and the split is
 * the same one the sizes make: a heading is a label and sets tight, everything
 * read as sentences sets `body` — including a fence, where 1.5 is what keeps a
 * stack of code from reading as a wall.
 *
 * `none` is `sup`'s, from the preflight: a superscript sets `line-height: 0`
 * so it cannot grow the line it is raised out of.
 */
export const LEADING = {
  heading: 1.25,
  body: 1.5,
  none: 0,
} as const

/**
 * Weights. `major` is `h1` and `h2` — the two levels that also carry a rule —
 * because "which heading is this" should be answerable by more than a few
 * pixels of size, and weight is the axis that survives being skimmed.
 * `text` is what everything else inherits, and `strong` reaches for `major`.
 */
export const WEIGHT = {
  text: 400,
  heading: 600,
  major: 700,
} as const

/** Border widths, in px — the one place `rem` would be wrong, since a hairline
 *  is a hairline at any type size. `rule` draws every line the sheet draws;
 *  `quote` is the blockquote's bar, which has to read as a bar. */
export const BORDER_PX = {
  none: 0,
  rule: 1,
  quote: 3,
} as const

/** The line under `h1` and `h2` — the reading context's, and nothing in a
 *  compact block, where a rule inside a tree row would be furniture drawn on
 *  top of furniture. */
export const HEAD_BORDER_PX = {
  reading: BORDER_PX.rule,
  compact: BORDER_PX.none,
} as const satisfies Record<Density, number>

/** `rem` as a CSS length. */
const rem = (value: number): string => `${value}rem`

/** The custom property a scale value is read through. One spelling, so the
 *  sheet and this generator cannot disagree about a name. */
export const property = (name: string): string => `--olai-md-${name}`

/** The class a block of rendered markdown always carries. */
export const BLOCK_CLASS = "olai-md"

/** The class it carries as well when it is drawn inside the app's furniture
 *  rather than as a page: `Note.tsx`, `document/DocRef.tsx`'s inline shape,
 *  and `chat/Entry.tsx`. */
export const COMPACT_CLASS = "olai-md-compact"

/** Every declaration a density answers: its spacing, its padding, and the line
 *  under its major headings. */
const densityDeclarations = (density: Density): string[] => [
  ...Object.entries(SPACE[density]).map(
    ([name, size]) => `  ${property(`space-${name}`)}: ${rem(size)};`,
  ),
  ...Object.entries(PAD[density]).map(
    ([name, size]) => `  ${property(`pad-${name}`)}: ${rem(size)};`,
  ),
  `  ${property("border-head")}: ${HEAD_BORDER_PX[density]}px;`,
]

/**
 * The scales, as the CSS that puts them in force: one block of custom
 * properties on every rendered block, and one that re-answers the spacing, the
 * padding and three of the sizes for a compact one.
 *
 * The override is a REDEFINITION rather than a second set of rules, which is
 * the same shape the palettes use (`theme/css.ts`) and for the same reason:
 * every rule in `styles.css` already reads `var(--olai-md-…)`, so one block
 * re-answers all of them at once — and there is no pair of equal-weight
 * selectors whose order decides the answer.
 */
export const scaleCss = (): string => {
  const base = [
    ...Object.entries(TYPE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    ...Object.entries(RELATIVE).map(([name, factor]) => `  ${property(`of-${name}`)}: ${factor};`),
    ...Object.entries(LEADING).map(([name, ratio]) => `  ${property(`leading-${name}`)}: ${ratio};`),
    ...Object.entries(WEIGHT).map(([name, weight]) => `  ${property(`weight-${name}`)}: ${weight};`),
    ...Object.entries(BORDER_PX).map(
      ([name, width]) => `  ${property(`border-${name}`)}: ${width}px;`,
    ),
    ...densityDeclarations("reading"),
  ]
  const compact = [
    ...Object.entries(UNDER_TITLE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    ...densityDeclarations("compact"),
  ]
  return [
    "/* The markdown type and spacing scales — GENERATED from",
    " * packages/web/src/client/markdown/scale.ts. Do not edit: edit the table.",
    " * packages/tests asserts the rendered page against these same values. */",
    `.${BLOCK_CLASS} {\n${base.join("\n")}\n}`,
    `.${COMPACT_CLASS} {\n${compact.join("\n")}\n}`,
    "",
  ].join("\n")
}
