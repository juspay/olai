/** Start a selected bundle without granting its rows permanent host status.
 *
 * Boot has two settling barriers. Providers first acquire their independent
 * services; only then can Surface composition publish a coherent transport
 * door. Transport consumers settle against that door before the listener opens.
 * This lets content run headless and avoids a provider/transport dependency
 * cycle. The bundle adapts product inputs; the host owns only coordination.
 * Provider withdrawals change the composed generation without restarting
 * unrelated capabilities; reverse scope order drains rows before the host.
 */
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
import { provideInputs, ticketsFor } from "@olai/bundle/inputs";
import { WRITE_RESERVATIONS } from "@olai/bundle/policy";
import { agentTools } from "@olai/bundle/tools";
import { runtimePaths } from "./runtime-paths.ts"
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
    // THE STATE HOME IS SWEPT ONCE PER BOOT, and this is the first statement
    // because it is the only one in this function that nothing else waits on.
    // Every temp directory a test or a script ever served leaves
    // a record behind, and the read path can never meet one — it is only ever
    // asked about the directory being served right now, which by construction
    // exists — so the home grows a file per directory the machine has ever seen
    // and nobody is ever the one to notice. `@olai/state`'s header carries the
    // ruling this obeys, ENOENT and nothing else.
    //
    // FORKED because `pruneGone` is plain synchronous `readdirSync`/`statSync`
    // over a home whose size no serve is allowed to assume: run in line it
    // stands between the person and the bind, and run after `transports.start`
    // it stalls the event loop with a port already accepting. Forked and FIRST,
    // it lands in the boot's own idle, before there is a socket for it to hold
    // up. SCOPED rather than daemon-forked so it is this serve's fiber: a boot
    // that dies on the port two dozen statements down interrupts the walk with
    // the scope instead of leaving it running against a process that is already
    // unwinding.
    yield* Effect.forkScoped(Effect.suspend(() => {
        const count = pruneGone();
        return count > 0 ? Effect.annotateLogs(Effect.logInfo("pruned state records for directories that are gone"), { count }) : Effect.void;
    }));
    const profile = options.profile ?? "web";
    // EVERY ROW THIS BUILD HAS, read before the profile patch and before
    // `--plugins` — which is what makes it the right list for all three of its
    // readers. `settled` below waits out MOVEMENT rather than readiness
    // (`@olai/effect-cordis`'s `settled`), so a row the patch disabled never
    // entered the registry, holds no inertia, and costs the barrier one `has`;
    // a list narrowed to the enabled rows would be a second reading of the flag
    // beside `pluginsPatch`'s, and the two would drift. `openLoading` takes it
    // as the RESERVED names, so a plugin the served directory defines cannot
    // claim a bundle row's word. And `bind` walks it to build the roster, which
    // is why a disabled row is a ROW on the plugins panel with a switch under it
    // rather than an absence: `off`, `optIn` and `switched` are three different
    // sentences about a row that is not running, and a post-patch list could
    // draw none of them (`./runtime.test.ts`, "every plugin the build has is on
    // the roster, running or not").
    const built = BUNDLE_NAMES;
    const onChange = { run: (): void => { } };
    const token = randomBytes(24).toString("hex");
    /**
     * THE CYCLE BROKEN, and this box is the break.
     *
     * A fenced ticket is minted off the MCP row's `ticketMint`, which is offered
     * on `plugins.host` — so tickets need the host. And the host is opened with
     * a `ticketFor` door already in its config, because `Tools.ticket` is a
     * service every plugin reads through and core will not hand one out later —
     * so the host needs the ticket door. `ticketsFor(plugins.host)` cannot be
     * spelled before the line that mints the host, and `openPlugins` cannot be
     * spelled after it. The closure handed down captures the BINDING rather than
     * a value, so it reads whatever this box holds at CALL time, and the
     * assignment below lands before the first row is mounted.
     *
     * `?? null` IS NOT A GUARD, it is the answer. `Tools.ticket` already
     * answers `NO_TICKET` for a serve with no MCP face, and its one caller
     * refuses to seat a session on an absent fence rather than inventing one
     * (`@olai/plugin-api`'s `PluginsConfig.ticketFor`). A ticket asked for while
     * this box is still `undefined` therefore gets the same answer as a ticket
     * asked for on `olai surface` or on any headless serve — never a fabricated
     * bearer onto nothing, and never a boot that has to be ordered around the
     * question. `ticketsFor` itself is late-bound a second time, per call, so a
     * departed MCP provider leaves no old issuer installed (`@olai/bundle`'s
     * `inputs.ts`).
     */
    let issueTicket: ReturnType<typeof ticketsFor> | undefined;
    const served = resolve(options.root);
    yield* Effect.annotateLogsScoped({ root: served });
    const say = yield* emitter;
    // Tool users may be acquired before a port exists. Their Deferred is
    // fulfilled only after a listener actually starts; a transport-free bundle
    // does not invent an address or report tool connectivity it never acquired.
    const toolsReady = yield* Deferred.make<ToolServer>();
    // THE FIVE STEPS THAT FOLLOW ARE ONE ORDER, and each is here because of the
    // one above it rather than because of a preference.
    //
    // `openPlugins` mints the host and stands core's own doors behind it — the
    // environment, the clock, the tool address, the ticket seam, the per-plugin
    // local-state chain. Nothing below has a host to name until it returns.
    //
    // `provideInputs` puts `VaultBoot` — the served root and the machine-local
    // path calculations — behind its key BEFORE any row exists, because the
    // vault row's `apply` reads it to open the directory. Provided after the
    // mount instead, that row would mount `waiting` on `vault.boot`, come back
    // a settle later, and every row that names `Vault`, `Ops` or `Directory`
    // would be a turn behind it for no reason a reader could find.
    //
    // `mountBundle` turns the rows into fibers under the profile patch and the
    // `--plugins` pin, and returns once every one of them has stopped moving.
    //
    // `openLoading` provides `HostLoading`, which is how a row publishes a
    // CATALOG of plugins it loads itself — the served directory's own
    // definitions (`olai-plugin-vault-plugins`). It takes `built` as the
    // reserved names and `plugins.serviceKeys` / `browserKeys` as the metadata
    // a catalog is described against, so it needs both of the two above it.
    //
    // `reportBundle(plugins.host, loading.names())` is last because it is ONE
    // reading over ONE host: a bundle row and a plugin the vault defines are
    // the same kind of thing in the same registry, and `loading.names()` is
    // empty until the catalogs have been described. Two readings on two clocks
    // is exactly the defect that made a definition's word stick at whatever it
    // was when it mounted (`@olai/bundle`'s `reportBundle`).
    const plugins = yield* openPlugins({
        vars: options.vars ?? process.env,
        now: () => new Date().toISOString(),
        tools: toolsReady,
        ticketFor: (...args) => issueTicket?.(...args) ?? null,
        rank: bundleRank,
        localStateFor: (plugin) => localStateFor(plugin, served, (line) => say(Effect.logWarning(line))),
        changed: () => onChange.run(),
    });
    issueTicket = ticketsFor(plugins.host);
    const pluginPin = options.pluginPin;
    yield* provideInputs(plugins.host, { root: served, runtime: runtimePaths });
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
    // First barrier: independent providers have either acquired their services
    // or reported why they cannot. Transport rows may still wait for the door
    // below; waiting is a real state, not successful browser activation.
    //
    // IT WAITS OUT MOVEMENT, NOT READINESS, which is what makes it safe to name
    // `built` — every row the build has — rather than the ones that are going to
    // run. A fiber genuinely `PENDING` on a key nothing in this build offers
    // holds no inertia at all, so it settles at once and stays `waiting`; a row
    // the patch disabled never entered the registry and there is nothing to
    // wait on. What the barrier buys is the case a bundle whose own rows stand
    // behind each other's doors creates: one row provides while it applies, and
    // every row that named that key is woken a whole turn later. Without it the
    // report taken on the next line calls a running row `waiting` until
    // something else republishes, and the roster a first tab reads is the
    // bundle mid-assembly (`@olai/effect-cordis`'s `settled` argues the loop).
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
    // Observe fatal runtime exits before publishing a listener: `watchFault`
    // has to be holding `wired.bound.done` before anything can close it, or the
    // one settle that matters happens with nobody reading.
    //
    // FOUR FINALIZERS CLOSE THIS SERVE, AND THEY ARE NOT ALL WRITTEN HERE.
    // Effect runs a scope's finalizers in REVERSE registration order (`Scope`'s
    // own doc worked example: three registered, three run last-first), so the
    // shutdown order is the reverse of the reading order and the last two are
    // twenty and thirty lines below. In the order they actually RUN:
    //
    //   1. `runtime.stopped` — registered LAST, so it runs FIRST, and that is
    //      the whole of its job. It says we are no longer meant to be serving,
    //      which is what turns every settle after it from news into an ordinary
    //      shutdown. Registered anywhere earlier it would run after something
    //      had already closed the surface runtime, and a Ctrl+C would print
    //      `surface runtime faulted — unrecoverable` over the real reason
    //      (`./fault.ts` carries the argument; `./serve.test.ts`'s "a listen
    //      failure is reported as itself, not as a faulted runtime" holds it).
    //   2. `transports.stop` — the port goes first among the real teardowns:
    //      sockets are dropped rather than waited on, because a websocket or an
    //      HTTP keep-alive outliving a tab's last visible activity would keep a
    //      stopped process holding the directory lock (`./listener.ts`).
    //   3. `plugins.close` — the rows drain. Each dispose unwinds that row's
    //      registrations and rings `onChange`, which is still `./runtime.ts`'s
    //      `notifyChange` at this point, so a departing sibling is actually
    //      dropped from the composed generation rather than left mounted over a
    //      closed host. The `TransportSurface` provision withdraws between this
    //      and the step above, on its own `provide` finalizer.
    //   4. `wired.bound.close()` — the composed Surface last, after the
    //      providers whose handlers it serves. Closing it first would retract
    //      every sibling's ctx and wire face out from under a row that is still
    //      running its own teardown through them.
    //
    // Each of the four keeps a failed or hanging teardown as a failure on its
    // own scope rather than swallowing it.
    const runtime = yield* watchFault(wired.bound);
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()));
    yield* Effect.addFinalizer(() => plugins.close);
    const transports = yield* listener({ host: options.host, port: options.port });
    // Handlers and exposure are read at each connection, not captured at boot:
    // a capability switch must revoke old authority and affect the next dial.
    // No notebook schema is needed to publish this transport description.
    //
    // AFTER THE LISTENER AND BEFORE THE SECOND BARRIER, and both halves of that
    // are the door's own shape. It carries `transports.register`, so the shared
    // port has to exist before there is a door to hand out; and a transport row
    // is `waiting` on `transport-surface` until it can register, so the barrier
    // below — whose whole claim is that transports have registered their actual
    // routes — would settle on a bundle that had never been given the chance.
    // Nothing is bound by publishing it: the listener accumulates entries
    // without opening a port until `start`, which is what lets a transport-free
    // profile compose the same door and never become a network server.
    //
    // Publishing it before the generation has settled is safe because what
    // crosses is a READER and not a snapshot — `live()` and `agent()` are
    // thunks over `wired.bound`, re-read at each accept, and kolu's
    // `restrictServedGeneration` takes the triple as one generation per socket.
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
        agentRows: () => wired.bound.rows.map(row => ({ name: row.name, surface: row.surface, tools: row.tools ?? [] })),
        agentTools: Effect.promise(agentTools),
        writeReservations: WRITE_RESERVATIONS,
    }));
    // Shutdown step 2 of the four the paragraph above orders — registered here,
    // after the door the rows register their routes through, so it runs before
    // the rows that hold those routes drain.
    yield* Effect.addFinalizer(() => transports.stop);
    // Second barrier: transports have registered their actual routes. The
    // listener chooses whether a port is needed; passive media routes alone
    // must not turn a headless, transport-free selection into a network server.
    yield* settled(plugins.host, built);
    report = yield* reportBundle(plugins.host, loading.names());
    onChange.run();
    // THE OPERATOR'S TYPO STOPS THE BOOT RATHER THAN EVERY SOCKET. The trusted
    // upgrade-header names are the identity row's, read live off whatever row
    // offered `Identity` — so the list only exists after the barrier above, and
    // it is spent HERE, one statement before the port opens, on the framework's
    // own grammar check. The ws row runs the same `checkUpgradeHeaders` at every
    // accept and can only narrate a refusal and serve that connection with NO
    // named headers, because one row's defect must not take the wire down for
    // every other tenant of it (`@olai/plugin-api`'s `Identity`). That is the
    // right answer for a list that went bad mid-serve and the wrong one for a
    // serve that came up with a list nothing can ever serve: an
    // `OLAI_IDENTITY_LOGIN_HEADER` an operator misspelled would then read as a
    // server that starts, accepts, and quietly attributes every request to
    // nobody.
    //
    // A SYNC EFFECT because the check THROWS rather than failing — a bad header
    // name is the app's own defect, not a condition of the machine, and kolu
    // refuses it that way on purpose so a consumer's `EADDRINUSE` policy cannot
    // retry it forever against something no port can fix.
    //
    // AND THE FAULT MUST AWAIT `runtime.stopped` FIRST, which is the same clause
    // `transports.start` carries on the next line and for the same reason: the
    // finalizer that flips it has not been registered yet at this point in the
    // scope, so unwinding from here runs `plugins.close` and
    // `wired.bound.close()` with `watchFault` still believing we are serving.
    // Closing the composed runtime settles its `done`, `watchFault` reads that
    // as a fault, and the honest failure — the misspelled header, or `cannot
    // listen on 127.0.0.1:7714` — is buried under `surface runtime faulted`
    // (`./fault.ts`; `./serve.test.ts` holds it against a real socket).
    yield* Effect.onError(Effect.sync(() => checkUpgradeHeaders(currentIdentity().headers)), () => runtime.stopped);
    const url = yield* Effect.onError(transports.start, () => runtime.stopped);
    // Shutdown step 1 of the four ordered above — registered last so it runs
    // first, and only once the two statements that need the `onError` clause
    // are behind us.
    yield* Effect.addFinalizer(() => runtime.stopped);
    if (url && !LOOPBACK.has(options.host)) {
        yield* Effect.annotateLogs(Effect.logWarning("bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them"), { host: options.host });
    }
    if (url)
        yield* Deferred.succeed(toolsReady, { name: "olai", url: `${url}/mcp`, token });
    return runtime.faulted;
});
const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);
