/**
 * How a derived status colours the title it belongs to.
 *
 * Status is a property of the thing being drawn, so it styles the title
 * directly rather than through a `[data-status]` descendant rule — and it is
 * one table rather than two, because a row and the heading of that row's own
 * page are the same node and have no business looking finished differently.
 */

import type { Status } from "@olai/format"

export const TONE: Record<Status, string> = {
  done: "text-done line-through",
  doing: "text-doing",
  open: "",
}
