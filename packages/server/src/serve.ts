import { report as reportTransport } from "./report.ts";
import { CurrentWho, whoRoute } from "./who.ts";
import { checkUpgradeHeaders } from "@kolu/surface-app/upgrade-headers";
import { BUNDLE_NAMES, ROWS, configsOf, mountBundle, provide, settled, offered, reportBundle, rowsNaming, setRow, } from "@olai/bundle/bundle";
import { bundleRank } from "@olai/bundle";
import { emitter, liveLevel } from "@olai/log";
import { ConfigurationSource, Vault as ContentRevision, Identity, openPlugins, type ToolServer, } from "@olai/plugin-api/services";
import { Deferred, Effect, Layer } from "effect";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { localStateFor } from "./localState.ts";
import { pruneGone } from "@olai/state";
import { openLoading } from "@olai/plugin-api/services";
import { watchFault } from "./fault.ts";
import { hostnameReading } from "./hostname.ts";
import { NOBODY, readingOf } from "./who.ts";
import { type Profile } from "./profiles.ts";
import { listener } from "./listener.ts";
import { advertisedFor, provideInputs, ticketsFor } from "@olai/bundle/inputs";
import { WRITE_RESERVATIONS } from "@olai/bundle/policy";
import { runtimePaths } from "./runtime-paths.ts"
import { TransportSurface } from "@olai/plugin-api/transport";
import { bind } from "./runtime.ts";
import { followConfiguration } from "./configuration.ts";
import { processPolicy } from "./process-policy.ts";
export interface ServeOptions {
    readonly profile?: Profile;
    readonly root: string;
    readonly port: number;
    readonly host: string;
    readonly addressAuthors?: { readonly host: "flag" | "default"; readonly port: "flag" | "default" };
    readonly clientDist: string | Effect.Effect<string>;
    readonly allowedOrigins: ReadonlyArray<string>;
    readonly vars?: Record<string, string | undefined>;
}
export const serve = (options: ServeOptions) => Effect.gen(function*() {
    const logging = yield* liveLevel;
    return yield* serving(options, logging).pipe(Effect.provide(logging.layer));
});
const serving = (options: ServeOptions, logging: Effect.Success<typeof liveLevel>) => Effect.gen(function* () {
    yield* Effect.forkScoped(Effect.suspend(() => {
        const count = pruneGone();
        return count > 0 ? Effect.annotateLogs(Effect.logInfo("pruned state records for directories that are gone"), { count }) : Effect.void;
    }));
    const profile = options.profile ?? "web";
    const built = BUNDLE_NAMES;
    const onChange = { run: (): void => { } };
    const token = randomBytes(24).toString("hex");
    let addressPort = options.port;
    let ownPolicy = processPolicy(undefined, () => {});
    const warned = new Set<string>();
    let issueTicket: ReturnType<typeof ticketsFor> | undefined;
    let readAdvertised: ReturnType<typeof advertisedFor> | undefined;
    const served = resolve(options.root);
    yield* Effect.annotateLogsScoped({ root: served });
    const say = yield* emitter;
    const toolsReady = yield* Deferred.make<ToolServer>();
    const plugins = yield* openPlugins({
        vars: options.vars ?? process.env,
        now: () => new Date().toISOString(),
        tools: toolsReady,
      advertisedFor: (server, tool) => readAdvertised?.(server, tool) ?? null,
      ticketFor: (...args) => issueTicket?.(...args) ?? null,
        rank: bundleRank,
        localStateFor: (plugin) => localStateFor(plugin, served, (line) => say(Effect.logWarning(line))),
        changed: () => onChange.run(),
    });
    issueTicket = ticketsFor(plugins.host);
    readAdvertised = advertisedFor(plugins.host);
    yield* provideInputs(plugins.host, { root: served, runtime: runtimePaths });
    yield* mountBundle(plugins.host, [], profile, true);
    const loading = yield* openLoading(plugins.host, built, () => onChange.run(), { services: plugins.serviceKeys, browserServices: plugins.browserKeys });
    const policy = yield* followConfiguration(plugins.host, () => onChange.run(), () => [plugins.offers().get(ContentRevision.cordis), plugins.offers().get(ConfigurationSource.cordis)], publication => {
      ownPolicy = processPolicy(publication, line => {
        if (!warned.has(line)) { warned.add(line); say(Effect.logWarning(line)); }
      });
      logging.set(ownPolicy.config["log-level"]);
      logging.setFormat(ownPolicy.config["log-format"]);
    }, profile);
    yield* policy.ready;
    let report = yield* reportBundle(plugins.host, loading.names());
    const switched = new Set<string>();
    const flipped = (id: string, enabled: boolean) => Effect.gen(function* () {
        const found = yield* setRow(plugins.host, id, enabled);
        report = yield* reportBundle(plugins.host, loading.names());
        if (found) {
            if (enabled)
                switched.delete(id);
            else
                switched.add(id);
        }
        return found;
    });
    const currentIdentity = (): Identity => (offered(plugins.host, Identity) as Identity | undefined) ?? NOBODY;
    const who = readingOf(currentIdentity);
    yield* settled(plugins.host, built);
    report = yield* reportBundle(plugins.host, loading.names());
    const machine = hostnameReading();
    const theMachine = machine.value;
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    const wired = yield* bind({
        hostname: theMachine,
        startedAt,
        plugins: {
            plugins,
            onChange,
            built,
            instance: () => ({ host: options.host, port: addressPort,
              hostAuthor: options.addressAuthors?.host ?? "process", portAuthor: options.addressAuthors?.port ?? "process", policy: ownPolicy.values, ...(ownPolicy.node === undefined ? {} : { configurationNode: ownPolicy.node }),
              hostname: theMachine, hostnameAuthor: machine.author, origins: options.allowedOrigins, bearer: { set: token.length > 0 } }),
            offByDefault: ROWS.filter((row) => row.disabled).map((row) => row.id),
            browserOnly: ROWS.filter((row) => row.browserOnly).map((row) => row.id),
            report: () => report,
            names: () => rowsNaming(plugins.host),
            configs: () => configsOf(plugins.host),
            configuration: policy.current,
            configurationDefaults: policy.defaults,
            environment: policy.environment,
            persistent: policy.persistent,
            configure: policy.configure,
            set: (id, enabled) => policy.set(id, enabled, () => flipped(id, enabled)),
            reread: Effect.gen(function* () {
                report = yield* reportBundle(plugins.host, loading.names());
            }),
            switched: () => switched,
            catalogs: loading.catalogs,
        },
    });
    const runtime = yield* watchFault(wired.bound);
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()));
    yield* Effect.addFinalizer(() => plugins.close);
    yield* Effect.addFinalizer(() => policy.close);
    const transports = yield* listener({ host: options.host, port: options.port });
    yield* provide(plugins.host, TransportSurface, () => ({
        register: transports.register,
        live: () => ({ group: wired.bound.group, handlers: wired.bound.handlers, expose: wired.faces.browser }),
        services: (connection) => Layer.succeed(CurrentWho)(who(connection.headers)),
        routes: whoRoute(who),
        upgradeHeaders: () => currentIdentity().headers,
        allowedOrigins: options.allowedOrigins,
        report: (event) => reportTransport(event, say),
        who,
        clientDist: typeof options.clientDist === "string" ? Effect.succeed(options.clientDist) : options.clientDist,
        browserBoot: () => ROWS.filter((row) => row.browserOnly && report.get(row.id)?.state === "running").map((row) => row.id),
        hostname: theMachine,
        token,
        agent: () => ({ group: wired.bound.group, handlers: wired.bound.handlers, expose: wired.faces.agent, writes: wired.bound.writes }),
        agentRows: () => wired.bound.rows.map(row => ({ name: row.name, surface: row.surface, resources: row.resources ?? {}, tools: row.tools ?? [], charter: row.charter })),
        agentRosterMoved: wired.bound.rosterMoved,
        writeReservations: WRITE_RESERVATIONS,
    }));
    yield* Effect.addFinalizer(() => transports.stop);
    yield* settled(plugins.host, built);
    report = yield* reportBundle(plugins.host, loading.names());
    onChange.run();
    yield* Effect.onError(Effect.sync(() => checkUpgradeHeaders(currentIdentity().headers)), () => runtime.stopped);
    const url = yield* Effect.onError(transports.start, () => runtime.stopped);
    if (url) addressPort = Number(new URL(url).port || "80");
    onChange.run();
    yield* Effect.addFinalizer(() => runtime.stopped);
    if (url && !LOOPBACK.has(options.host)) {
        yield* Effect.annotateLogs(Effect.logWarning("bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them"), { host: options.host });
    }
    if (url)
        yield* Deferred.succeed(toolsReady, { name: "olai", url: `${url}/mcp`, token });
    return runtime.faulted;
});
const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);
