/**
 * WHERE `olai surface` DIALS, and what it dials with.
 *
 * The endpoint seam `@kolu/surface-cli` leaves to the app, because where a
 * server is reachable is a fact about the product and nothing in the projection
 * knows what a URL is. What it takes back is one `resolve` answering the
 * endpoint's NAME beside the thunk that opens it — the name is what a FAILED
 * dial has to report, which is exactly when there is no connection left to ask.
 *
 * ## `--url`, required, with nothing underneath it
 *
 * There is no default, no environment fallback and no remembered URL. A caller
 * says which server every time, and that is a decision rather than an
 * omission: the previous design walked a ladder to a per-user socket path that
 * both ends agreed on because neither chose it, which is exactly how two servers
 * on one machine came to race for one path and how a capture meant for the
 * human's vault landed in a checkout's docs directory. A vault is not a thing to
 * be inferred. If a shell wants a short spelling, that is what a shell alias is
 * for — and it is then visibly the caller's own choice.
 *
 * ## It speaks MCP, to `/mcp`, and that is the whole authorization story
 *
 * `./mcpClient.ts` is the transport; what matters here is what it buys. This is
 * not a face of its own: it is the same protocol, at the same path, admitted by
 * the same rule as any bridged agent, reaching exactly the resources and tools
 * `MCP` publishes. So there is ONE answer to "who may call what", the browser's
 * face is untouched, and nothing had to be widened for a terminal to exist.
 * Remote is HTTPS through the reverse proxy that already fronts this server:
 * the proxy is the authentication, and the login it injects is what a capture is
 * recorded as (`./mcp/route.ts`).
 *
 * The door pushes nothing — one POST, one answer, a 405 on the SSE half — so the
 * projection is declared `streaming: false` and mounts no `watch` and no
 * `--follow`. Every other read works: each takes the opening snapshot frame and
 * interrupts the rest, and a door that answers once answers all of them.
 */

import type { SurfaceClientCallable } from "@kolu/surface/client"
import type { ResolvedEndpoint, SurfaceCliConnection } from "@kolu/surface-cli"
import { resolveExpose } from "@kolu/surface-mcp"
import { surface } from "@olai/surface"
import { Effect, Stream } from "effect"
import { Command, Flag } from "effect/unstable/cli"

import { MCP } from "./faces.ts"
import { type McpConnection, McpUnreachable, openMcp } from "./mcpClient.ts"

/**
 * The endpoint flags, and the half of the seam that DECLARES them.
 *
 * Here rather than at the mount, beside the resolution that reads them, because
 * they are one decision: what a user may type about where to dial, and what
 * this file does with it. A shared root flag, position-independent, so
 * `olai surface --url … capture …` and `olai surface capture … --url …` are the
 * same command.
 *
 * REQUIRED, spelled as the absence of `Flag.optional`: the parser refuses a call
 * that names no server, before anything is dialled, and says so in the CLI
 * library's own words.
 */
export const endpointFlags = {
  url: Flag.string("url").pipe(
    Flag.withDescription(
      "the olai server to call — the same address a browser opens (required; no default)",
    ),
  ),
}

/** What a parse of {@link endpointFlags} hands the resolution — DERIVED from
 *  the flags rather than written out beside them, which is the whole safety
 *  story of this seam: renaming a flag is a compile error here rather than an
 *  `undefined` the app dials as the string `"undefined"`. */
type Dialled = Command.Command.Config.Infer<typeof endpointFlags>

/**
 * The resolution: one flag, one endpoint.
 *
 * An EFFECT because that is the seam's shape, and because a `--url` that is not
 * a URL at all is worth refusing HERE — before a dial, with the endpoint named —
 * rather than at the first `fetch`. A throw out of this function would be a
 * defect the CLI's own edge catches and reports on exit 3, which is the right
 * arm; failing is the same arm said deliberately.
 */
export const dialOlai = (values: Dialled): Effect.Effect<ResolvedEndpoint> =>
  Effect.sync(() => ({
    // What the USER typed, not the `/mcp` URL derived from it: this string is
    // what a failed dial reports, and a caller acts on the thing they wrote.
    where: values.url,
    open: async (): Promise<SurfaceCliConnection> => {
      const connection = await openMcp(values.url)
      return {
        client: clientOver(connection, values.url),
        dispose: () => connection.dispose(),
      }
    },
  }))

