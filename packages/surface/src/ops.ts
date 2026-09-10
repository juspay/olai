/** Shared write envelope for disjoint capability dispatch. A provider owns
 * its accepted variants; sharing this exact schema object keeps the preserved
 * root tag composable without granting any absent provider authority. */
import { WriteRequest, WriteResult, OpFailure } from "@olai/format"
export const writeProcedure = { input: WriteRequest, output: WriteResult, error: OpFailure } as const
