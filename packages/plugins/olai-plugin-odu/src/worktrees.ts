/**
 * THE VAULT HALF of board-driven CI discovery — which nodes name a worktree,
 * and whether the vault has TYPED that key as a path at all.
 *
 * HERE rather than in `@olai/odu-client` because it is a reading of the SET
 * and nothing to do with odu: it would be exactly this function if the runs
 * came from somewhere else entirely. Keeping it on this side is what lets that
 * package name no olai package at all — a walk over `Located` there would have
 * put the vault's format in "how olai reaches odu", which is two subjects in
 * one manifest. It is `olai-plugin-kolu`'s `claimants.ts` arrangement, one
 * property over, and deliberately the same shape.
 *
 * ...and here rather than in `@olai/server`, which is the move. A general
 * package that walks the vault for what an appliance's probe needs is a general
 * package holding an appliance's judgement, and this one is odu's: the
 * DECLARATION below licences a socket dial in somebody's checkout. The walk did
 * not change — only the wall it is inside, and the door the two property keys
 * are read through: `@olai/surface` used to re-export them and no longer names
 * an appliance at all, so they come from the package that DECLARES them.
 *
 * ## Why it is not called `lanes.ts`, which it was
 *
 * Because a LANE is not olai's word. It is the orchestrator's board's — a
 * dispatched piece of work, with an agent on it and a PR at the end — and that
 * is process vocabulary belonging to one vault that happens to be this app's
 * heaviest user (the human's review of #433). olai's own vocabulary has nodes,
 * properties and declared types, and no opinion about why somebody wrote a
 * fact down.
 *
 * What this module actually asks is a question in that vocabulary and reads
 * the same either way: WHICH NODES CARRY A KEY THIS VAULT DECLARES A
 * `worktree`. A directory of recipes with such a key on one of its rows gets
 * the same probe and the same chip, and nothing in the code has to be re-read
 * as a metaphor for it.
 *
 * ## THE DECLARATION LICENCES THE PROBE
 *
 * ...and this is the sharpest instance of that rule in the tree, which is worth
 * stating plainly because it is not where a reader would first look for it.
 *
 * A `worktree` value is a decision-shaped name; what turns it into a path olai
 * will join `.ci/odu.sock` onto is a DECLARATION, and a declaration
 * comes from either of two places, folded once and in this order
 * (`@olai/format`'s `withClaims`): the VAULT'S OWN ROW
 * (`{"title":"worktree","custom":{"type":"odu-worktree"}}`), which always wins,
 * and the key this kind CLAIMS by convention, which is its own composed word.
 *
 * So a lane carrying `odu-worktree` is probed with nothing declared anywhere,
 * and olai never writes anybody's vault to make that true. A vault that declares
 * the claimed key something else gets NO PROBE — that is a row saying what it
 * means — and a key of somebody's own called `worktree` is never captured by
 * switching odu on, which matters more here than anywhere else in this tree:
 * what a declaration licenses is a SOCKET DIAL in a directory nobody offered.
 *
 * IT USED TO ASK FOR `path`, AND THAT WAS NOT ENOUGH. `brief` is a `path` too,
 * on the very same rows, and a shape cannot tell a checkout from a document —
 * which is why this kind exists at all rather than the key staying `path`.
 *
 * IT IS ASKED HERE AND NOT IN THE BROWSER
 * (`@olai/web`'s `live/seam.ts`): declarations do not travel to a browser
 * (juspay/olai#395), so the tab cannot key on one — but the server holds them,
 * and this is the one question that has to be asked where they are.
 *
 * A key NOTHING declares — neither the vault nor a claim — is not probed, and
 * it is the same rule the terminal door
 * beside it now keeps (`olai-plugin-kolu`'s `claimants.ts`, which used to
 * keep a lower one). What still differs is the RISK rather than the bar: that
 * walk looks a value up in a fleet, where a wrong one finds nothing and the
 * block says so in words, and this one hands a path to a socket dial in
 * somebody's checkout.
 *
 * What crosses is four strings per node (`@olai/odu-client`'s
 * `WorktreeNode`). The probe is odu's, the walk is olai's, and that shape is
 * the only place they meet.
 */

import {
  customText,
  declarationsOf,
  declaresKind,
  type Derived,
  isRegular,
  textDeclaredAs,
} from "@olai/format"
import type { WorktreeNode } from "@olai/odu-client"
import { PR_URL_KEY } from "@olai/odu-client/wire"

import { ownKinds, WORKTREE_TYPE } from "./kinds.ts"

/**
 * Every node carrying a key this vault declares a `worktree`.
 *
 * IT TAKES THE WHOLE DERIVATION rather than the node list `claimantsIn` takes,
 * and the one extra thing it reads is the reason: what the vault DECLARES is a
 * fact about the set, answered once per revision off a memo the validator has
 * already paid for (`declarationsOf` is a `WeakMap` on the derivation). Handing
 * the nodes alone would have meant either a second walk of the declarations
 * file here or a `boolean` computed by the caller — one wasteful, the other a
 * question asked in a place that cannot see why.
 *
 * A GENERATOR, for `claimantsIn`'s reason: a revision that names no worktree —
 * which is almost every revision in almost every vault — allocates nothing,
 * because the caller walks this once and keeps only what it found. And the
 * declaration is asked BEFORE the loop, so a vault that types nothing pays one
 * map lookup per revision and not one per record.
 *
 * MIRRORS ARE SKIPPED. A mirror carries no properties of its own; it is a
 * second placement of the node that does, so asking it would be asking the
 * wrong record — and its target is in this same walk. Two rows probing one
 * checkout would also be two dials of one socket, which is the thing the
 * watcher's first-writer-wins rule then has to clean up.
 *
 * `pr-url` IS STILL READ BY NAME, and that is the one key here that is, which
 * is worth naming rather than leaving as an inconsistency. It names no kind —
 * this plugin contributes exactly one word — and it licences nothing: the
 * `worktree` value is what becomes a path, and the PR URL only ever narrows
 * where that path is looked for. A value that is not a URL resolves to no
 * repository and the node is dropped (`@olai/odu-client`'s `repoIn`), which is
 * the same outcome a wrong declaration would have bought, reached without a
 * second gate.
 */
export function* worktreesIn(derived: Derived): Generator<WorktreeNode> {
  const declarations = declarationsOf(derived, ownKinds)
  if (!declaresKind(declarations, WORKTREE_TYPE)) return
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const value = textDeclaredAs(declarations, located.node, WORKTREE_TYPE)
    if (value === undefined) continue
    yield {
      node: located.node.id,
      title: located.node.title,
      value,
      prUrl: customText(located.node, PR_URL_KEY),
    }
  }
}
