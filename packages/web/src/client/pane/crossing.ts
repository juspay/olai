/**
 * THE SEAM a drag between panes would cross, and does not.
 *
 * Each editable page owns its own drag (`../drag/dragging.ts`): it
 * measures the rows of THAT page when the gesture begins, in document
 * coordinates, and a drop is a `place` among those rows. Two panes are
 * two such pages, siblings over the one store, so the WRITE a drop would
 * make — move this node under that parent — is the write the outline
 * already does. What is missing is a measurement that can see rows in a
 * pane the gesture did not start in.
 *
 * Lifting the measure to the workspace (every visible tree, still one
 * `place`) is the crossing. It is not done here: the drag's lifetime is
 * a page's on purpose (`../edit/Editable.tsx`), and sharing one gesture
 * across two Editables is a rewrite of that lifetime, not a hook. Until
 * that rewrite, a row carried out of its pane has no landing and the
 * drop is declined — the same as a drop in the margin of its own page.
 *
 * Named so the follow-up has a door rather than a paragraph in a
 * brainstorm.
 */
export const CROSS_PANE_DRAG = "pane/crossing" as const
