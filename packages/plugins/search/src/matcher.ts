/**
 * THE MATCHER — a query, ranked and shortened, over one reading of the vault.
 *
 * This is the reading behind `search_nodes` and behind every box a person types
 * into, and it was `@olai/ops`' `Query.search` until search became a row. What
 * moved is exactly the walk and the table under it ({@link ./table.ts}); what
 * did not is the gated read it is asked over, the clock it is asked at, the
 * kind vocabulary its grammar reads, and the situating a hit carries — all
 * three of the first come IN through the door, and the fourth is imported from
 * the layer that owns it, because a second answer to *where does this node
 * live* would be free to disagree with `read_node`'s in the same turn.
 *
 * A serve that does not mount this row answers every one of the five doors with
 * no hits and the reason, in words (`@olai/ops`' `NO_SEARCH`).
 */

import {
  bodiedIn,
  declarationsOf,
  DEFAULT_SEARCH_LIMIT,
  type Filter,
  heldCustom,
  type KindVocabulary,
  matching,
  matchingDocuments,
  NodeId,
  nothing,
  parseFilter,
  rankedTogether,
  type Reading,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
} from "@olai/format"
import { Query } from "@olai/ops"

import type { Index } from "./table.ts"

/**
 * A query, ranked and shortened — the reading behind `search_nodes` and behind
 * every box a person types into.
 *
 * WHAT MATCHES IS NOT DECIDED HERE any more, and that is the whole of the
 * filter-in-place change: the words, the operators (`is:`, `has:`, `date:`,
 * `created:`, `changed:`, `prop:` and their negations), the archive rule and
 * which field carried a hit all live in
 * `@olai/format`'s `filter.ts`, because a browser narrowing rows it already
 * holds cannot call this procedure on every keystroke and must not answer
 * differently for having to do it itself. One matcher, five callers; that
 * file's header names them and https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-in-place.md argues it.
 *
 * NEITHER IS THE ORDER, as of the chat composer's `@` list: the done penalty
 * and the sort went down to the matcher with the same argument one door later
 * (`ranked`) — a completion in a browser cannot call this and must not
 * hold a second opinion about whether a finished node outranks an open one.
 * The CAP stayed, because a row count is a fact about a door rather than about
 * a query: twelve here, eight in that completion, and a floor holding either
 * would be holding somebody else's layout. What is left with it is the
 * SITUATING (`@olai/ops`' `Query.foundOf`, imported rather than copied), the
 * uncapped total, so "twelve of ninety" is sayable, and CARRYING THE REFUSAL,
 * because this is the only place that has both the parser's answer and a caller
 * to hand it to.
 *
 * SHORTENED BEFORE IT IS SITUATED, which is a change of order rather than a
 * change of answer: a hit carries the ancestor titles `ancestorsOf` walks to
 * find, and building one for every node a common word selects — to keep twelve
 * — was thousands of walks up a tree on a large vault, thrown away by the next
 * line. Ranking asks only for the score and the mark, and both are in hand.
 */
