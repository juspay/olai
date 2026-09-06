/** Compose the selected bundle, management Surface and listener.
 * Capabilities own their domain services, handlers and HTTP routes. The host
 * supplies operator settings, scoped loading, identity and transport policy.
 * Provider withdrawals change the composed generation without restarting
 * unrelated capabilities; reverse scope order drains rows before the host. */
import { report as reportTransport } from "./report.ts";
import { CurrentWho, whoRoute } from "./who.ts";
import { checkUpgradeHeaders } from "@kolu/surface-app/upgrade-headers";
import { type GitPin, type PluginPin } from "@olai/format";
import { BUNDLE_NAMES, ROWS, configsOf, mountBundle, provide, settled, offered, reportBundle, rowsNaming, setRow, } from "@olai/bundle/bundle";
import { bundleRank } from "@olai/bundle";
import { emitter } from "@olai/log";
import { Identity, openPlugins, type ToolServer, } from "@olai/plugin-api/services";
import { Deferred, Effect, Layer } from "effect";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { localStateFor } from "./localState.ts";
import { pruneGone } from "@olai/state";
import { openLoading } from "@olai/plugin-api/services";
import { watchFault } from "./fault.ts";
import { hostname } from "./hostname.ts";
import { NOBODY, readingOf } from "./who.ts";
import { type Profile } from "./profiles.ts";
import { listener } from "./listener.ts";
import { ticketMint, type TicketMint } from "olai-plugin-mcp/contract";
import { WRITE_RESERVATIONS } from "@olai/bundle/policy";
import { runtimePaths } from "./runtime-paths.ts"
import { VaultBoot } from "olai-plugin-vault/boot";
import { TransportSurface } from "@olai/plugin-api/transport";
import { gitConfigPatch } from "./gitPolicy.ts";
import { bind } from "./runtime.ts";
export interface ServeOptions {
    readonly profile?: Profile;
    readonly root: string;
    readonly port: number;
    readonly host: string;
    readonly clientDist: string | Effect.Effect<string>;
    readonly allowedOrigins: ReadonlyArray<string>;
    readonly vars?: Record<string, string | undefined>;
    readonly pin: GitPin;
    readonly pluginPin: PluginPin;
}
export const serve = (options: ServeOptions) => Effect.gen(function* () {
    yield* Effect.forkScoped(Effect.suspend(() => {
        const count = pruneGone();
        return count > 0 ? Effect.annotateLogs(Effect.logInfo("pruned state records for directories that are gone"), { count }) : Effect.void;
    }));
    const profile = options.profile ?? "web";
    const built = BUNDLE_NAMES;
    const onChange = { run: (): void => { } };
    const token = randomBytes(24).toString("hex");
    let currentMint: () => TicketMint | undefined = () => undefined;
    const served = resolve(options.root);
    yield* Effect.annotateLogsScoped({ root: served });
    const say = yield* emitter;
    const toolsReady = yield* Deferred.make<ToolServer>();
    const plugins = yield* openPlugins({
        vars: options.vars ?? process.env,
        now: () => new Date().toISOString(),
        tools: toolsReady,
        ticketFor: (...args) => currentMint()?.mint(...args) ?? null,
        rank: bundleRank,
        localStateFor: (plugin) => localStateFor(plugin, served, (line) => say(Effect.logWarning(line))),
        changed: () => onChange.run(),
    });
    currentMint = () => offered(plugins.host, ticketMint);
    const pluginPin = options.pluginPin;
    yield* provide(plugins.host, VaultBoot, () => ({ root: served, runtime: runtimePaths }));
    yield* mountBundle(plugins.host, pluginPin, gitConfigPatch(options.pin), profile);
    const loading = yield* openLoading(plugins.host, built, () => onChange.run(), { services: plugins.serviceKeys, browserServices: plugins.browserKeys });
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
    const theMachine = hostname();
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    const wired = yield* bind({
        hostname: theMachine,
        startedAt,
        plugins: {
            plugins,
            onChange,
            built,
            browserOnly: ROWS.filter((row) => row.browserOnly).map((row) => row.id),
            pin: pluginPin,
            report: () => report,
            names: () => rowsNaming(plugins.host),
            configs: () => configsOf(plugins.host),
            set: flipped,
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
        agent: () => ({ group: wired.bound.group, handlers: wired.bound.handlers, expose: wired.faces.agent, writes: wired.bound.writes, dispatch: wired.bound.dispatch }),
        writeReservations: WRITE_RESERVATIONS,
    }));
    yield* Effect.addFinalizer(() => transports.stop);
    yield* settled(plugins.host, built);
    report = yield* reportBundle(plugins.host, loading.names());
    onChange.run();
    yield* Effect.onError(Effect.sync(() => checkUpgradeHeaders(currentIdentity().headers)), () => runtime.stopped);
    const url = yield* Effect.onError(transports.start, () => runtime.stopped);
    yield* Effect.addFinalizer(() => runtime.stopped);
    if (url && !LOOPBACK.has(options.host)) {
        yield* Effect.annotateLogs(Effect.logWarning("bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them"), { host: options.host });
    }
    if (url)
        yield* Deferred.succeed(toolsReady, { name: "olai", url: `${url}/mcp`, token });
    return runtime.faulted;
});
const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);
