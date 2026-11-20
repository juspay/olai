import type { Edit } from "@olai/surface"
import type { Result } from "effect"

export type Asking = Confirm | Line

export interface Confirm {
  readonly kind: "confirm"
  readonly label: string
  readonly question: string
  readonly edit: Edit
}

export interface Line {
  readonly kind: "line"
  readonly label: string
  readonly question: string
  readonly placeholder: string
  readonly initial: string
  readonly resolve: (text: string) => Result.Result<Edit, string>
}
