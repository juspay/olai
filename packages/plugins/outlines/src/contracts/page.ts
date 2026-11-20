import type { Agenda, DayGroup, Row, TrashGroup } from "@olai/format"
export type Drawn =
  | { readonly kind: "tree"; readonly rows: ReadonlyArray<Row> }
  | {
    readonly kind: "day"
    readonly groups: ReadonlyArray<DayGroup>
    readonly notes: ReadonlyArray<string>
  }
  | { readonly kind: "agenda"; readonly agenda: Agenda }
  | {
    readonly kind: "trash"
    readonly files: ReadonlyArray<string>
    readonly groups: ReadonlyArray<TrashGroup>
  }
  | { readonly kind: "none" }