export const search = (
  /** BOTH HALVES of the reading, because a query answers with both kinds of
   *  thing now: the derivation is what the records are matched against, and the
   *  set is where the documents are. It used to take the derivation alone,
   *  which was the whole of what a search could see. */
  at: Reading,
  query: SearchRequest,
  /** When the question is being asked — what the grammar's relative words count
   *  from (`date:yesterday`). A day, or an instant on one: the grammar cuts it
   *  down with the same `dayOf` every date reading in the format uses, so this
   *  layer hands over its clock's own text rather than trimming it first.
   *
   *  Handed IN rather than read here, so this stays a pure function of a
   *  snapshot: the clock is the ops layer's one (`@olai/ops`' `asking`, over
   *  the `now` a `done` is stamped with), and a second `new Date()` in the
   *  read path would be a second answer to what day it is. */
  now: string,
  /** WHICH CONTRIBUTED KINDS THIS SERVE RUNS, because a declaration is two
   *  layers now — a vault's rows over an enabled plugin's claimed keys
   *  (`@olai/format`'s `withClaims`) — and `prop:` reads what a key is
   *  declared as to decide between a span and an equality.
   *
   *  REQUIRED, and it sits BEFORE the optional index for that reason rather than
   *  for tidiness: it was defaulted for one review round, and both call sites
   *  promptly forgot it — a range on an auto-declared key refusing as undeclared
   *  while the write gate judged it by the claim. A default that answers a
   *  DIFFERENT question is not a convenience.
   *
   *  HANDED IN rather than read here for a second reason now that this is a
   *  row: what a vault declares is a fact about the SERVE, composed by the
   *  composition root out of the enabled rows' claims, and a plugin that read it
   *  for itself would be a second author of it. */
  kinds: KindVocabulary,
  /**
   * The directory's search index, when there is one — what the two walks below
   * are run over INSTEAD of the corpus ({@link ./table.ts}).
   *
   * OPTIONAL, and not as a feature flag: this function's answer is the same
   * with it and without it, which is a claim two suites make rather than one
   * this comment does. `./table.test.ts` is the algorithm's — the grammar's
   * corners, a generated corpus, and a soak of random writes that steers the
   * directory across the size where the table starts declining and back;
   * `./matcher.index.test.ts` is the SEAM's: it asks every query through this
   * door and through the corpus walk after each of thirteen writes made by the
   * real gate, which is where an index one revision behind would show up and
   * nowhere else.
   *
   * What the index changes is what has to be READ to arrive at the answer — a
   * shortlist of candidates instead of every record and every body in the
   * directory — and it can only ever hand back MORE than the query selects,
   * which the matcher below then narrows exactly as it narrows the corpus. So a
   * caller with no index is a caller paying what search cost before there was
   * one, and every test here that calls `search` directly is deliberately one of
   * them: the two paths are compared, so both are walked.
   *
   * OPTIONAL AND NOT ABSENT AT THE DOOR, which is the one thing this row must
   * not be read as: a serve with no `search` row has no matcher at all and
   * refuses in words (`@olai/ops`' `NO_SEARCH`). A `search` row with no index
   * is not a thing production ever is — {@link ./server.ts} opens one on the
   * plugin's own scope — and is the shape every differential test takes.
   */
  index?: Index | undefined,
): SearchAnswer => {
  // THE VAULT'S OWN VOCABULARY, handed to the grammar — which is what makes
  // `prop:records=190..200` a span rather than an equality against the eight
  // characters between the equals and the space (`@olai/format`'s `typing.ts`).
  // Read per ask, off the reading this search is answered from, so a
  // declaration written a moment ago is in force for the next query; it is one
  // small file's top level, which is the same cost the shelf's reading is.
  const filter = parseFilter(query.text, now, declarationsOf(at.derived, kinds))
  // A query the grammar could not read answers with no hits AND WITH THE
  // REASON. An empty one answers with no hits and nothing to say — there is no
  // question to have refused.
  if (filter.kind === "refused") {
    return { hits: [], total: 0, refusals: filter.refusals }
  }
  if (filter.kind === "nothing") return { hits: [], total: 0 }

  const scope = { file: query.file, under: query.under }
  // WHAT MIGHT MATCH, when something knows — the index brought level with this
  // very reading and asked for this very query, so there is no revision between
  // the candidates and the records they are resolved against. `undefined` is
  // both of the two ways there is nothing to narrow by (no index at all, or a
  // query the trigram floor cannot look up) because the two mean the same thing
  // to the walks below: ask the corpus, as they always did.
  const narrowed = index?.narrow(at, filter) ?? undefined
  // ASKED FOR, and the request is where that lives: a door picking a record to
  // point at cannot take a document, and one filtering the answer itself would
  // run short exactly when a query matched enough documents to fill the cap.
  const nodes = query.kind === "document"
    ? []
    : matching(at.derived, filter, scope, narrowed?.nodes)
  // The other arm of the set, asked the same question. A document answers
  // `prop:` out of its frontmatter and nothing else — a mark, a date and a
  // record's field select none of them, which is `matchingDocuments`' own rule
  // and the honest answer rather than a hole.
  const documents = query.kind === "node"
    ? []
    : matchingDocuments(bodiedIn(at.set), filter, scope, narrowed?.documents)
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT
  // Read ONCE for the answer rather than per hit: it is a fact about the
  // question, and this same request is what a browser's boxes send on every
  // settled keystroke.
  const wantsNotes = query.withDesc === true
  const hits = rankedTogether(at.derived, nodes, documents)
    .slice(0, limit)
    .map((selected): SearchHit => {
      if (selected.kind === "document") {
        // Through `heldCustom` for `@olai/ops`' `carriedOf`'s reason, which is not
        // only the pruning: it puts the keys in the FILE's canonical order
        // (alphabetical), and a node hit's `custom` already comes back that
        // way. Without it a document's `props` would arrive in frontmatter
        // line order — two orderings of one open map inside one ranked answer,
        // which is exactly the drift the row's own ordering rule refuses
        // (`@olai/web`'s `search/props.ts`, which stayed core furniture).
        const props = heldCustom(selected.at.props)
        return {
          // WHERE TO GO, which is what a hit is for: the document's own
          // address, minted by the grammar rather than assembled here.
          at: { kind: "document", path: selected.at.path },
          title: selected.at.title,
          ...(selected.match.field === null ? {} : { matched: selected.match.field }),
          // The two halves of "why is this here" a document can carry, each
          // omitted on the format's own rule for absence — the same two lines
          // the node arm below spells, over the frontmatter this file writes
          // about itself instead of over a record's `custom`.
          ...(nothing(props) ? {} : { props }),
          ...(selected.match.props.length === 0 ? {} : { matchedProps: selected.match.props }),
        }
      }
      const { at: located, match } = selected
      const found = Query.foundOf(at.derived, located)
      // The note this query is entitled to — the record's when it asked for
      // one, and nothing at all when it did not. TWO STEPS and not one
      // condition, because they are two questions: this one is the REQUEST's,
      // and the spread below is the FORMAT's rule for absence.
      const note = wantsNotes ? located.node.desc : undefined
      // ANNOTATED, never asserted. It was `as Hit` for as long as this function
      // has existed, and an assertion is exactly the thing that stops checking
      // when the declaration moves: a required field added to `SearchHit` and to
      // nothing else would be silently absent from every hit this produces. The
      // conditional spread needs no cast to satisfy the floor — `foundOf`
      // spells the same pattern under a plain return type — so what the cast was
      // buying was nothing, at the one place in this file that produces a shape
      // the wire carries.
      return {
        // The BARE id, which is what a node address is: it outlives every move
        // and every rename, so a hit is still right about where the node is
        // after the file it sits in has been renamed (`@olai/format`'s
        // `address.ts`).
        at: { kind: "node", id: NodeId.make(located.node.id) },
        ...found,
        // Omitted for a query that named no words — `is:done` on its own is
        // carried by no field, and answering "title" would be inventing a
        // reason. The format's own rule for absence, applied to an answer.
        ...(match.field === null ? {} : { matched: match.field }),
        // …and the same rule for the other half of "why is this here", which is
        // a separate field because both halves can be true at once. Empty for
        // every query that named no property.
        ...(match.props.length === 0 ? {} : { matchedProps: match.props }),
        // THE NOTE, when it was ASKED FOR — the one field of the record a hit
        // does not carry by default, and the only reason is its size
        // (`@olai/format`'s `SearchRequest.withDesc` argues it). The FORMAT's
        // rule for absence, applied to it exactly as the four lines above apply
        // it: whether the query asked was decided one step earlier, so this
        // line is not the one place a carried field is omitted by a rule that
        // is not the format's.
        ...(note === undefined ? {} : { desc: note }),
      }
    })

  // The TOTAL is what matched, never what was kept, so "twelve of ninety" is
  // sayable — the one number that has to be read off the uncapped lists.
  return { hits, total: nodes.length + documents.length }
}
