export { TEST_CLAIMS } from "./claims.testlib.ts"
import { TEST_CLAIMS } from "./claims.testlib.ts"
import {
  type Node,
  NO_KINDS,
  type OpFailure,
  type OutlineSet,
  type RegularNode,
  type WriteRequest,
} from "@olai/format"
import { Result } from "effect"

import { type Context, plan, type Plan, scoping } from "./plan.ts"
import * as leaf from "@olai/format/testlib"
import { parseOutline } from "olai-plugin-outline-olai/format"
export const readingOf = (set: OutlineSet) => leaf.readingOf(set, TEST_CLAIMS)
export const setOf = (...args: Parameters<typeof leaf.setOf>) => leaf.setOf(args[0], args[1], args[2], parseOutline)
export const failureOf = (text: string, file?: string) => leaf.failureOf(text, file, parseOutline)

export { STAMP_SHAPE } from "@olai/format/testlib"


export const STAMP = "2026-08-09T10:15:00-04:00"

export const steady = (): Context => {
  let minted = 0
  return {
    mint: () => `n${++minted}`,
    now: () => STAMP,
  }
}

export const planning = (
  set: OutlineSet,
  request: WriteRequest,
): Result.Result<Plan, OpFailure> => plan(scoping(readingOf(set), steady(), NO_KINDS, "outline-olai"), request)

export const succeeded = <A>(
  outcome: Result.Result<A, OpFailure>,
  what: string,
): A => {
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected ${what}, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

export const failed = <A>(
  outcome: Result.Result<A, OpFailure>,
  what: string,
): OpFailure => {
  if (Result.isSuccess(outcome)) {
    throw new Error(
      `expected ${what} to be refused, and it answered: ` +
        `${JSON.stringify(outcome.success)}`,
    )
  }
  return outcome.failure
}

export const planned = (set: OutlineSet, request: WriteRequest): Plan =>
  succeeded(planning(set, request), `\`${request.op}\` to plan`)

export const refused = (set: OutlineSet, request: WriteRequest): OpFailure =>
  failed(planning(set, request), `\`${request.op}\``)

export const fileOf = (result: Plan, file: string): ReadonlyArray<Node> => {
  const found = result.files.find((entry) => entry.file === file)
  if (found === undefined) {
    throw new Error(
      `the plan does not write \`${file}\`; it writes ${
        result.files.map((entry) => entry.file).join(", ") || "nothing"
      }`,
    )
  }
  return found.nodes
}

export const record = (nodes: ReadonlyArray<Node>, id: string): RegularNode => {
  const found = nodes.find((node) => node.id === id)
  if (found === undefined) throw new Error(`no record \`${id}\` in the plan`)
  return found as RegularNode
}
