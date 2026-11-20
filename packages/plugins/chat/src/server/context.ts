import { isTrashed } from "@olai/format"
import {
  isMirror,
  type LocatedRegular,
  type OpFailure,
  type Reading,
} from "@olai/format"
import { notANode, notFound, Query } from "@olai/ops"
import type { NodeContext } from "olai-plugin-chat/wire"
import { Result } from "effect"

export const contextFor = (
  at: Reading,
  ids: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<NodeContext>, OpFailure> => {
  const nodes: Array<NodeContext> = []
  for (const id of ids) {
    const one = nodeContextFor(at, id)
    if (Result.isFailure(one)) return Result.fail(one.failure)
    nodes.push(one.success)
  }
  return Result.succeed(nodes)
}

const nodeContextFor = (
  at: Reading,
  id: string,
): Result.Result<NodeContext, OpFailure> => {
  const located = at.derived.byId.get(id)
  if (located === undefined) return Result.fail(notFound(at.derived, id))
  if (isMirror(located.node)) return Result.fail(notANode(id, located.node.mirror))
  const { id: found, title, file, line, path } = Query.foundOf(
    at.derived,
    located as LocatedRegular,
  )
  return Result.succeed({ id: found, title, file, line, path, ...(isTrashed(at.claims, file) ? { trashed: true } : {}) })
}
