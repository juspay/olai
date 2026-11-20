import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import type { Edit } from "@olai/surface"



export type Relation = "see" | "after"

export interface Relating {
  readonly relation: Relation
  readonly verb: string
  readonly heading: string
  readonly label: string
  readonly refs: TestId
  readonly placeholder: string
}

const RELATING: Record<Relation, Relating> = {
  see: {
    relation: "see",
    verb: "Link to…",
    heading: "See also",
    label: "See also",
    refs: TESTID.seeRefs,
    placeholder: "Search for a row to link",
  },
  after: {
    relation: "after",
    verb: "Wait for…",
    heading: "Comes after",
    label: "Comes after",
    refs: TESTID.afterRefs,
    placeholder: "Search for a row this comes after",
  },
}

export const relating = (relation: Relation): Relating => RELATING[relation]

export const RELATIONS: ReadonlyArray<Relating> = [RELATING.see, RELATING.after]

export const linking = (id: string, relation: Relation, target: string): Edit => ({
  verb: relation,
  id,
  add: [target],
})

export const unlinking = (id: string, relation: Relation, target: string): Edit => ({
  verb: relation,
  id,
  remove: [target],
})
