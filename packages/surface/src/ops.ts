/**
 * The AGENT's door onto the ops layer — the whole request vocabulary, on the
 * surface, and reachable from no browser.
 *
 * `./edit.ts` is the keyboard's door and this is the other one. They are
 * deliberately different vocabularies over the same gate, which is the ruling
 * the #167 audit made and this module is built to keep: a browser sends an
 * INTENT and the server decides the placement; an agent names the OP. Nothing
 * here re-spells anything there, and `edit.apply` is untouched.
 *
 * ## Why these members exist at all
 *
 * Until `mcp-bridge` the write tools reached the ops layer by a path of their
 * own — nineteen of them, and the roadmap node says eighteen because it was
 * written before `md-editing` added the two document verbs; the table is the
 * count, not a sentence about it. `bespokeFrom` projected `@olai/ops`' table
 * over a LOCAL `Ops`,
 * so an MCP face could only exist in a process that held the store. That is why
 * a second olai on a directory an `olai web` was already serving booted a second
 * store — 418 MB and 2099 open descriptors on a 1020-file vault, two parses of
 * everything per edit, and two probe clocks a reader could be seconds apart on
 * (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/surface-mcp-positions.md, position (c)).
 *
 * With the verbs HERE, an agent's whole vocabulary is something a surface can
 * carry, so the second process can dial the first one's socket instead of
 * opening the directory again.
 *
 * ## Why a browser must not reach them, and why that is now expressible
 *
 * Putting the ops request vocabulary on the surface used to be inseparable from
 * making it browser-callable: `serveSurfaceApp` took `handlers` whole, so a
 * member existed on every face or on none. That is the asymmetry olai asked
 * upstream about and juspay/kolu#2170 closed — every serving face now takes the
 * same `ExposeMap`, so this namespace is open on the unix socket an agent dials
 * and closed on the websocket a tab opens, and a tab that calls one anyway is
 * refused with `SurfaceMemberNotExposed` naming the tag.
 *
 * The maps themselves are `@olai/server`'s (`faces.ts`), because WHICH
 * face gets what is a deployment decision and this package only declares what
 * exists.
 *
 * ## Nothing here names WHO is writing, and that is the rule rather than an
 * omission
 *
 * `Ops.run(request, writer)` takes who is writing, because git records the
 * repository's own identity whoever asked and the `X-Olai-Writer` trailer is
 * the only thing that can tell one agent's edits from another's. It is NOT a
 * field on any of these procedures: a transport that could name itself could
 * name another, and every caller of this namespace is already identified by the
 * FACE it arrived on — HTTP `/mcp` is a terminal agent, an
 * in-process dispatch is whichever agent the composition root built it for.
 *
 * So the writer is bound where the face is composed, by rebinding these
 * handlers for it (`@olai/server`'s `runtime.ts`, `writerAt`) — the same place
 * and the same kind of transformation as the allowlist above. It is one fact in
 * one place either way; what this arrangement removes is the one spelling of it
 * a caller could have lied about.
 *
 * ## What is NOT here, and why
 *
 * `git.commit`, `git.push` and `search.nodes` are not, and their absence is
 * that rule paying off: a member belongs here only when the agent's version of
 * it DIFFERS from the browser's. Once the writer stops travelling, none of the
 * three does — a commit is the same act with the same request and the same
 * answer, and only the trailer differs, which the face now decides. Twins of
 * any of them would be a second spelling with nothing left to say for itself.
 */

import {
  DocumentAnswer,
  DocumentBody,
  DocumentRequest,
  NodeAnswer,
  NodeRequest,
  OpFailure,
  OutlineAnswer,
  PathsAnswer,
  SubtreeAnswer,
  SubtreeRequest,
  WriteRequest,
  WriteResult,
} from "@olai/format"

