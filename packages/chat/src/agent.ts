/**
 * The ACP client: one subprocess, one protocol, no browser.
 *
 * Everything about the Agent Client Protocol stops here — nothing else in olai
 * spells `session/prompt` — and nothing in here knows what a surface member, a
 * transcript entry or a browser is. A caller gets something it can boot,
 * prompt, cancel, list, load and stop, plus a stream of typed events through
 * the one handler it gave at construction ({@link ./events.ts}).
 *
 * What this owns, and why:
 *
 *   - **the subprocess and the conversation it comes up in.** Boot is
 *     adopt-or-create, and it is here rather than in the caller because it is a
 *     sequence whose order is a protocol fact: `initialize` says whether the
 *     agent even keeps sessions, `session/list` is scoped by the directory we
 *     were started in, a `session/load` replays before it answers, and the
 *     model is read off whichever result made the session. Adopting the
 *     most-recently-updated one is what makes "the conversation you were last
 *     in" survive a restart (racket's mechanism, kept).
 *   - **the answer to `session/request_permission`.** An unanswered one hangs
 *     the turn forever, so it is answered immediately with the first
 *     allow-flavoured option. That is about not wedging the wire, which is why
 *     it is protocol rather than policy — the tools it is approving are the
 *     mediated ops, already validated (resolved 2026-08-09: auto-approve, a
 *     permission UI is its own item).
 *   - **reading the payloads**: which update kind this is, which `configOptions`
 *     entry is the model, how a session list sorts. An event carries what was
 *     READ, never the raw protocol value.
 *
 * The MCP servers a session is given are the caller's — olai hands its own
 * internal one, which is the standard ACP shape and the only channel the agent
 * has to the ops layer. `fs` capabilities are FALSE in both directions on
 * purpose: this is not an editor, and an agent that could write a file whole
 * would be routing around the format.
 */

import { type ChildProcess, spawn } from "node:child_process"

import {
  client as acpClient,
  type ClientConnection,
  methods,
  ndJsonStream,
} from "@agentclientprotocol/sdk"
import type {
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  McpServer,
  NewSessionResponse,
  PromptResponse,
  SessionConfigOption,
  SessionNotification,
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
} from "@agentclientprotocol/sdk"
import { emitter, reasonOf } from "@olai/log"
import { Data, type Duration, Effect, Semaphore } from "effect"

import type { AgentEvent, Command, Stored } from "./events.ts"

/** An MCP server to hand a session, in olai's terms. {@link mcpServersOf}
 *  renders it into what the protocol wants. */
export interface ToolServer {
  readonly name: string
  readonly url: string
  /** Presented as a bearer token. The route is on the same loopback listener
   *  as everything else, and a WRITE surface any page could POST at is a
   *  different bargain from a read-only one. */
  readonly token: string
}

/** The agent is not there — it never started, it died, or the handshake failed.
 *  Every verb can fail this way and the next one retries the boot, which is why
 *  a crash and a cold start are the same recovery path. */
export class AgentGone extends Data.TaggedError("AgentGone")<{
  readonly why: string
}> {
  override get message(): string {
    return this.why
  }
}

export interface Options {
  /** The executable to run. `OLAI_ACP_AGENT`, or the adapter nix baked in. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** The directory the agent works in — the served directory, absolute. It is
   *  what makes stored sessions findable: an agent keys its conversations by
   *  the directory it was started in. */
  readonly cwd: string
  /** The tool server to hand every session, or `null` while there is none.
   *
   *  A THUNK, because the address is not known until the listener has bound and
   *  the agent is built before that — so the panel can report a boot failure
   *  rather than the boot failing to start. Read once per `session/new` and
   *  `session/load`.
   *
   *  Olai's own description, not ACP's: this module is the only one allowed to
   *  know what an `McpServer` looks like on the wire, and a composition root
   *  that hand-built one would be a second place that knows. */
  readonly tools: () => ToolServer | null
  readonly onEvent: (event: AgentEvent) => void
}

