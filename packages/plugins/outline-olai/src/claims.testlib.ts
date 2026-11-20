import { claims } from "@olai/format"
import { TEST_CLAIMS as literal } from "@olai/format/testlib"
import { format } from "./format.ts"
export const TEST_CLAIMS = claims([...literal.byKind.values()].map(claim =>
  claim.holds === "nodes" ? { ...claim, format } : claim))