/**
 * The `/mcp` connection, dressed as the client `@kolu/surface-cli` reads.
 *
 * The projection addresses members as `client.surface[member][verb](input)` and
 * expects a `Stream`; MCP addresses the same members as `surface://` resources
 * and answers one value. So this is the join, and it is a SHIM rather than a
 * second protocol: `resolveExpose` is the very function the server's own MCP
 * face resolves its resource list with, so the URIs read here are the URIs
 * published there, member for member. A member this face does not publish is
 * simply not in the table, and the projection never offers it either — both
 * halves read {@link MCP}.
 *
 * ONE FRAME, then done. Every reader in the projection takes the opening
 * snapshot and interrupts the rest, so a single-element stream is not a
 * degraded subscription — it is exactly what a one-shot read consumes. What
 * would be dishonest is offering `watch`, which is why the seam says
 * `streaming: false` instead.
 *
 * `callTool` rides on the client because that is where a bespoke verb's handler
 * can reach it: the projection hands the handler this object, and olai's remote
 * verb table (`./mcp/tools.ts`'s `remoteFrom`) calls straight through. The verb
 * therefore runs on the SERVER, which is the point — a `capture` composed in
 * this process could name any `captured-by` it liked.
 */
const clientOver = (connection: McpConnection, url: string): SurfaceClientCallable => {
  const resolved = resolveExpose(surface.spec, MCP)
  const byKey = new Map(resolved.resources.map((resource) => [resource.key, resource]))
  const templateByKey = new Map(
    resolved.resourceTemplates.map((template) => [template.key, template]),
  )

  const members: Record<string, Record<string, (input: unknown) => Stream.Stream<unknown, unknown>>> = {}
  for (const [key, resource] of byKey) {
    const verbs: Record<string, (input: unknown) => Stream.Stream<unknown, unknown>> = {}
    if (resource.kind === "collection") {
      // The key SET, at the collection's own URI…
      verbs.keys = () => once(() => connection.readResource(resource.uri))
      // …and one item, at the template the face publishes beside it. The key
      // travels as a path segment, encoded exactly as `collectionItemTemplate`
      // spells the placeholder it replaces.
      const template = templateByKey.get(key)
      if (template !== undefined) {
        verbs.get = (input) =>
          once(() =>
            connection.readResource(
              template.uriTemplate.replace("{id}", encodeURIComponent(keyOf(input))),
            )
          )
      }
    } else {
      verbs.get = () => once(() => connection.readResource(resource.uri))
    }
    members[key] = verbs
  }

  return {
    surface: members,
    // The two things this shim carries that a real client does not: the tool
    // door, for the verbs whose handlers dispatch remotely, and the address it
    // was opened on — which is the half of "which vault answered" that only this
    // side knows, since a server behind a proxy cannot tell what reached it.
    callTool: connection.callTool,
    url,
  } as unknown as SurfaceClientCallable
}

/** One answer, as the one-frame stream a reader consumes.
 *
 *  The promise is run INSIDE the stream rather than before it, so a read that is
 *  never consumed never dials — and a Ctrl-C between the two interrupts it. */
const once = (answer: () => Promise<unknown>): Stream.Stream<unknown, unknown> =>
  Stream.fromEffect(Effect.tryPromise({ try: answer, catch: (cause) => cause }))

/** The key out of a collection `get`'s input, as a path segment.
 *
 *  The projection calls `get` with `{ key }` for a collection — that is its own
 *  shape, not a guess — and the key is written into the URI as text because a
 *  URI segment is text. The SERVER decodes it back through the collection's own
 *  `keySchema`, which is why a numeric key survives the round trip. */
const keyOf = (input: unknown): string => {
  const said = (input as { readonly key?: unknown })?.key
  if (said === undefined) {
    throw new McpUnreachable("a collection read reached the transport with no key")
  }
  return typeof said === "string" ? said : JSON.stringify(said)
}