export interface Agent {
  /** Spawn and hand-shake if that has not happened. Idempotent, and serialized
   *  against itself: two callers racing a cold start get one subprocess. */
  readonly boot: Effect.Effect<void, AgentGone>
  /** One turn. Answers with the agent's stop reason (`end_turn`, `cancelled`,
   *  …) — the turn's END is a return value rather than an event, because the
   *  caller that asked is the one waiting. */
  readonly prompt: (text: string) => Effect.Effect<string, AgentGone>
  /** Stop the turn in flight. A notification, so there is nothing to wait for
   *  and nothing that can fail. */
  readonly cancel: Effect.Effect<void>
  readonly newSession: Effect.Effect<void, AgentGone>
  readonly loadSession: (id: string) => Effect.Effect<void, AgentGone>
  /** The stored conversations for this directory, newest first. */
  readonly sessions: Effect.Effect<ReadonlyArray<Stored>, AgentGone>
  readonly stop: Effect.Effect<void>
}

/** The ACP major version this client speaks. */
const PROTOCOL = 1

/** What `session/new` asks the Claude Code adapter to forward, and why: the
 *  adapter handles a `/model` slash command inside the wrapped CLI, so it never
 *  sees a config change and its `configOptions` keep naming the model the
 *  session started on. The CLI's own `system`/`init` message carries the live
 *  one. An agent that is not that adapter ignores `_meta` and nothing here
 *  changes — the config option is still read, and still enough. */
const META = {
  claudeCode: {
    emitRawSDKMessages: [{ type: "system", subtype: "init" }],
  },
}

/** The notification the Claude Code adapter forwards its wrapped CLI's own
 *  messages under, having been asked to by {@link META}. */
const SDK_MESSAGE = "_claude/sdkMessage"

/** Permissions are a session MODE, asked for once. A refusal is not fatal:
 *  `session/request_permission` is answered anyway. */
const BYPASS = "bypassPermissions"

/** Boot is a few small round trips against a process that just started. Only it
 *  gets a deadline — a turn is a person waiting on a language model. */
const BOOT_TIMEOUT = "30 seconds"
/** A load is not small: the agent re-opens a conversation and replays every
 *  message in it before it answers. Its own, longer deadline. */
const LOAD_TIMEOUT = "120 seconds"

interface Live {
  readonly child: ChildProcess
  readonly connection: ClientConnection
  readonly canList: boolean
  readonly canLoad: boolean
}

