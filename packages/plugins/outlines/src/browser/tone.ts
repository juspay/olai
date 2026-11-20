import type { Status } from "@olai/format"

const SETTLED = "text-muted line-through decoration-muted/60"

const TONE: Record<Status, string> = {
  done: SETTLED,
  cancelled: SETTLED,
  doing: "",
  todo: "",
}

export const toneOf = (status: Status | undefined): string =>
  status === undefined ? "" : TONE[status]
