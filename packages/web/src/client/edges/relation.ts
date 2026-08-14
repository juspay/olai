/**
 * The two edges a node carries, as values: what each is called on screen, and
 * the {@link Edit} that adds or drops one target.
 *
 * `see` and `after` are one gesture over two fields — that is the ops layer's
 * own reading (`@olai/ops`' `planEdges`, one function for both `set_see` and
 * `set_after`), and it is why this client draws one panel and one refs row for
 * both rather than two of each. What differs between them is entirely in this
 * table: the words, and the fact that an `after` add can be refused for what it
 * MEANS (a loop) where a `see` never can.
 *
 * PURE, and no component: the menu's catalog is a pure function with a unit
 * test (`../menu/verbs.ts`), and the two entries it gained have to be
 * decidable there. The panel that opens is `./EdgePanel.tsx`.
 *
 * WHICH ID an edge names is the rule the whole editor is built on and it is not
 * this file's to answer: edges are facts about the node a row SHOWS — a mirror
 * carries none, by the format — so every caller passes the shown node's id, the
 * same one a mark and a date are written on.
 */

import type { Edit } from "@olai/surface"

/** The two fields an op may write. Deliberately NOT the format's own
 *  `after | blocks | see`: `a blocks b` IS `b after a`, and the ops layer
 *  writes that arrow one way so one relation is never on disk in two
 *  spellings. */
export type Relation = "see" | "after"

/** What one of them is called, wherever this client says it. */
export interface Relating {
  readonly relation: Relation
  /** The `•••` menu's entry. The ellipsis is what says a question follows —
   *  the same promise `Set date…` makes. */
  readonly verb: string
  /** What the panel calls itself once it is open. */
  readonly heading: string
  /** The label on the row of links a node draws (`../NodeRefs.tsx`) — the
   *  format's own word for the field, because that is what the file says and
   *  what an agent's tool is named after. */
  readonly label: string
  /** What the empty search box suggests. */
  readonly placeholder: string
}

export const RELATIONS: ReadonlyArray<Relating> = [
  {
    relation: "see",
    verb: "Link to a node…",
    heading: "See also",
    label: "see",
    placeholder: "search for a node to link to",
  },
  {
    relation: "after",
    verb: "Wait for a node…",
    heading: "Comes after",
    label: "after",
    placeholder: "search for a node this comes after",
  },
]

/** The descriptor for one relation — total, so a caller holding a
 *  {@link Relation} never has to handle "not found". */
export const relating = (relation: Relation): Relating =>
  RELATIONS.find((one) => one.relation === relation) as Relating

/** Name this target on the node's edge list — `set_see` / `set_after` with one
 *  id in `add`, which is what choosing a row in the panel means. */
export const linking = (id: string, relation: Relation, target: string): Edit => ({
  verb: relation,
  id,
  add: [target],
})

/** Take it off again — the `×` on a reference already drawn, and the same op
 *  the other way round. */
export const unlinking = (id: string, relation: Relation, target: string): Edit => ({
  verb: relation,
  id,
  remove: [target],
})
