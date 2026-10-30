/** The journal's two small derived readings. Page readings stay behind core's
 * narrow Ops.page door because they need the composed kind vocabulary; these
 * two are lookups over the vault revision the plugin already receives. */

import {
  datedAnswer,
  type DatedAnswer,
  type DatedRequest,
  type Derived,
  type OwedReading,
  type OwedRequest,
  owedReading,
} from "@olai/format"

/** Which days in one month carry journal material. */
export const dated = (derived: Derived, request: DatedRequest): DatedAnswer =>
  datedAnswer(derived, request.month)

/**
 * What is overdue or due on the reader's day — and the first rows behind the
 * counts, which is what the column draws under the door.
 *
 * ONE ANSWER, from one read of the index: the number and the list over it are
 * fields of the same message, so no drawing decision can make them disagree
 * for a frame (`@olai/format`'s `OwedReading`). `cap` is the asker's, and it
 * bounds the rows only.
 */
export const owed = (derived: Derived, request: OwedRequest): OwedReading =>
  owedReading(derived, request.today, request.cap)