export const make = (options: Options): Effect.Effect<Agent, never, never> =>
  Effect.gen(function*() {
    // Everything this module has to say happens in a protocol callback or on a
    // subprocess's stderr, where there is no fiber to log from — so the fiber's
    // logging settings are captured once, here, with the agent's own command on
    // every line it will ever emit. `acp: ` used to be that, as a prefix.
    const say = yield* Effect.annotateLogs(emitter, { agent: options.command })

    // The spawn/handshake takes its own permit, so two callers racing a cold
    // start share one subprocess rather than each getting their own.
    const booting = yield* Semaphore.make(1)

    let live: Live | null = null
    let session: string | null = null
    let stopped = false
    /** A cancel that arrived before the prompt was on the wire. Remembered so
     *  every cancelled turn ends the same way, whichever half of the handshake
     *  it landed in. */
    let cancelPending = false

    const emit = (event: AgentEvent) => {
      options.onEvent(event)
    }

    const trouble = (message: string) => {
      say(Effect.logWarning(message))
      emit({ _tag: "trouble", message })
    }

    /** Whether we are replaying. A `session/load` streams the whole
     *  conversation as ordinary updates, and the caller has to be able to tell
     *  history from news — a user message during a replay is something that was
     *  said, not something being said. */
    let replaying = false

    const onUpdate = (notification: SessionNotification): void => {
      const update = notification.update
      switch (update.sessionUpdate) {
        case "agent_message_chunk": {
          const text = textOf(update.content)
          if (text !== "") emit({ _tag: "said", text })
          return
        }
        case "user_message_chunk": {
          if (!replaying) return
          const text = textOf(update.content)
          if (text !== "") emit({ _tag: "userSaid", text })
          return
        }
        // Announce and update are ONE event: the protocol distinguishes them
        // by which fields it guarantees, and a consumer keyed by call id does
        // the same thing with either.
        case "tool_call":
        case "tool_call_update":
          emit({
            _tag: "tool",
            id: update.toolCallId,
            title: update.title ?? undefined,
            status: (update.status ?? undefined) as ToolCallStatus | undefined,
            detail: detailOf(update.rawInput, update.rawOutput),
            progress: progressOf(update.content),
            locations: locationsOf(update.locations),
          })
          return
        case "available_commands_update":
          emit({
            _tag: "commands",
            commands: update.availableCommands.map(
              (command): Command => ({
                name: command.name,
                description: command.description,
              }),
            ),
          })
          return
        case "config_option_update":
          readModel(update.configOptions)
          return
        case "session_info_update":
          if (typeof update.title === "string" && update.title !== "") {
            emit({ _tag: "sessionTitled", title: update.title })
          }
          return
        default:
          // Thoughts, plans, usage. Real parts of the protocol that this panel
          // does not draw; ignored quietly rather than half-rendered.
          return
      }
    }

    /**
     * WHICH MODEL — two sources, because one of them is not enough.
     *
     *   - the session's CONFIG OPTION is what was PICKED. It arrives with
     *     `session/new` and again in a `config_option_update` whenever
     *     anything in that set moves;
     *   - the CLI's own `system`/`init` message is what is RUNNING. It is
     *     forwarded because `session/new` asked for it.
     *
     * They part company at a `/model` slash command: the Claude Code adapter
     * wraps a CLI that handles it internally, so the adapter never learns of
     * it and goes on reporting the model the session started on. Reading only
     * the config option leaves a header that says one thing while every turn
     * runs on another.
     *
     * WHICHEVER MOVED LAST WINS, and each source is debounced against its OWN
     * previous value: the picker resends its whole set when anything in it
     * changes, and the live id repeats on every turn. The FIRST live id is a
     * baseline — it agrees with the config option by construction, and a
     * session announcing itself twice would say the same thing twice.
     *
     * Nothing is guessed: an id the picker does not offer is reported raw and
     * logged once, because a fuzzy match onto a nearby row would be invented.
     */
    let pickedModel: string | null = null
    let liveModel: string | null = null
    /** The picker, as value → label, kept so a LIVE id can be labelled the way
     *  the agent labels its own models. */
    let labels: ReadonlyMap<string, string> = new Map()

    const readModel = (
      configOptions: ReadonlyArray<SessionConfigOption> | null | undefined,
    ): void => {
      const entry = (configOptions ?? []).find((option) => option.id === "model")
      if (entry === undefined || entry.type !== "select") return
      labels = labelsOf(entry)
      const current = entry.currentValue ?? null
      if (current === pickedModel) return
      pickedModel = current
      emit({ _tag: "model", name: current === null ? null : labels.get(current) ?? current })
    }

    const readLiveModel = (params: unknown): void => {
      const id = liveModelIn(params)
      if (id === null || id === liveModel) return
      const baseline = liveModel === null
      liveModel = id
      // The first one agrees with the config option by construction; saying it
      // again would be the same fact in a second spelling.
      if (baseline) return
      const name = labels.get(id)
      if (name === undefined) {
        say(
          Effect.annotateLogs(
            Effect.logWarning("the agent is running a model its picker does not offer"),
            { model: id },
          ),
        )
      }
      emit({ _tag: "model", name: name ?? id })
    }

    const start = (): Effect.Effect<Live, AgentGone> =>
      Effect.gen(function*() {
        const child = yield* Effect.try({
          try: () =>
            spawn(options.command, [...options.args], {
              cwd: options.cwd,
              stdio: ["pipe", "pipe", "pipe"],
            }),
          catch: (cause) =>
            new AgentGone({
              why: `could not start the agent \`${options.command}\`: ${reasonOf(cause)}`,
            }),
        })

        // The agent's stderr is a log sink, not a channel: the adapter
        // redirects all its console output there, and a pipe nobody drains
        // eventually blocks the process writing to it. DEBUG, because it is
        // somebody else's program's log and by volume the loudest thing olai
        // ever emits — `--log-level debug` is how you ask for it.
        child.stderr?.setEncoding("utf8")
        child.stderr?.on("data", (chunk: string) => {
          say(Effect.logDebug(chunk.trimEnd()))
        })

        child.on("exit", (code, signal) => {
          if (live?.child !== child) return
          live = null
          session = null
          if (stopped) return
          emit({ _tag: "sessionOver", why: "gone" })
          emit({
            _tag: "gone",
            why: `the agent exited (code ${code ?? "none"}, signal ${signal ?? "none"})`,
          })
        })

        const connection = acpClient({ name: "olai" })
          .onNotification(methods.client.session.update, (context) => {
            onUpdate(context.params)
          })
          // The CLI's own message, forwarded verbatim because `session/new`
          // asked for it (see META). Asking and then not listening is what
          // this used to do, which is why the header could name a model the
          // session had stopped running. Custom method, so the SDK wants a
          // parser: there is nothing to validate beyond "it is an object", and
          // `readLiveModel` reads one field out of it.
          .onNotification(
            SDK_MESSAGE,
            (params: unknown) => params,
            (context) => {
              readLiveModel(context.params)
            },
          )
          // Answered immediately, with the first allow-flavoured option: an
          // unanswered permission request hangs the turn forever. The session
          // asks for bypass mode at boot; this is the backstop for when that
          // was refused.
          .onRequest(methods.client.session.requestPermission, (context) => {
            const allowed = context.params.options.find((option) =>
              option.kind.startsWith("allow")
            ) ?? context.params.options[0]
            return allowed === undefined
              ? { outcome: { outcome: "cancelled" as const } }
              : {
                outcome: { outcome: "selected" as const, optionId: allowed.optionId },
              }
          })
          .connect(streamOver(child))

        const initialized = (yield* ask(
          connection,
          methods.agent.initialize,
          {
            protocolVersion: PROTOCOL,
            // Not an editor: the agent reaches the outlines through the ops
            // tools or not at all.
            clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
            clientInfo: { name: "olai", version: "0.1.0" },
          },
        )) as InitializeResponse

        const capabilities = initialized.agentCapabilities
        return {
          child,
          connection,
          canList: capabilities?.sessionCapabilities?.list != null,
          canLoad: capabilities?.loadSession === true,
        }
      })

    /** The stored conversations for our own directory, newest first.
     *
     *  The `cwd` we send is a REQUEST, not a filter: the Claude Code adapter
     *  scopes its answer by PREFIX, so a server started in a checkout is told
     *  about every agent working under it — a worktree, an orchestrator in the
     *  root. Adopting the newest of what came back would make somebody else's
     *  coding session this panel's conversation, so the list is narrowed to the
     *  exact directory here, once, and everything downstream draws from it. */
    const storedFor = (at: Live): Effect.Effect<ReadonlyArray<Stored>, AgentGone> =>
      at.canList
        ? Effect.map(
          ask(at.connection, methods.agent.session.list, { cwd: options.cwd }),
          (raw) =>
            (raw as ListSessionsResponse).sessions
              .filter((entry) => sameDirectory(entry.cwd, options.cwd))
              .map((entry): Stored => ({
                id: entry.sessionId,
                title: entry.title ?? null,
                updatedAt: entry.updatedAt ?? null,
              }))
              // An entry the agent gave no timestamp sorts LAST, not first.
              .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
        )
        : Effect.succeed([])

    const openSession = (at: Live): Effect.Effect<void, AgentGone> =>
      Effect.gen(function*() {
        const stored = at.canLoad ? yield* storedFor(at) : []
        const newest = stored[0]
        if (newest !== undefined) {
          yield* load(at, newest.id, newest.title)
          return
        }
        yield* fresh(at)
      })

    const fresh = (at: Live): Effect.Effect<void, AgentGone> =>
      Effect.gen(function*() {
        const made = (yield* ask(at.connection, methods.agent.session.new, {
          cwd: options.cwd,
          mcpServers: [...mcpServersOf(options.tools())],
          _meta: META,
        })) as NewSessionResponse
        session = made.sessionId
        emit({ _tag: "session", id: made.sessionId, title: null })
        readModel(made.configOptions)
        yield* askForBypass(at, made.sessionId)
      })

    const load = (
      at: Live,
      id: string,
      title: string | null,
    ): Effect.Effect<void, AgentGone> =>
      Effect.gen(function*() {
        session = id
        emit({ _tag: "session", id, title })
        // Everything between these two is history. The flag is set before the
        // call because a load replays THEN answers.
        replaying = true
        emit({ _tag: "replayStarted" })
        const loaded = (yield* Effect.onExit(
          ask(
            at.connection,
            methods.agent.session.load,
            { sessionId: id, cwd: options.cwd, mcpServers: [...mcpServersOf(options.tools())] },
            LOAD_TIMEOUT,
          ),
          () =>
            Effect.sync(() => {
              replaying = false
              emit({ _tag: "replayEnded" })
            }),
        )) as LoadSessionResponse | undefined
        readModel(loaded?.configOptions)
        yield* askForBypass(at, id)
      })

    /** Ask for the permission mode that makes the backstop above unnecessary.
     *  A refusal is normal (running as root, an agent that has no such mode)
     *  and is not a boot failure. */
    const askForBypass = (at: Live, id: string): Effect.Effect<void> =>
      Effect.ignore(
        ask(at.connection, methods.agent.session.setMode, {
          sessionId: id,
          modeId: BYPASS,
        }),
      )

    const boot = booting.withPermit(
      Effect.gen(function*() {
        if (stopped) return yield* new AgentGone({ why: "the server is shutting down" })
        if (live !== null && session !== null) return
        const started = live ?? (yield* start())
        live = started
        // `onError` hands the fiber's CAUSE, not the failure — `String` on one
        // of those is `Cause([Fail(…)])` with the reason buried in it, which
        // is a notice a person reads. `reasonOf` squashes it back down.
        yield* Effect.onError(openSession(started), (cause) =>
          Effect.sync(() => {
            trouble(`the agent could not open a session: ${reasonOf(cause)}`)
          }))
      }),
    )

    /** Every verb: boot if necessary, then act on the process that came up. */
    const withLive = <A>(
      use: (at: Live) => Effect.Effect<A, AgentGone>,
    ): Effect.Effect<A, AgentGone> =>
      Effect.gen(function*() {
        yield* boot
        const at = live
        if (at === null) return yield* new AgentGone({ why: "the agent is not running" })
        return yield* use(at)
      })

    /** ... and the ones that also need a conversation to act IN. */
    const withSession = <A>(
      use: (at: Live, id: string) => Effect.Effect<A, AgentGone>,
    ): Effect.Effect<A, AgentGone> =>
      withLive((at) => {
        const id = session
        return id === null
          ? Effect.fail(new AgentGone({ why: "the agent has no session open" }))
          : use(at, id)
      })

    const prompt = (text: string) =>
      withSession((at, id) =>
        Effect.gen(function*() {
          // A cancel that arrived during the handshake is sent the moment the
          // prompt is on the wire, so every cancelled turn ends the same way.
          if (cancelPending) {
            cancelPending = false
            yield* Effect.forkDetach(
              Effect.andThen(
                Effect.sleep("10 millis"),
                notify(at, methods.agent.session.cancel, { sessionId: id }),
              ),
            )
          }
          const answered = yield* ask(
            at.connection,
            methods.agent.session.prompt,
            { sessionId: id, prompt: [{ type: "text", text }] },
            // A turn is a person waiting on a model: no deadline.
            null,
          )
          return (answered as PromptResponse).stopReason
        })
      )

    const cancel = Effect.suspend(() => {
      const at = live
      const id = session
      if (at === null || id === null) {
        // Nothing to cancel yet — remember it for the prompt that is still
        // being handshaked into place.
        cancelPending = true
        return Effect.void
      }
      return Effect.ignore(notify(at, methods.agent.session.cancel, { sessionId: id }))
    })

    const stop = Effect.sync(() => {
      stopped = true
      const at = live
      live = null
      session = null
      if (at === null) return
      at.connection.close()
      if (at.child.exitCode === null) at.child.kill()
    })

    return {
      boot,
      prompt,
      cancel,
      newSession: withLive((at) =>
        Effect.gen(function*() {
          session = null
          emit({ _tag: "sessionOver", why: "new" })
          yield* fresh(at)
        })
      ),
      loadSession: (id: string) =>
        withLive((at) =>
          Effect.gen(function*() {
            if (!at.canLoad) {
              return yield* new AgentGone({
                why: `\`${id}\` cannot be opened: this agent does not keep conversations`,
              })
            }
            const stored = yield* storedFor(at)
            const wanted = stored.find((entry) => entry.id === id)
            session = null
            emit({ _tag: "sessionOver", why: "load" })
            yield* load(at, id, wanted?.title ?? null)
          })
        ),
      sessions: withLive(storedFor),
      stop,
    }
  })

