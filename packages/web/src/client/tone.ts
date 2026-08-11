/**
 * How a derived status colours the title it belongs to.
 *
 * Status is a property of the thing being drawn, so it styles the title
 * directly rather than through a `[data-status]` descendant rule — and it is
 * one table rather than two, because a row and the heading of that row's own
 * page are the same node and have no business looking finished differently.
 *
 * A node with no status is plain text and that is the point: an unmarked
 * bullet is not an unstarted task, so nothing about it is toned.
 */

import type { Status } from "@olai/format"

const TONE: Record<Status, string> = {
  done: "text-done line-through",
  doing: "text-doing",
}

export const toneOf = (status: Status | undefined): string =>
  status === undefined ? "" : TONE[status]
