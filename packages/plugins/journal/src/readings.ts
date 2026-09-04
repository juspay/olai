/** The journal's two small derived readings. Page readings stay behind core's
 * narrow Ops.page door because they need the composed kind vocabulary; these
 * two are lookups over the vault revision the plugin already receives. */

import {
  datedAnswer,
  type DatedAnswer,
  type DatedRequest,
  type Derived,
  type Owed,
  owedNow,
  type OwedRequest,
} from "@olai/format"

/** Which days in one month carry journal material. */
export const dated = (derived: Derived, request: DatedRequest): DatedAnswer =>
  datedAnswer(derived, request.month)

/** How much work is overdue or due on the reader's day. */
export const owed = (derived: Derived, request: OwedRequest): Owed =>
  owedNow(derived, request.today)
