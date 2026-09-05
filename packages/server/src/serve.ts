/** The vault and kinds base, the selected tenant bundle, and scoped transport rows.
 * The store remains root-owned until Phase 17. Profiles share this composition;
 * only their loader rows differ. */
import { type GitPin, type PageRequest } from "@olai/format"
import {
  make as makeOps,
  NO_LEDGER,
  NO_SEARCH,
  type Ledger as OpsLedger,
  type Ops,
  type Search as OpsSearch,
  TOOLS,
} from "@olai/ops"
import {
  BUNDLE_NAMES,
  configsOf,
  mountBundle,
  provide,
  settled,
  offered,
  reportBundle,
  rowsNaming,
  setRow,
} from "@olai/bundle/bundle"
import { bundleRank } from "@olai/bundle"
import { emitter } from "@olai/log"
import {
  Identity,
  Ledger,
  NOWHERE_TO_WRITE,
  openPlugins,
  type PropWrite,
  Search,
  type ToolServer,
} from "@olai/plugin-api/services"
import { Deferred, Effect } from "effect"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"

import { localStateFor } from "./localState.ts"
import { openDirectory } from "./directory.ts"
import { openDynamic } from "./dynamic/runtime.ts"
import { propKinds } from "./propKinds.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { NOBODY, readingOf } from "./identity.ts"
import { PROFILES, profileRows, TRANSPORT_ROWS, type Profile } from "./profiles.ts"
import { transportListener, transportModules, TransportSurface } from "./transports.ts"
import { clientOver, serveFace } from "./mcp/face.ts"
import { currentLogin, MCP_PATH, mcpTransport } from "./mcp/route.ts"
import { ticketing, type Tickets } from "./mcp/tickets.ts"
import { bespokeFrom, pluginTools } from "./mcp/tools.ts"
import { gitConfigPatch } from "./gitPolicy.ts"
import { bind, writerAt } from "./runtime.ts"

export interface ServeOptions {
  readonly profile?: Profile
  readonly root: string
  readonly port: number
  readonly host: string
  readonly clientDist: string
  readonly allowedOrigins: ReadonlyArray<string>
  readonly vars?: Record<string, string | undefined>
  readonly pin: GitPin
  readonly plugins: ReadonlyArray<string> | null
}

