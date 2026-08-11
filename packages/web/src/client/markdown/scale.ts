/**
 * The type scale and the spacing scale rendered markdown is set on — the
 * closed sets every element of a note, a document and an agent's reply draws
 * from, and the one place any of those numbers is written.
 *
 * Why a table rather than the numbers in the sheet, where they used to be: a
 * `.md` file's tags carry no classes, so every rule for them is a descendant
 * rule in one shared stylesheet — which is exactly the place a drive-by
 * `margin: 6px` goes unnoticed. Off-scale values do not look broken one at a
 * time. They look like nothing at all until a page has four gaps that are
 * almost the same, and by then no one can say which was intended. So the
 * scales are DECLARED here, the sheet is generated from them
 * (`scaleCss()`, appended by `src/build.ts` exactly as the palettes are), and
 * `packages/tests` walks a rendered document and a rendered note asserting
 * that every computed font-size, line-height, margin, padding and border is a
 * value from these sets. A rhythm nobody can measure is a rhythm that lasts
 * until the next edit.
 *
 * Everything is in `rem`, so a heading is the same size wherever markdown is
 * drawn: the chat drawer sets `text-sm` on its block, and a scale in `em`
 * would quietly shrink an agent's `##` to something else than a note's.
 *
 * ## The step
 *
 * Every value below is a whole multiple of 0.125rem (2px at the default root),
 * which is what makes "is this on the scale" a question with an answer. The
 * two odd-looking ones are on it: 1.125rem is 9 steps and 1.0625rem is 8.5 —
 * see `UNDER_TITLE`, the one place a half-step is spent, and why.
 *
 * ## Where this deviates from the reference, and why
 *
 * Compared against GitHub's own markdown stylesheet (`github-markdown-css`,
 * rendered side by side over this same fixture — the comparison is a
 * scratch artefact, not a checked-in one):
 *
 *   - **Block gaps are 0.25rem, not 1rem.** GitHub sets 16px between every
 *     block. This is an OUTLINER: a note is drawn inside a row of a tree, and
 *     a paragraph that reserved a line of space above and below it would push
 *     the next node off the screen. The gap between blocks is small and the
 *     gap above a HEADING is large (1.5rem), so structure comes from the
 *     headings rather than from uniform air.
 *   - **Headings are smaller, and undecorated.** GitHub's `h1` is 2em and both
 *     it and `h2` carry a rule underneath. Ours is 1.5rem with no rule: a
 *     document here opens under its path in the page's own chrome, so a
 *     `# Title` that outsized that would compete with the page for the top of
 *     the screen — and a horizontal rule under a heading, in a view where
 *     `---` is itself a thing an author writes, would be a line nobody typed.
 *   - **Six sizes, not five.** GitHub separates `h1`–`h5` by size and then
 *     falls back to muted grey for `h6`; we keep six distinct steps and reach
 *     for the same muted ink at the bottom, plus letterspaced caps — so the
 *     last two are told apart from each other as well as from the text.
 *   - **A note's headings are clamped** (`UNDER_TITLE`). GitHub has no such
 *     context — nothing there is drawn under a title that belongs to the page.
 *   - **Tables are ruled, not gridded**, and cells are tighter than GitHub's
 *     6px/13px. A table here is usually four rows inside a note, not a data
 *     sheet.
 *
 * Everything else — the fence's padding, the blockquote's 3px rule and muted
 * ink, the list indent, footnotes set smaller behind a rule — follows the
 * reference deliberately, because a reader has read a thousand of those.
 */

/** The unit every value below is a whole multiple of. */
export const STEP_REM = 0.125

/** A value on the spacing scale, in `rem`. */
export type Space = (typeof SPACE)[keyof typeof SPACE]

/**
 * Vertical margins. Six values, and each has one job:
 *
 *   - `none` — an edge. The first and last child of any container that would
 *     otherwise open with a gap of its own on top of the container's.
 *   - `block` — between two blocks of the same run of prose.
 *   - `tight` — under a heading, to its own first line; and between two
 *     headings, which have nothing between them to separate.
 *   - `note` — above a heading inside a note, where `section` would be a hole.
 *   - `rule` — around a horizontal rule and above the footnotes: a break.
 *   - `section` — above a heading. The one big gap, and what makes a document
 *     read as sections rather than as evenly spaced text.
 */
export const SPACE = {
  none: 0,
  block: 0.25,
  tight: 0.5,
  note: 0.75,
  rule: 1,
  section: 1.5,
} as const

/**
 * Padding. `chip` is the inline code background, `cell` a table cell, `fence`
 * a code block, `quote` the gap between a blockquote's rule and its text, and
 * `list` the indent a marker hangs in.
 */
