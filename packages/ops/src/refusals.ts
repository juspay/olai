import { noClaimFor } from "@olai/format"
import {
  bodyKind,
  type Claims,
  claimedOf,
  outlineAt as admittedOutline,
  fileKind,
  type Derived,
  didYouMean,
  didYouMeanDeclared,
  isOutline,
  markdownIn,
  NotFoundFailure,
  type OpFailure,
  type Outline,
  type OutlineError,
  type OutlineSet,
  UsageFailure,
  ValidationFailure,
  verdictOf,
} from "@olai/format"
import { Result } from "effect"

import type { SetFacts } from "./facts.ts"

export const notFound = (derived: Derived, id: string): OpFailure =>
  missingId(id, derived.byId)

export const missingId = (
  id: string,
  known: ReadonlyMap<string, unknown>,
  minting?: Iterable<string> | undefined,
): OpFailure => {
  const near = didYouMeanDeclared(id, known, minting)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${id}\` is not a node in the loaded set, and nothing in it is spelled ` +
        `close enough to be a typo of it — \`search_nodes\` finds a node by title, ` +
        `id or \`#tag\``
      : `\`${id}\` is not a node in the loaded set${near}`,
    named: id,
  })
}

export const notANode = (id: string, target: string): OpFailure =>
  new UsageFailure({
    reason: `\`${id}\` is a mirror — a second placement of \`${target}\`, ` +
      `not a node of its own. Name \`${target}\` instead.`,
  })

export const noSuchDocument = (
  claims: Claims,
  set: OutlineSet,
  file: string,
  instead: string,
): OpFailure => {
  const paths = markdownIn(set).map((entry) => entry.path)
  if (claimedOf(claims, file) === null) return unclaimedPath(file, paths)
  const near = didYouMean(file, paths)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${file}\` is not a document under the served directory — ${instead}`
      : `\`${file}\` is not a document under the served directory${near}`,
    named: file,
  })
}

const noSuchOutline = (facts: SetFacts, file: string): OpFailure => {
  const outlines = facts.outlines
  if (claimedOf(facts.claims, file) === null) return unclaimedPath(file, outlines)
  const near = didYouMean(file, outlines)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${file}\` is not an outline under the served directory: ` +
        `${outlines.join(", ") || "there are none"}`
      : `\`${file}\` is not an outline under the served directory${near}`,
    named: file,
  })
}

export const outlineAt = (
  facts: SetFacts,
  file: string,
): Result.Result<Outline, OpFailure> => {
  const path = claimedOf(facts.claims, file)
  if (path === null) return Result.fail(unclaimedPath(file, facts.outlines))
  if (admittedOutline(facts.claims, { kind: "document", path }) === null) {
    const claim = facts.claims.byKind.get(fileKind(facts.claims, file)!)!
    return Result.fail(new NotFoundFailure({ named: file, reason: `\`${file}\` is ${claim.article} ${claim.noun}; this verb takes an outline` }))
  }
  const found = facts.at(path)
  if (found === undefined || !isOutline(found)) {
    return Result.fail(noSuchOutline(facts, file))
  }
  return Result.succeed(found)
}

export const notLoadedBecause = (claims: Claims, file: string): string =>
  bodyKind(claims, file) !== null
    ? "could not be read, so what it holds is not loaded"
    : "has lines that do not parse, so its records are not loaded"

export const notLoaded = (
  claims: Claims,
  file: string,
  errors: ReadonlyArray<OutlineError>,
): OpFailure =>
  new ValidationFailure({
    reason: `\`${file}\` ${notLoadedBecause(claims, file)} — there is nothing to answer ` +
      `with. Fix the file first.`,
    verdict: verdictOf(errors),
  })

export const unclaimedPath = (file: string, neighbors: ReadonlyArray<string>): OpFailure => {
  return new NotFoundFailure({ named: file, reason: `\`${file}\` is not a file this directory serves: ${noClaimFor(file)}${didYouMean(file, neighbors)}` })
}