// ── talking to the process ─────────────────────────────────────────────

/**
 * One request, as an Effect.
 *
 * Every protocol failure — a rejection, a dead pipe, a deadline — becomes the
 * one error this module has, because from a caller's side they are the same
 * thing: the agent did not answer.
 *
 * The result is `unknown` and each call site narrows it against the SDK's own
 * response type. The alternative is threading the SDK's method-keyed table
 * through this wrapper, which types the pair correctly and then makes the
 * timeout, the error mapping and the `null`-timeout arm generic over it as
 * well. The cast is at the four call sites, where the expected shape is written
 * down beside the method name.
 */
const ask = (
  connection: ClientConnection,
  method: string,
  params: unknown,
  timeout: Duration.Input | null = BOOT_TIMEOUT,
): Effect.Effect<unknown, AgentGone> => {
  const call: Effect.Effect<unknown, AgentGone> = Effect.tryPromise({
    try: () =>
      (connection.agent as unknown as {
        request: (method: string, params: unknown) => Promise<unknown>
      }).request(method, params),
    catch: (cause) => new AgentGone({ why: `\`${method}\` failed: ${reasonOf(cause)}` }),
  })
  if (timeout === null) return call
  return Effect.catchTag(
    Effect.timeout(call, timeout),
    "TimeoutError",
    () =>
      Effect.fail(
        new AgentGone({
          why: `\`${method}\` did not answer in ${String(timeout)}`,
        }),
      ),
  )
}

