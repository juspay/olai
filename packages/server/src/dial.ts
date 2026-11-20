import type { RootedSurfaceClients } from "@kolu/surface/client"
import type { ResolvedEndpoint, SurfaceCliConnection } from "@kolu/surface-cli"
import { resolveExpose } from "@kolu/surface-mcp"
import { Effect, Stream } from "effect"
import { Command, Flag } from "effect/cli"

import { AGENT_SIBLINGS } from "@olai/bundle/agent-face"
import { type McpConnection, McpUnreachable, openMcp } from "./mcpClient.ts"

export const endpointFlags = {
  url: Flag.String("url").pipe(
    Flag.withDescription(
      "the olai server to call — the same address a browser opens (required; no default)",
    ),
  ),
}

type Dialled = Command.Command.Config.Infer<typeof endpointFlags>

export const dialOlai = (values: Dialled): Effect.Effect<ResolvedEndpoint> =>
  Effect.sync(() => ({
    where: values.url,
    open: async (): Promise<SurfaceCliConnection> => {
      const connection = await openMcp(values.url)
      return {
        client: clientOver(connection, values.url),
        dispose: () => connection.dispose(),
      }
    },
  }))

const clientOver = (connection: McpConnection, url: string): RootedSurfaceClients => {
  const door = { callTool: connection.callTool, url }
  const clients: Record<string, { surface: Record<string, Record<string, (input: unknown) => Stream.Stream<unknown, unknown>>> } & typeof door> = {}
  for (const [key, sibling] of Object.entries(AGENT_SIBLINGS)) {
    const resolved = resolveExpose(sibling.surface.spec as never, (sibling.expose ?? {}) as never, key)
    const byKey = new Map(resolved.resources.map((resource) => [resource.key, resource]))
    const templateByKey = new Map(
      resolved.resourceTemplates.map((template) => [template.key, template]),
    )
    const members: Record<string, Record<string, (input: unknown) => Stream.Stream<unknown, unknown>>> = {}
    for (const [member, resource] of byKey) {
      const verbs: Record<string, (input: unknown) => Stream.Stream<unknown, unknown>> = {}
      if (resource.kind === "collection") {
        verbs.keys = () => once(() => connection.readResource(resource.uri))
        const template = templateByKey.get(member)
        if (template !== undefined) {
          verbs.get = (input) =>
            once(() =>
              connection.readResource(itemAddress(template.uriTemplate, keyOf(input))),
            )
        }
      } else {
        verbs.get = () => once(() => connection.readResource(resource.uri))
      }
      members[member] = verbs
    }
    clients[key] = { surface: members, ...door }
  }

  return { clients, ...door } as unknown as RootedSurfaceClients
}

const once = (answer: () => Promise<unknown>): Stream.Stream<unknown, unknown> =>
  Stream.fromEffect(Effect.tryPromise({ try: answer, catch: (cause) => cause }))

const keyOf = (input: unknown): string => {
  const said = (input as { readonly key?: unknown })?.key
  if (said === undefined) {
    throw new McpUnreachable("a collection read reached the transport with no key")
  }
  return typeof said === "string" ? said : JSON.stringify(said)
}

/** One item's address: the published template with its placeholder filled.
 *
 *  `{+id}` is RFC 6570's reserved expansion, which passes `/` through
 *  unescaped, so the name is encoded segment by segment and joined with `/`. */
export const itemAddress = (uriTemplate: string, name: string): string => {
  const placeholder = "{+id}"
  const at = uriTemplate.indexOf(placeholder)
  if (at === -1) {
    throw new McpUnreachable(
      `the item template ${uriTemplate} does not carry ${placeholder}, which is the only placeholder a collection's item address is published with`,
    )
  }
  const filled = name
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return uriTemplate.slice(0, at) + filled + uriTemplate.slice(at + placeholder.length)
}