export const PAD = {
  none: 0,
  chipY: 0.125,
  chipX: 0.25,
  cellY: 0.25,
  fenceY: 0.5,
  cellX: 0.75,
  fenceX: 0.75,
  quoteX: 0.75,
  listX: 1.25,
} as const

/**
 * Font sizes, by the element that draws them. `body` is not here on purpose:
 * a block of markdown inherits the size of whatever it is drawn in (16px on a
 * page, 14px in the chat drawer), and every element that is not a heading
 * inherits from it in turn.
 */
export const TYPE = {
  h1: 1.5,
  h2: 1.25,
  h3: 1.125,
  h4: 1,
  h5: 0.875,
  h6: 0.875,
} as const

/**
 * The ceiling for markdown drawn UNDER a title the page owns — a note, and the
 * document an open node attaches. Three levels are re-answered; `h4` down
 * already sits at or below the body's size, and re-stating those would be a
 * second copy of the scale to keep in step for no effect.
 *
 * 1.0625rem is the one half-step in the whole table (8.5 × 0.125rem). It is
 * spent here because the number it has to sit under is the node title's
 * 1.5rem and the number it has to stay above is the body's 1rem: a full step
 * either way is either shouting or invisible. A half-step is cheaper than a
 * second grid.
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
 * that is read as sentences sets `body` — including a fence, where 1.5 is what
 * keeps a stack of code from reading as a wall.
 *
 * `none` is `sup`'s, from the preflight: a superscript sets `line-height: 0`
 * so it cannot grow the line it is raised out of.
 */
export const LEADING = {
  heading: 1.25,
  body: 1.5,
  none: 0,
} as const

/** Border widths, in px — the one place `rem` would be wrong, since a hairline
 *  is a hairline at any type size. `rule` draws every line the sheet draws;
 *  `quote` is the blockquote's bar, which has to read as a bar. */
export const BORDER_PX = {
  none: 0,
  rule: 1,
  quote: 3,
} as const

/** `rem` as a CSS length. Whole numbers keep their `rem` unit rather than
 *  collapsing to `0`, so a generated declaration always reads as a length. */
const rem = (value: number): string => `${value}rem`

/** The custom property a scale value is read through. One spelling, so the
 *  sheet and this generator cannot disagree about a name. */
export const property = (name: string): string => `--olai-md-${name}`

/** The class a block of rendered markdown always carries. */
export const BLOCK_CLASS = "olai-md"

/** The class it carries as well when it is drawn under a title of the page's
 *  own (`Note.tsx`, and `document/DocRef.tsx`'s inline shape). */
export const UNDER_TITLE_CLASS = "olai-md-under-title"

/**
 * The scale, as the CSS that puts it in force: one block of custom properties
 * on every rendered block, and one that re-answers three of them for markdown
 * under a title.
 *
 * The override is a REDEFINITION rather than a second set of rules, which is
 * the same shape the palettes use (`theme/css.ts`) and for the same reason:
 * every heading rule in `styles.css` already reads `var(--olai-md-h2)`, so one
 * block re-answers all of them at once — and there is no specificity tie
 * between two selectors of equal weight to be broken by source order.
 */
export const scaleCss = (): string => {
  const base = [
    ...Object.entries(TYPE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    ...Object.entries(SPACE).map(([name, size]) => `  ${property(`space-${name}`)}: ${rem(size)};`),
    ...Object.entries(PAD).map(([name, size]) => `  ${property(`pad-${name}`)}: ${rem(size)};`),
    ...Object.entries(RELATIVE).map(([name, factor]) => `  ${property(`of-${name}`)}: ${factor};`),
    ...Object.entries(LEADING).map(([name, ratio]) => `  ${property(`leading-${name}`)}: ${ratio};`),
    ...Object.entries(BORDER_PX).map(([name, width]) => `  ${property(`border-${name}`)}: ${width}px;`),
    // The gap above a heading, as a property rather than a literal, because it
    // is the one spacing value the under-title context also re-answers.
    `  ${property("heading-top")}: ${rem(SPACE.section)};`,
  ]
  const underTitle = [
    ...Object.entries(UNDER_TITLE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    `  ${property("heading-top")}: ${rem(SPACE.note)};`,
  ]
  return [
    "/* The markdown type and spacing scales — GENERATED from",
    " * packages/web/src/client/markdown/scale.ts. Do not edit: edit the table.",
    " * packages/tests asserts the rendered page against these same values. */",
    `.${BLOCK_CLASS} {\n${base.join("\n")}\n}`,
    `.${UNDER_TITLE_CLASS} {\n${underTitle.join("\n")}\n}`,
    "",
  ].join("\n")
}
