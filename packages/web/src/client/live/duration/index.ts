/**
 * THE DURATION CHIP — a live face that does NOT ride the seam's table, and the
 * one folder here whose header is mostly about why.
 *
 * The ⏱ beside a row is the same idea as the two dressings next door: a value
 * that MOVES ON ITS OWN, drawn off an instant that crossed the wire once and
 * ticked by the reader's own clock (`./took.ts`, the two-speed seam the header
 * uptime chip shares). A `doing` row's pomodoro is the live-properties idea
 * pointed inward — the running thing is the task itself rather than something
 * the task names.
 *
 * ## Why it registers nothing
 *
 * The seam is a table over PROPERTY KEYS (`../seam.ts`), and this face has no
 * key to hang off. A span is not written anywhere: it is DERIVED from two of
 * the record's own fields — `started`, and whichever settling mark closed it —
 * by `@olai/format`'s `tookOf`. There is no `custom` entry called `took`, so
 * `dressingFor` has nothing to look up and `layOut` has no entry to dress.
 *
 * That is also why the chip is drawn where it is: `../../NodeLine.tsx`'s `took`
 * slot, filled by `../../Tree.tsx` and `../../day/DayNode.tsx` from the record
 * itself. The drawer never sees it, because the drawer draws properties.
 *
 * ## What moving it would take, stated so the option stays open
 *
 * Two things, and neither is small. The seam would have to be keyed on
 * something wider than a property key — "a face over this NODE" beside "a face
 * over this property" — which is a second table with a second lookup and a
 * second set of the three chip rules. And the drawer would have to be the
 * place a row's own facts are drawn, which it deliberately is not: the run is
 * the CUSTOM half only, because "the node's own facts are already on screen
 * when you are looking at a row — the mark is the glyph, the date is the
 * badge" (`../../props/PropsDrawer.tsx`'s standing rule). Moving the span into
 * the run would put a second spelling of a fact under a title that already
 * shows it, which is the thing that run must not be.
 *
 * So the folder is here, named for what it is, holding the whole of the face —
 * and the seam has one fewer tenant than the directory has folders. That is
 * the honest shape rather than a table stretched to make three.
 */

/** THE CHIP, and nothing else. The ladders and the clock (`./took.ts`) are
 *  read inside this folder and by `../odu-ci/`, which reaches the module
 *  directly because it is a SIBLING under `live/` rather than a consumer of
 *  this dressing — a door is for the app, and what the app draws is the chip. */
export { TookChip } from "./TookChip.tsx"
