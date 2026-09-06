/** A transport-owned client resolves the current generation for each new call.
 * In-flight handlers retain their provider's normal revocation and drain rules.
 *
 * ...AND RESOLVES THE OWNER TOO, since #546. The face is typed against a flat
 * contract (`./client.ts` argues why it still has to be) and every member on
 * the wire carries its owner's name, so each call is routed through kolu's own
 * `scopeSiblingTag` to the row that declares it. A member whose row is not
 * standing has no tag to be routed to, and is refused in the same words an
 * unexposed one is — which is the whole of "a tool leaves with its row",
 * enforced at the call rather than by a filter somebody keeps up to date. */
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers, type FaceExposure } from "@kolu/surface/expose"
import { isReservedSurfaceTag, scopeSiblingTag } from "@kolu/surface/define"
import { brandDirectDispatch } from "@kolu/surface/link"
import { clientOn, ownerIn, runnerIn, type Row } from "./client.ts"
import { ToolFailure } from "@kolu/surface-mcp"
import { Effect, Stream } from "effect"
import { writerAt, type Bound } from "./authority.ts"

/**
 * WHERE A FLAT TAG ACTUALLY LANDS — the owner's, or nowhere.
 *
 * A FUNCTION rather than the roster itself, because two callers want different
 * answers from the same machinery. The served face routes by OWNER: `ops.run`
 * is settled by which row brought the tool whose `op` this is, every other
 * member by which standing row declares it, and `undefined` — nobody — is what
 * "that row is not here" becomes. A test that is asking about generations or
 * about credential authority routes by IDENTITY, and says so by passing one.
 *
 * A reserved tag is never routed: `system/live`, `system/identity` and
 * `system/clockNow` exist on every surface and belong to the ROOT here, so
 * scoping one would send a heartbeat to a sibling.
 */
export type Route = (tag: string, payload: unknown) => string | undefined

/** `surface/<member>/<verb>` split back into its two words. */
const partsOf = (tag: string): readonly [string, string] | undefined => {
  const rest = tag.slice("surface/".length).split("/")
  return rest.length === 2 ? [rest[0]!, rest[1]!] : undefined
}

/**
 * THE SERVED FACE'S ROUTE, read off the rows that are standing.
 *
 * `ops.run` IS THE ONE MEMBER SEVERAL ROWS DECLARE, so its owner is a fact
 * about the REQUEST — which `op` was asked — and `runnerIn` answers it from the
 * write tools the rows brought. Every other member's owner is a fact about the
 * roster alone.
 */
export const toOwner = (rows: () => ReadonlyArray<Row>): Route => (tag, payload) => {
  if (isReservedSurfaceTag(tag)) return tag
  const parts = partsOf(tag)
  if (parts === undefined) return undefined
  const [member, verb] = parts
  const standing = rows()
  if (member !== "ops" || verb !== "run") {
    const owner = ownerIn(standing, member, verb)
    return owner === undefined ? undefined : scopeSiblingTag(tag, owner)
  }
  const op = payload && typeof payload === "object" ? (payload as Record<string, unknown>)["op"] : undefined
  const owner = typeof op === "string" ? runnerIn(standing).get(op) : undefined
  return owner === undefined ? undefined : scopeSiblingTag(tag, owner)
}

export const liveDispatch = (
  read: () => Bound & { readonly expose: FaceExposure },
  caller: Parameters<typeof writerAt>[1],
  route: Route,
) => {
  const current = () => {
    const bound = read()
    const handlers = restrictHandlers(bound.group, writerAt(bound, caller), bound.expose)
    return { handlers, dispatch: directDispatch({ handlers }) }
  }
  const unavailable = (tag: string) => new ToolFailure("The capability for this operation is not active.", { unavailable: tag })
  return brandDirectDispatch({
    unary: (tag: string, payload: unknown) => Effect.suspend(() => {
      const at = route(tag, payload)
      if (at === undefined) return Effect.fail(unavailable(tag))
      const value = current()
      return at in value.handlers ? value.dispatch.unary(at, payload) : Effect.fail(unavailable(tag))
    }),
    stream: (tag: string, payload: unknown) => Stream.unwrap(Effect.sync(() => {
      const at = route(tag, payload)
      if (at === undefined) return Stream.fail(unavailable(tag))
      const value = current()
      return at in value.handlers ? value.dispatch.stream(at, payload) : Stream.fail(unavailable(tag))
    })),
  })
}

export const liveClient = (...args: Parameters<typeof liveDispatch>) => clientOn(liveDispatch(...args))