export const opsProcedures = {
  /**
   * One op, all the way through the write gate — plan, validate, stage,
   * rename, and re-plan against a newer snapshot if the store moved under it.
   *
   * ONE procedure for all nineteen, because there is one op. The tool NAMES
   * are a projection of this union's `op` discriminator (`set_done` IS
   * `op: "done"`), and that projection is where it has always been —
   * `@olai/ops`' table, which also carries the prose an agent reads. Nineteen
   * procedures here would be that projection spelled a second time, in a
   * package that may not import the first.
   *
   * The schemas are `@olai/format`'s, verbatim: the SAME `WriteRequest` the
   * planner switches on and the tool schemas are derived from, and the SAME
   * `WriteResult` the ops layer produces. Nothing is respelled at this seam,
   * which is the #167 floor rule applied to writes — one declaration, and a
   * drift is a compile error rather than an agent and a person looking at
   * different rows.
   */
  run: { input: WriteRequest, output: WriteResult, error: OpFailure },
  /** Every outline under the served directory — what `list_outlines` answers.
   *  No input: the question has no parameters, and a `Schema.Struct({})` would
   *  be an empty object a caller has to spell. */
  outlines: { output: OutlineAnswer, error: OpFailure },
  /**
   * The outline PATHS of the served directory — the same question with the
   * records left out, and the one member here that answers no tool.
   *
   * It is what a PLAN arm reads (`@olai/ops`' `Planning`): a capture is aimed
   * by the inbox convention over the file NAMES, and a face with no store of
   * its own — which is every agent reached over this surface — could only get
   * them by asking {@link outlines} and dropping the counts, so a capture cost
   * the directory's records and paid twice when the race made it resolve again
   * (roadmap `perf-capture-paths`).
   *
   * WHY NOT A NARROWED {@link outlines}: `list_outlines` is what an agent reads
   * to CHOOSE a file, and the counts and roots are what it chooses by. Two
   * questions, two answers, each costing what it says.
   *
   * No input, for {@link outlines}' reason.
   */
  paths: { output: PathsAnswer, error: OpFailure },
  /** One node in full, or the id nothing here declares — `read_node`. */
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
  /** A node and what hangs under it, nested — or a whole OUTLINE, every
   *  top-level node in it, which is what makes reading a file one call rather
   *  than one per root. `read_subtree`, and the request names one or the other:
   *  the schemas are `@olai/format`'s, so the rule and the two refusals that
   *  keep it are spelled where the answer is. */
  subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure },
  /**
   * Every document under the served directory — what `list_documents`
   * answers. No input, for {@link outlines}' reason: a directory is not a
   * question with parameters.
   *
   * ## Why these two exist beside the `documents` COLLECTION
   *
   * The collection serves the same files and an agent can reach it — it is in
   * `@olai/server`'s `MCP` map, as `surface://collections/documents/<path>`.
   * So this pair is a SECOND route to a body, and that is deliberate rather
   * than overlooked: the two are shaped for the two kinds of consumer olai
   * has, and a reader who assumes they are twins will be surprised by every
   * difference below.
   *
   * A COLLECTION is render-shaped. Its key set is every BODIED file's path —
   * the `.html` included, whose body the set does not keep — a `get` is one
   * key at a time, and the point of it is that a tab holding one file open is
   * pushed the news when it moves. It answers a KEY: a path it does not hold
   * is simply not there, and a file in `broken` reads as the empty text the
   * set is carrying for it, because a page's job is to draw what there is.
   *
   * THESE are request-shaped. The listing is the `.md` the document verbs
   * actually take, with the line each opens with and what it weighs, which is
   * what an agent chooses a file WITH; the read refuses a path that is not one
   * — with the near miss, in `write_document`'s own words — and refuses a file
   * the set could not read rather than handing back a body nobody read, which
   * is what an agent about to WRITE the file needs to be told.
   *
   * And a tool is a thing a model can call, where a resource is a thing a host
   * may or may not put in front of it. That is the plainest reason the write
   * verbs' prose now points here: an agent cannot be asked to supply what it
   * read (`write_document`'s `was`) through a channel it may not have.
   */
  documents: { output: DocumentAnswer, error: OpFailure },
  /** One document, whole — `read_document`. Refuses a path the set does not
   *  hold rather than answering it, and refuses one the set could not read
   *  rather than answering empty: see `@olai/format`'s `DocumentBody`, and the
   *  paragraph above for how that differs from the collection's `get`. */
  document: { input: DocumentRequest, output: DocumentBody, error: OpFailure },
} as const
