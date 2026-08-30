/**
 * THE DURATION CHIP — a live face that does NOT ride the seam's table, and the
 * one folder here whose header is mostly about why.
 *
 * The ⏱ beside a row is the same idea as the dressings the plugins register: a
 * value that MOVES ON ITS OWN, drawn off an instant that crossed the wire once
 * and ticked by the reader's own clock (`./took.ts`, the two-speed seam the header
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
 * and it is now the ONLY folder under `live/`, which reads as an accident and
 * is not. Its two former neighbours were dressings, and a dressing is a
 * PLUGIN'S; they left for `@olai/plugin-kolu` and `@olai/plugin-odu` with the
 * names they claimed. This one claims no name, registers nothing, and is drawn
 * by the row — so it is the app's, and it stayed.
 */

/** THE CHIP, and nothing else. The ladders and the clock (`./took.ts`) are read
 *  inside this folder and by `../../plugins/furniture.tsx`, which HANDS THEM
 *  ACROSS to every plugin that draws a live face — the CI chip ticks in this
 *  register, one wall over, because a reader who has learnt what a ticking
 *  number looks like in olai should not have to learn it again. That reach is
 *  the module and not this door on purpose: a door is for the app, and what the
 *  app draws is the chip. */
export { TookChip } from "./TookChip.tsx"