const notify = (
  at: Live,
  method: string,
  params: unknown,
): Effect.Effect<void, AgentGone> =>
  Effect.tryPromise({
    try: () =>
      (at.connection.agent as unknown as {
        notify: (method: string, params: unknown) => Promise<void>
      }).notify(method, params),
    catch: (cause) => new AgentGone({ why: `\`${method}\` failed: ${reasonOf(cause)}` }),
  })

/**
 * The subprocess's pipes, as the Web streams the SDK's ndjson framing takes.
 *
 * Built by hand rather than with `stream.Web` helpers: this runs under Bun's
 * Node compatibility, and the two adapters differ in when they close and how
 * they surface a broken pipe. Twenty lines with the lifecycle written out beats
 * a helper whose behaviour we would be assuming.
 */
const streamOver = (child: ChildProcess) => {
  const stdout = child.stdout
  const stdin = child.stdin
  if (stdout === null || stdin === null) {
    throw new Error("the agent was spawned without pipes")
  }

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      // Both ends of the pipe close the same way, and a process exiting can
      // deliver `end` AND `error` — so closing twice has to be harmless.
      const close = () => {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      stdout.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stdout.on("end", close)
      stdout.on("error", close)
    },
  })

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        stdin.write(chunk, (cause) => (cause == null ? resolve() : reject(cause)))
      })
    },
    close() {
      stdin.end()
    },
    abort() {
      stdin.destroy()
    },
  })

  return ndJsonStream(writable, readable)
}

