/**
 * THE PER-SESSION CREDENTIAL, and which door a tool call therefore writes
 * through.
 *
 * One table and one selector. A session is handed an opaque BEARER when its MCP
 * entry is built; the bearer rides the `Authorization` header the agent was
 * already sending (`./route.ts` puts it in a storage beside the login); and this
 * is where it is resolved — per request, on the request's own stack, into the
 * surface client the tool's handlers will write through.
 *
 * ## Why the credential names a SESSION and not a node
 *
 * Because a session is opened BEFORE it is bound to a node. The panel's own
 * gesture opens the conversation first and writes the binding property second,
 * and a live conversation can be re-pointed at a different node with no restart.
 * The MCP entry is built once, when the session opens — i.e. before the node
 * exists to name. So a credential that meant a node at mint time would be wrong
 * on the first path and stale on the second, and the table holds a THUNK that is
 * asked again on every tool call.
 *
 * ## Why a DOOR and not a service provided into the tool's effect
 *
 * The adapter evaluates a tool's closure as an ARGUMENT to its request edge and
 * then runs what that closure returned with `Effect.runPromise` on a fresh fiber
 * with an EMPTY context, so anything provided upstream is gone by the time the
 * write gate would read it. What survives is a value the closure already closed
 * over — which is exactly what `../runtime.ts`'s `writerAt` does for the WRITER,
 * for the same reason and under the same argument: a transport that could name
 * itself could name another. A fence is one more fact about the face, decided
 * where every other fact about a face is decided.
 *
 * ## THREE ANSWERS AND NO FOURTH
 *
 * A bearer nobody ever minted is served the UNFENCED door, exactly as today.
 * That is deliberate rather than an oversight: `./route.ts`'s header promises
 * that "a loopback request that carries one is accepted the same as one that
 * does not", `mcpAllowed` is what decides whether a request reaches the tools at
 * all, and this must never make that stricter. Making an unrecognised bearer a
 * shut door would change what a `.mcp.json` client with a stale token gets, and
 * `packages/tests/support/mcp.ts` exists to catch exactly that regression.
 *
 * A RELEASED ticket is TOMBSTONED rather than deleted, which is the one place
 * this table is stricter than forgetting: deleting a reaped session's ticket
 * would let reaping WIDEN what its stale credential can do, and reaping must not
 * move anything in that direction.
 *
 * ## What this does NOT close
 *
 * An agent that drops its own header and re-POSTs at `/mcp` reaches the unfenced
 * door and writes as `chat-agent` with nothing in the transcript. Closing that
 * means requiring a bearer for writes on loopback, which breaks the affordance
 * `./route.ts` documents and which that file already argues is not worth much
 * ("anything that can read this process's memory has already won"). The fence
 * contains an agent that follows the protocol it was handed; it is not a
 * sandbox, and the docs say so plainly rather than implying one.
 */

import type { FaceExposure } from "@kolu/surface/expose"
import type { Fence, Ops } from "@olai/ops"
import { randomBytes } from "node:crypto"

import { type Bound, writerAt } from "../runtime.ts"
import { clientOver, type OlaiSurfaceClient } from "./face.ts"
import { currentTicket } from "./route.ts"

/**
 * WHAT A FENCED CALLER MAY DO, as the holder of the session answers it.
 *
 * Deliberately not {@link Fence} itself: the holder knows a node and a list of
 * words and nothing about how a refusal is worded, and core composes the rest —
 * the `ask` thunk out of the `above` function, the set out of the list. The
 * shape `@olai/plugin-api` will carry when the chat plugin mints into this table
 * is this one, three strings and no `@olai/format` in sight.
 */
export interface Seated {
  /** The node this session writes AT OR UNDER. */
  readonly under: string
  /** Property keys this session may not write anywhere, its own node included.
   *  THE CALLER'S OWN WORDS: core spells no plugin's kind, and what the key
   *  means stays with whoever contributed it. */
  readonly forbidden: ReadonlyArray<string>
}

/** A ticket, and the one thing its holder may do with it besides hand it over. */
export interface Ticket {
  /** The opaque bearer. Segment-free hex, so it rides an `Authorization` header
   *  and a URL alike, and it says nothing about the session it stands for —
   *  what it MEANS is asked of the thunk, per request. */
  readonly bearer: string
  /** Reap it. The ticket becomes a CLOSED door rather than an unknown one; see
   *  the header. Idempotent. */
  readonly release: () => void
}

