import { claims } from "@olai/format"
import {
  type CommitRequest,
  type CommitResult,
  isOpFailure,
  kindOf,
  type OpFailure,
  type PushResult,
  stampOf,
} from "@olai/format"
import { isStale, type Vintage } from "@olai/store"
import { landed, type Acting, type Applied, type Asking, type Planning, type Running, type Tool } from "@olai/ops"
import { type BespokeTool, scopedToolName, ToolFailure, type ToolInputSchema } from "@kolu/surface-mcp"
import { Effect, Result, Schema } from "effect"

import type { Request } from "@olai/ops"
import { resolvedWrite } from "@olai/ops/resolved"
import { clientAt, type RootedSurfaceClients, type SurfaceClientCallable } from "@kolu/surface/client"
import { ownerIn, runnerIn, type Row } from "./bundle.ts"

type Door = Running & Asking & Acting

export const bespokeFrom = (
  owner: string,
  tools: ReadonlyArray<Tool>,
  rows: () => ReadonlyArray<Row>,
  at: Served,
): Record<string, BespokeTool> =>
  Object.fromEntries(
    tools.map((
      tool,
    ) => [
      tool.name,
      ownVerb(tool, (args) => {
        const door = at.doorAt()
        const said = answer(tool, doorOver(door, rows, at), door, owner, scopedToolName(owner, tool.name), args, at.login())
        if (tool.kind !== "read") return Effect.map(said, (it) => named(it, at.root))
        return Effect.flatMap(
          at.vintage,
          (vintage) => Effect.map(said, (it) => named(it, at.root, vintage)),
        )
      }),
    ]),
  )

export interface Served {
  readonly login: () => string | null
  readonly root: string
  readonly vintage: Effect.Effect<Vintage | undefined>
  readonly doorAt: () => RootedSurfaceClients
  readonly record: (request: CommitRequest) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
}

export const remoteFrom = (owner: string, tools: ReadonlyArray<Tool>): Record<string, BespokeTool> =>
  Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      dialledVerb(tool, (args, door) => {
        const called = scopedToolName(owner, tool.name)
        return Effect.map(
          Effect.tryPromise({
            try: () => door.callTool(called, args),
            catch: (cause) => cause,
          }),
          (said) => at(said, door.url),
        ) as Effect.Effect<unknown, ToolFailure>
      }),
    ]),
  )

interface Dialled {
  readonly callTool: (name: string, args: unknown) => Promise<unknown>
  readonly url: string
}

const shaped = (tool: Tool, handler: BespokeTool["handler"]): BespokeTool => {
  const input = argsOf(tool)
  return {
    ...(input === undefined ? {} : { input }),
    title: tool.title,
    description: tool.description,
    mutates: tool.kind === "surface" ? tool.mutates : tool.kind !== "read",
    handler,
  }
}

const ownVerb = (tool: Tool, run: (args: unknown) => Effect.Effect<unknown, ToolFailure>): BespokeTool =>
  shaped(tool, (args) => run(args))

const dialledVerb = (
  tool: Tool,
  run: (args: unknown, door: Dialled) => Effect.Effect<unknown, ToolFailure>,
): BespokeTool => shaped(tool, (args, client) => run(args, client as Dialled))

const named = (said: unknown, root: string, vintage?: Vintage): unknown =>
  isRecord(said)
    ? { ...said, root, ...(vintage === undefined ? {} : { vintage: stated(vintage) }) }
    : said

const stated = (vintage: Vintage): Record<string, unknown> => ({
  stale: isStale(vintage),
  asOf: new Date(vintage.provedAt).toISOString(),
  ageMs: vintage.age,
  proof: vintage.proof._tag.toLowerCase(),
  ...(vintage.proof._tag === "Diverged" ? { diverged: vintage.proof.paths } : {}),
  ...(vintage.proof._tag === "Unchecked" ? { why: vintage.proof.why } : {}),
})

const at = (said: unknown, url: string): unknown =>
  isRecord(said) ? { ...said, url } : said

const isRecord = (said: unknown): said is Record<string, unknown> =>
  typeof said === "object" && said !== null && !Array.isArray(said)