// ── reading the payloads ───────────────────────────────────────────────

const textOf = (content: ContentBlock): string =>
  content.type === "text" ? content.text : ""

/**
 * What a running call has to say for itself, out of the protocol's content
 * blocks.
 *
 * A tool call is not instantaneous, and until this was read an unfolded one
 * showed its arguments and then nothing at all until it completed — a grep over
 * a large tree, a long shell command, a file being written line by line, all
 * indistinguishable from a call that had hung.
 *
 * The protocol's three block kinds are read for the one thing a transcript row
 * can show: text. `content` is prose or an embedded resource, `diff` is a file
 * being rewritten and is named rather than rendered — a unified diff in a
 * folded frame is a page of text where a line was wanted, and the outline
 * itself is where an olai edit shows up anyway — and `terminal` is an id whose
 * output arrives over a separate member this client does not open.
 *
 * REPLACES rather than appends, which is the protocol's own rule for an update:
 * a report carries the call's content as it stands now, so accumulating them
 * would print the first half of the output twice.
 */
const progressOf = (
  content: ReadonlyArray<ToolCallContent> | null | undefined,
): string | undefined => {
  if (content == null || content.length === 0) return undefined
  const lines = content
    .map((block) =>
      block.type === "content"
        ? textOf(block.content)
        : block.type === "diff"
        ? `— ${block.path}`
        : ""
    )
    .filter((line) => line !== "")
  return lines.length === 0 ? undefined : lines.join("\n")
}