export const serve = (options: ServeOptions) =>
  Effect.gen(function*() {

    const profile = options.profile ?? "web"
    const built = [...BUNDLE_NAMES, ...TRANSPORT_ROWS]
    const onChange = { run: (): void => {} }

    // A process credential; session tickets are minted only while the MCP row stands.
    const token = randomBytes(24).toString("hex")

    let mintTicket: Tickets["mint"] | null = null

    let opsLayer: Ops | null = null

    const served = resolve(options.root)

    yield* Effect.annotateLogsScoped({ root: served })

    const say = yield* emitter

    const toolsReady = yield* Deferred.make<ToolServer>()

    // Mount vocabulary before the store constructs its codec. Transport rows wait
    // on TransportSurface until the composed surface and its write gate exist.
    const plugins = yield* openPlugins({
      vars: options.vars ?? process.env,
      now: () => new Date().toISOString(),
      served,
      tools: toolsReady,
      ticketFor: (seated, above) => mintTicket?.(seated, above) ?? null,
      ops: {
        reading: Effect.suspend(() =>
          opsLayer === null
            ? Effect.succeed(null)
            : Effect.catch(opsLayer.read, () => Effect.succeed(null))
        ),
        page: (request: unknown) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              : opsLayer.page(request as PageRequest)
          ),
        prop: (write: PropWrite) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              : Effect.asVoid(opsLayer.run(
                { op: "prop", id: write.node, key: write.key, value: write.value },
                "web",
              ))
          ),
        document: (file: string) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              : Effect.asVoid(opsLayer.run({ op: "create-doc", file }, "web"))
          ),
      },
      rank: bundleRank,
      localStateFor: (plugin) => localStateFor(plugin, served, (line) => say(Effect.logWarning(line))),
      changed: () => onChange.run(),
    })
    yield* mountBundle(plugins.host, options.plugins ?? (PROFILES[profile].tenants ? null : []), gitConfigPatch(options.pin), {
      rows: profileRows(profile),
      resolve: async (name) => transportModules[name],
    })

    const dynamic = openDynamic(plugins.host, built)

    let report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])

    const switched = new Set<string>()
    const flipped = (id: string, enabled: boolean) =>
      Effect.gen(function*() {
        const found = yield* setRow(plugins.host, id, enabled)
        report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
        if (found) {
          if (enabled) switched.delete(id)
          else switched.add(id)
        }
        return found
      })
    const kinds = yield* propKinds(plugins)
    const { root, store } = yield* openDirectory(options.root, kinds)

    // Offers are read per operation so a provider flip reaches existing callers.
    const ledger: OpsLedger = {
      wrote: (writer) => currentLedger().wrote(writer),
      whyWaiting: (writer) => currentLedger().whyWaiting(writer),
      record: (request, writer) => currentLedger().record(request, writer),
      get push() {
        return currentLedger().push
      },
      get resume() {
        return currentLedger().resume
      },
    }
    const currentLedger = (): OpsLedger =>
      (offered(plugins.host, Ledger) as OpsLedger | undefined) ?? NO_LEDGER

    const search: OpsSearch = {
      nodes: (ask) => currentSearch().nodes(ask),
    }
    const currentSearch = (): OpsSearch =>
      (offered(plugins.host, Search) as OpsSearch | undefined) ?? NO_SEARCH

    const currentIdentity = (): Identity =>
      (offered(plugins.host, Identity) as Identity | undefined) ?? NOBODY

    const who = readingOf(currentIdentity)

    const ops: Ops = makeOps({
      store,
      root,
      ledger,
      search,
      kinds,
      onRefusal: (request, failure) => plugins.refused({ op: request.op, failure }),
    })
    opsLayer = ops
    const theMachine = hostname()
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString()
    const wired = yield* bind({
      store,
      ops,
      writer: "web",
      hostname: theMachine,
      startedAt,
      plugins: {
        plugins,
        onChange,
        built,
        pinned: options.plugins,
        report: () => report,
        names: () => rowsNaming(plugins.host, TRANSPORT_ROWS),
        configs: () => configsOf(plugins.host),
        set: flipped,
        reread: Effect.gen(function*() {
          report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
        }),
        switched: () => switched,
        dynamic,
      },
    })
    // Drain transports and rows before releasing the surface and store.
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => plugins.close)
    const transport = mcpTransport()
    const mcp = Effect.gen(function*() {
      const panel = clientOver(
        {
          group: wired.bound.group,
          handlers: writerAt(wired.bound, ops, { writer: "chat-agent", fence: null }),
        },
        wired.faces.agent,
      )
      const tickets = ticketing({ bound: wired.bound, face: wired.faces.agent, ops, token })
      mintTicket = tickets.mint
      yield* Effect.addFinalizer(() => Effect.sync(() => { mintTicket = null }))
      yield* serveFace({
        client: () => panel,

        tools: {
          ...bespokeFrom(TOOLS, {
            login: currentLogin,
            root,
            vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
            fenced: tickets.doorAt,
            record: (request) => ops.commit(request, "chat-agent"),
            push: ops.push,
          }),
          ...pluginTools(),
        },
        transport,
      })

    })
    const transports = yield* transportListener({
      ...options,
      bound: wired.bound,
      expose: () => wired.faces.browser,
      hostname: theMachine,
      upgradeHeaders: currentIdentity().headers,
      who,
      mcp: { transport, token, who },
      resync: Effect.andThen(ops.idle, store.refresh("verified")),
      plugins: dynamic,
    })
    // The rows activate on this service; their own scopes own their acquisitions.
    yield* provide(plugins.host, TransportSurface, () => ({ register: transports.register, mcp }))
    yield* Effect.addFinalizer(() => transports.stop)
    yield* settled(plugins.host, built)
    report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
    onChange.run()
    const url = yield* transports.start
    yield* Effect.addFinalizer(() => runtime.stopped)

    if (url && !LOOPBACK.has(options.host)) {
      yield* Effect.annotateLogs(
        Effect.logWarning(
          "bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them",
        ),
        { host: options.host },
      )
    }

    const address: ToolServer | undefined = url ? { name: "olai", url: `${url}${MCP_PATH}`, token } : undefined
    if (address) yield* Deferred.succeed(toolsReady, address)

    return runtime.faulted
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])
