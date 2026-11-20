import { WriteRequest, WriteResult, OpFailure } from "@olai/format"
export const writeProcedure = { input: WriteRequest, output: WriteResult, error: OpFailure } as const