/** Where the call is working. `path:line` when the agent said which line, and
 *  the path alone when it did not — a `:0` invented for the second case would
 *  be a claim about a file nobody made. */
const locationsOf = (
  locations: ReadonlyArray<ToolCallLocation> | null | undefined,
): ReadonlyArray<string> | undefined => {
  if (locations == null || locations.length === 0) return undefined
  return locations.map((at) =>
    typeof at.line === "number" ? `${at.path}:${at.line}` : at.path
  )
}

/** A tool call's arguments and result, as one folded block. JSON rather than
 *  prose: it is detail somebody opens deliberately, and the shape is the
 *  agent's own. */
const detailOf = (input: unknown, output: unknown): string | undefined => {
  const parts: Array<string> = []
  if (input !== undefined && input !== null) parts.push(JSON.stringify(input, null, 2))
  if (output !== undefined && output !== null) parts.push(JSON.stringify(output, null, 2))
  return parts.length === 0 ? undefined : parts.join("\n\n")
}

/** The picker as value → label ("claude-fable" → "Fable"), which is what the
 *  agent calls its own models. A value it does not offer is absent here, and
 *  the caller keeps the raw id: truthful, where a nearest match is invented.
 *
 *  The picker is a flat list of options or a list of GROUPS of them, and the
 *  protocol tells the two apart by shape rather than by a tag. */
const labelsOf = (
  entry: Extract<SessionConfigOption, { type: "select" }>,
): ReadonlyMap<string, string> => {
  const labels = new Map<string, string>()
  for (const item of entry.options) {
    if ("value" in item) {
      labels.set(item.value, item.name)
      continue
    }
    for (const option of item.options) labels.set(option.value, option.name)
  }
  return labels
}

/**
 * The model a turn is actually running on, out of the CLI message the adapter
 * forwarded.
 *
 * ONE field of one message kind is read. Everything else `init` carries — the
 * tool list, the MCP servers, the permission mode, the slash commands, the CLI
 * version — is learned from the protocol proper or not at all, because a panel
 * that believed a wrapped CLI's private message about any of it would be
 * reading around the protocol it speaks.
 */
const liveModelIn = (params: unknown): string | null => {
  const message = (params as { readonly message?: unknown } | null)?.message
  if (typeof message !== "object" || message === null) return null
  const shape = message as {
    readonly type?: unknown
    readonly subtype?: unknown
    readonly model?: unknown
  }
  if (shape.type !== "system" || shape.subtype !== "init") return null
  return typeof shape.model === "string" && shape.model !== "" ? shape.model : null
}

/** Two paths naming the same directory. An agent stores the spelling it was
 *  handed, which may or may not carry a trailing slash. */
const sameDirectory = (a: string, b: string): boolean =>
  a.replace(/\/+$/, "") === b.replace(/\/+$/, "")

/** Olai's tool server as ACP's `mcpServers` entry. The one place the protocol's
 *  shape for this is spelled. */
const mcpServersOf = (server: ToolServer | null): ReadonlyArray<McpServer> =>
  server === null ? [] : [{
    type: "http",
    name: server.name,
    url: server.url,
    headers: [{ name: "Authorization", value: `Bearer ${server.token}` }],
  }]

