/**
 * WHAT A SURFACE WEARS while it is holding markdown source it cannot render
 * yet.
 *
 * There is one waiting state in this app and it must look the same wherever it
 * happens — a document body, a `¶` note, the day's note, a preview, a
 * referrer's body, an agent's reply, a tree row's title, a palette or search
 * row. The LOOK is one rule in ../styles.css, keyed on the attribute below:
 * the source blurred out of legibility and swept, so its box is still the size
 * the real characters make and no reader is shown raw `**` (roadmap
 * `markdown-raw-flash`).
 *
 * This is the other half of it — the two attributes that rule keys on, and the
 * one place they are decided. Exactly two components draw a waiting surface:
 * ./Markdown.tsx for every block, ./TitleHtml.tsx for the two places a title
 * is drawn as HTML. A third would be a surface with a loading face of its own,
 * which is the thing "one rule for every surface" is a promise against.
 *
 * `aria-busy` rides with the attribute because a blur is nothing to a screen
 * reader: the raw source is still in the DOM, and without this it is read out
 * as though it were the text somebody wrote.
 *
 * VALUES rather than an object to spread, and that is not a style preference:
 * Solid compiles `data-markdown={…}` to a setter inside the one effect it
 * already makes for the element, and `{...face}` to `mergeProps` + `spread` —
 * a Proxy, three render effects and a key walk per element, on the path that
 * draws every row of a tree.
 *
 * NOT the failed state, which is a different word on the same attribute
 * (`data-markdown="failed"`, ./Markdown.tsx) and deliberately not dressed:
 * once no renderer is coming, the source IS the answer and has to be legible.
 * ./chunk.ts's `markdownWaiting` is what keeps the two apart.
 */

/** The `data-markdown` a waiting surface carries — the sheet's hook, and a
 *  scenario's. */
export const waitingMark = (waiting: boolean): "waiting" | undefined =>
  waiting ? "waiting" : undefined

/** ...and the `aria-busy` beside it, which says the same thing to a reader who
 *  is not looking at the screen. */
export const busyMark = (waiting: boolean): "true" | undefined =>
  waiting ? "true" : undefined
