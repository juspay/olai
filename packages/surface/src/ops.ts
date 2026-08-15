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
 * Until `mcp-bridge` the eighteen write tools reached the ops layer by a path
 * of their own: `bespokeFrom` projected `@olai/ops`' table over a LOCAL `Ops`,
 * so an MCP face could only exist in a process that held the store. That is why
 * `olai mcp` on a directory an `olai web` was already serving booted a second
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
 * ## `writer` travels with the call, and that is deliberate
 *
 * `Ops.run(request, writer)` takes who is writing, because git records the
 * repository's own identity whoever asked and the trailer is the only thing
 * that can tell one agent's edits from another's. Every other door has that
 * decided by the process it lives in — `web` for the button, and `bind` takes
 * it once. This one cannot: the SERVING process is an `olai web` and the CALLER
 * may be somebody's own `olai mcp` two terminals over, so a writer decided here
 * would record every bridged agent's work as the browser's.
 *
 * So the caller says, and the caller's own composition root is what decides it
 * (`mcp/serve.ts` passes `mcp`, the panel's route passes `chat-agent`) — which
 * is the same rule as before, applied at the process that actually knows the
 * answer. What makes it safe to take on trust is the face gate above rather
 * than the field: this namespace is reachable only from an owner-only socket
 * and from in-process dispatch, so everything that can spell a `writer` is
 * already the user. It is provenance, not authorization, and the two are not
 * confused here.
 *
 * ## What is NOT here, and why
 *
 * `push` and `search.nodes` are not, and their absence is the rule rather than
 * an oversight: a member belongs here only when the agent's version of it
 * DIFFERS from the browser's. A push takes no writer at all — it makes no
 * commit, and the trailers on what it sends were written when those commits
 * were — so `git.push` is one verb both doors call. A search asks and answers
 * the same thing whoever asks, which is the whole argument of `./search.ts`.
 * Twins of either would be a second spelling with nothing to say for itself.
 */

import {
  CommitRequest,
  CommitResult,
  NodeAnswer,
  NodeRequest,
  OpFailure,
  OutlineAnswer,
  SubtreeAnswer,
  SubtreeRequest,
  Writer,
  WriteRequest,
  WriteResult,
} from "@olai/format"
import { Schema } from "effect"

export const opsProcedures = {
  /**
   * One op, all the way through the write gate — plan, validate, stage,
   * rename, and re-plan against a newer snapshot if the store moved under it.
   *
   * ONE procedure for eighteen tools, because there is one op. The tool NAMES
   * are a projection of this union's `op` discriminator (`set_done` IS
   * `op: "done"`), and that projection is where it has always been —
   * `@olai/ops`' table, which also carries the prose an agent reads. Eighteen
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
  run: {
    input: Schema.Struct({ request: WriteRequest, writer: Writer }),
    output: WriteResult,
    error: OpFailure,
  },
  /**
   * Record what is waiting, as the caller rather than as this process.
   *
   * The one member here that has a browser twin — `git.commit` — and the only
   * thing that differs is the writer, for the reason above. It is not a second
   * spelling: both are one call onto `Ops.commit`, over `@olai/format`'s own
   * `CommitRequest` / `CommitResult`.
   *
   * No error channel, because a commit has none to declare: every way it can
   * go wrong is a VALUE the caller is entitled to see (`CommitResult` carries
   * git's own words on a refusal). `git.commit` declares an `OpFailure` arm it
   * never uses; this one says what is true.
   */
  commit: {
    input: Schema.Struct({ request: CommitRequest, writer: Writer }),
    output: CommitResult,
  },
  /** Every outline under the served directory — what `list_outlines` answers.
   *  No input: the question has no parameters, and a `Schema.Struct({})` would
   *  be an empty object a caller has to spell. */
  outlines: { output: OutlineAnswer, error: OpFailure },
  /** One node in full, or the id nothing here declares — `read_node`. */
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
  /** A node and what hangs under it, nested — `read_subtree`. */
  subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure },
} as const
