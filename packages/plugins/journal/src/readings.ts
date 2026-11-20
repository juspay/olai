import {
  datedAnswer,
  type DatedAnswer,
  type DatedRequest,
  type Derived,
  type OwedReading,
  type OwedRequest,
  owedReading,
} from "@olai/format"

export const dated = (derived: Derived, request: DatedRequest): DatedAnswer =>
  datedAnswer(derived, request.month)

export const owed = (derived: Derived, request: OwedRequest): OwedReading =>
  owedReading(derived, request.today, request.cap)