export interface Tickets {
  /**
   * Mint one for a session.
   *
   * THERE IS NO ARGUMENT FOR THE CREDENTIAL, which is what makes it a fence: the
   * bearer is minted here and returned, and a caller that could name one could
   * name another session's.
   *
   * `fence` answers what this session may do RIGHT NOW, or `null` for a
   * conversation no node claims — the panel's own, which gets the whole vault,
   * which is what it has today. `above` is how a refusal names the nearest node
   * agent over a node: the caller's words, asked only on the refusal path,
   * because who is above a node moves with the vault.
   */
  readonly mint: (
    fence: () => Seated | null,
    above: (node: string) => string | null,
  ) => Ticket
  /**
   * WHICH DOOR THIS TOOL CALL WRITES THROUGH, given the one the adapter holds.
   *
   * Identity for a request nobody fenced, which keeps the adapter's own client
   * authoritative and the face's re-dial argument intact. What {@link
   * ./tools.ts}'s `Served.fenced` is filled with.
   */
  readonly doorAt: (held: OlaiSurfaceClient) => OlaiSurfaceClient
}

export interface Options {
  /** The group and handlers this process bound — what a fenced door is a
   *  `restrictHandlers` pass over. */
  readonly bound: Pick<Bound, "group" | "handlers">
  /** The face a fenced door is gated with: the agent's, the same one the
   *  unfenced door is gated with, because a fence narrows what may be WRITTEN
   *  and never which members exist. */
  readonly face: FaceExposure
  readonly ops: Ops
  /** The process's own token. A request presenting it is the chat's own or an
   *  attached client's, and gets the unfenced door — it is not a ticket and
   *  never resolves as one. */
  readonly token: string
}

/** The writer every MCP request is recorded as, fenced or not — UNCHANGED, and
 *  deliberately. A terminal has no word of its own (ruled 2026-08-23,
 *  `@olai/format`'s `committing.ts`), so the git trailer and the pending panel's
 *  per-writer tally say exactly what they said before there was a second door. */
const WRITER = "chat-agent" as const

export const ticketing = (options: Options): Tickets => {
  /** Bearer to what its holder may do, or `null` for a TOMBSTONE. */
  const tickets = new Map<string, (() => Fence | null) | null>()
  /** One door per SEATED NODE, not one per session and not one per request:
   *  each is a `restrictHandlers` pass over a handler record this process
   *  already bound, over an in-process dispatch with nothing to dial. No second
   *  store, no second `Ops`, and no second answer to anything. */
  const doors = new Map<string, OlaiSurfaceClient>()

  const doorFor = (fence: Fence): OlaiSurfaceClient => {
    const under = fence.under
    // A CLOSED fence is not memoisable by node, because it names none. It is
    // also the one door that refuses everything, so building it per request
    // costs a reaped session and nobody else.
    if (under === null) return composed(fence)
    const held = doors.get(under)
    if (held !== undefined) return held
    const made = composed(fence)
    doors.set(under, made)
    return made
  }

  const composed = (fence: Fence): OlaiSurfaceClient =>
    clientOver(
      { group: options.bound.group, handlers: writerAt(options.bound, options.ops, {
        writer: WRITER,
        fence,
      }) },
      options.face,
    )

  return {
    mint: (fence, above) => {
      const bearer = randomBytes(24).toString("hex")
      tickets.set(bearer, () => {
        const said = fence()
        if (said === null) return null
        return {
          under: said.under,
          ask: () => above(said.under),
          forbidden: new Set(said.forbidden),
        }
      })
      return {
        bearer,
        release: () => {
          // TOMBSTONE, not delete — see the header.
          if (tickets.has(bearer)) tickets.set(bearer, null)
        },
      }
    },
    doorAt: (held) => {
      const at = currentTicket()
      // No bearer at all, or the process's own token: the adapter's client,
      // which is the whole vault. This is `.mcp.json` on loopback, `olai
      // surface`, an attached client, and the panel's own conversation.
      if (at === null || at === options.token) return held
      const asking = tickets.get(at)
      // A bearer this table never minted is served the unfenced door, exactly
      // as it is today. THE THIRD ROW IS DELIBERATE — see the header.
      if (asking === undefined) return held
      // ...and a bearer it minted and then reaped is a shut door.
      if (asking === null) {
        return doorFor({ under: null, ask: () => null, forbidden: new Set() })
      }
      const fence = asking()
      // A conversation no node claims is the person's own, and a person's door
      // is the whole vault — which is what it is today.
      return fence === null ? held : doorFor(fence)
    },
  }
}