const doorOver = (bundle: RootedSurfaceClients, rows: () => ReadonlyArray<Row>, at: Served): Door => {
  const on = (member: string, verb: string, owner?: string): SurfaceClientCallable => {
    const who = owner ?? ownerIn(rows(), member, verb)
    const client = who === undefined ? undefined : clientAt(bundle, who)
    if (client === undefined) {
      throw new ToolFailure("The capability for this operation is not active.", { unavailable: `${member}.${verb}` })
    }
    return client
  }
  const call = <A>(member: string, verb: string, input: unknown, owner?: string): Effect.Effect<A, OpFailure> =>
    Effect.suspend(() => landed(on(member, verb, owner).surface[member]![verb]!(input) as Effect.Effect<A, unknown>))
  return {
    run: request => Effect.suspend(() =>
      call("ops", "run", request, runnerIn(rows()).get((request as { readonly op: string }).op))),
    commit: (request: CommitRequest) => Effect.orDie(at.record(request)),
    push: Effect.orDie(at.push),
    outlines: call("ops", "outlines", undefined),
    paths: call("ops", "paths", undefined),
    node: request => call("ops", "node", request),
    subtree: request => call("ops", "subtree", request),
    search: request => call("search", "nodes", request),
    documents: call("ops", "documents", undefined),
    document: request => call("ops", "document", request),
  }
}

/**
 * Effect 4.1.4 compiles `Schema.Struct({})` to `anyOf: [object, array]` rather
 * than to an object type, so a tool with no fields must advertise no input at
 * all; and this pin has no `Schema.omit`, so a struct is taken apart through
 * `.fields`, which keeps each field's own annotations.
 */
const argsOf = (tool: Tool): ToolInputSchema<unknown> | undefined => {
  const fields = { ...tool.schema.fields }
  if (tool.kind === "write") {
    for (const fixed of Object.keys(tool.fixed)) delete fields[fixed]
  }
  if (Object.keys(fields).length === 0) return undefined
  return (tool.kind === "read"
    ? tool.schema
    : Schema.Struct(fields)) as unknown as ToolInputSchema<unknown>
}

const answer = (
  tool: Tool,
  door: Door,
  bundle: RootedSurfaceClients,
  owner: string,
  called: string,
  args: unknown,
  login: string | null,
): Effect.Effect<unknown, ToolFailure> =>
  Effect.mapError(
    tool.kind === "write"
      ? Effect.map(
        door.run({ ...(args as object), ...tool.fixed } as Request),
        (applied) => ({ ...applied, did: called }),
      )
      : tool.kind === "act"
      ? Effect.map(
        tool.act(door, args as never),
        (result) => ({ ...(result as object), did: called }),
      )
      : tool.kind === "plan"
      ? Effect.map(
        planned(tool, door, args, login),
        (applied) => ({ ...applied, did: called }),
      )
      : tool.kind === "surface"
      ? Effect.suspend(() => {
        const client = clientAt(bundle, owner)
        return client === undefined
          ? Effect.die(new Error(`the row "${owner}" is not standing`))
          : tool.call(client as never, args as never)
      })
      : tool.ask(door, args as never),
    (failure: OpFailure) => refusal(called, failure),
  )

const planned = (
  tool: Extract<Tool, { readonly kind: "plan" }>,
  door: Door,
  args: unknown,
  login: string | null,
): Effect.Effect<Applied, OpFailure> =>
  Effect.map(
    resolvedWrite(
      Effect.map(door.paths, (listed): Planning => ({
        paths: listed.paths,
        claims: claims(listed.claims),
        outlineRow: listed.outlineRow,
        login,
        now: () => stampOf(new Date()),
      })),
      (at) => tool.plan(at, args as never),
      door.run,
      true,
    ),
    (written) => written.done,
  )

const refusal = (name: string, failure: OpFailure): ToolFailure =>
  new ToolFailure(
    `\`${name}\` was refused (${kindOf(failure)}): ${failure.message}`,
    { kind: kindOf(failure), ...(failure.toJSON() as Record<string, unknown>) },
  )
