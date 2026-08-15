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
 * (docs/brainstorming/surface-mcp-positions.md, position (c)).
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
  NodeAnswer,
  NodeRequest,
  OpFailure,
  OutlineAnswer,
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
  /** One node in full, or the id nothing here declares — `read_node`. */
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
  /** A node and what hangs under it, nested — `read_subtree`. */
  subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure },
} as const
