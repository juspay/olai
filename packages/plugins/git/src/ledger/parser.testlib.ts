/** The parser door a test host offers, backed by the registered row contracts. */
import { parserFor } from "@olai/format"
import { TEST_CLAIMS } from "@olai/ops/testlib"
import type { Ops } from "@olai/ops"
export const parsers: Pick<Ops, "parserFor"> = {
  parserFor: path => {
    const format = parserFor(TEST_CLAIMS, path)
    return format === null ? null : { claims: TEST_CLAIMS, format }
  },
}
