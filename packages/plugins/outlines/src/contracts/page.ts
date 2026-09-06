import type { Agenda, DayGroup, Row, TrashGroup } from "@olai/format"
export type Drawn =
  /** An outline's roots, or a zoomed node's children — one shape, because a
   *  file is the widest zoom there is. */
  | { readonly kind: "tree"; readonly rows: ReadonlyArray<Row> }
  /** A day's dated nodes AND the note somebody wrote on it, because both are
   *  on the screen and a filter takes one of them away (`filter/narrowing.ts`
   *  says why prose can never be a match). */
  | {
    readonly kind: "day"
    readonly groups: ReadonlyArray<DayGroup>
    readonly notes: ReadonlyArray<string>
  }
  | { readonly kind: "agenda"; readonly agenda: Agenda }
  /** The archives with rows in them, and the FILES the directory holds —
   *  which is not the same list: what is drawn narrows with the query, and
   *  whether a pile is worth a file heading is a fact about the directory
   *  (`trash/TrashPage.tsx`). */
  | {
    readonly kind: "trash"
    readonly files: ReadonlyArray<string>
    readonly groups: ReadonlyArray<TrashGroup>
  }
  | { readonly kind: "none" }

