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
 *   - **the questions the agent asks a person**, both kinds. An
 *     `elicitation/create` is a form; a `session/request_permission` that is not
 *     one of ours is a single-select. What is HERE is that both are the same
 *     question and which methods carry them; the payload shapes are
 *     {@link ./asks.ts} and the promise-per-question state machine is
 *     {@link ./questions.ts}, so neither is one more thing this file's closure
 *     has to get right at the same time as a subprocess.
 *   - **which permission requests are answered without asking.** Bypass mode is
 *     the design (resolved 2026-08-09), so a call to one of the MCP servers WE
 *     handed this session — olai's mediated ops, kolu's terminals — is allowed
 *     immediately, and everything else is a person's to answer. What is HERE is
 *     that the two paths exist and which one a request took; the rule that
 *     tells them apart is {@link ./interpret.ts}, where it is a pure function
 *     with unit tests rather than a branch inside a subprocess's callback.
 *   - **reading the payloads**: which update kind this is, what a content block
 *     says, how a session list sorts. An event carries what was READ, never the
 *     raw protocol value. What any of it means to the CLAUDE CODE adapter in
 *     particular — its `_meta`, its tool naming, the message it forwards, which
 *     config option its picker is — is {@link ./interpret.ts}; what is still
 *     here is what those readings are REMEMBERED as, which is a session's job.
 *
 * The MCP servers a session is given are olai's own internal one — the standard
 * ACP shape, and the only channel the agent has to the ops layer — plus, when
 * this host is running kolu, kolu's terminals ({@link ./kolu.ts}), detected per
 * session rather than at boot. A detection that FAILED is an event like any
 * other (`servers`), so a conversation short of its tools is something the
 * panel can say rather than something a log knew.
 *
 * `fs` capabilities are FALSE in both directions on purpose: this is not an
 * editor, and an agent that could write a file whole would be routing around
 * the format. `elicitation.form` is TRUE, and it is
 * what makes any of the above happen at all: without it the Claude Code adapter
 * puts `AskUserQuestion` in `disallowedTools`, so the agent cannot ask a
 * structured question — it has to guess, or write the question into prose and
 * hope.
 */

import { type ChildProcess, spawn } from "node:child_process"

import {
  client as acpClient,
  type ClientConnection,
  methods,
} from "@agentclientprotocol/sdk"
import type {
  ContentBlock,
  CreateElicitationRequest,
  CreateElicitationResponse,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  McpServer,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
  SessionNotification,
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
} from "@agentclientprotocol/sdk"
import { UsageFailure } from "@olai/format"
import { emitter, reasonOf } from "@olai/log"
import type { AskAnswer } from "@olai/surface"
import { Data, type Duration, Effect, Semaphore } from "effect"

import { type Form, formOf, PERMISSION_FIELD, permissionFormOf } from "./asks.ts"
import { diffsOf, relativeTo } from "./diffs.ts"
import type { AgentEvent, Command, Stored } from "./events.ts"
import {
  allowedWithoutAsking,
  BYPASS_MODE,
  liveModelIn,
  modelPickerIn,
  NEW_SESSION_META,
  SDK_MESSAGE,
  toolNameIn,
} from "./interpret.ts"
import * as Kolu from "./kolu.ts"
import { streamOver, unstartable } from "./pipes.ts"
import * as Questions from "./questions.ts"
import { wroteIn } from "./wrote.ts"

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
  /** Stop the turn in flight.
   *
   *  A notification, so there is nothing to WAIT for — but there is very much
   *  something that can fail: the pipe to a dead agent takes no notification
   *  either. That failure used to be swallowed, and what a person saw was the
   *  cancel button doing nothing while the turn went on streaming. It is on the
   *  channel now, so a cancel that could not be delivered refuses like every
   *  other verb. */
  readonly cancel: Effect.Effect<void, AgentGone>
  readonly newSession: Effect.Effect<void, AgentGone>
  readonly loadSession: (id: string) => Effect.Effect<void, AgentGone>
  /** The stored conversations for this directory, newest first. */
  readonly sessions: Effect.Effect<ReadonlyArray<Stored>, AgentGone>
  /**
   * Answer a question the agent asked, or — with `null` — decline it.
   *
   * Answers `false` when that question is no longer waiting: it was withdrawn,
   * or a second tab got there first. Two tabs watching one conversation is the
   * ordinary case here, so "somebody else already answered" is a state to
   * report rather than a fault, and the caller turns it into a refusal a person
   * reads.
   *
   * FAILS when the answers do not fit the question — a number field given a
   * word, a required field left empty, a key nothing asked for. The question
   * stays waiting in that case, which is the whole reason the check is here
   * rather than at the point the answer goes on the wire: settling the row and
   * then sending something else would leave a transcript claiming an answer the
   * agent never got.
   */
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer> | null,
  ) => Effect.Effect<boolean, UsageFailure>
  readonly stop: Effect.Effect<void>
}

/** The ACP major version this client speaks. */
const PROTOCOL = 1

/** A cancel that could not be delivered, said the same way on both of its
 *  paths — the refusal a caller gets, and the `trouble` the deferred one
 *  reports through. Two literals that have to match for the panel to read
 *  consistently is one literal. */
const notCancelled = (why: string): string => `the turn could not be cancelled: ${why}`

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

    /** The questions on the wire right now ({@link ./questions.ts}), told to
     *  report every ending down the same channel everything else uses. */
    const questions = Questions.make((id, outcome) => {
      emit({ _tag: "askSettled", id, outcome })
    })

    /**
     * The MCP servers this conversation was handed, by name.
     *
     * Read by the permission handler and by nothing else: a call to one of
     * these is a call to a tool olai chose to expose — the mediated ops, kolu's
     * terminals — and those are the ones bypass mode is for. Refilled whenever
     * a session is opened, because the set is decided per conversation (a padi
     * started after olai shows up in the next one).
     */
    let given: ReadonlyArray<string> = []

    /**
     * What tool each call id is, out of the `tool_call` frames.
     *
     * The permission request carries a DISPLAY title, not a name — for a plan
     * exit it reads "Ready to code?" — but the adapter guarantees the tool call
     * it references has already been announced, and that announcement carries
     * the programmatic name in its `_meta`. So the name is remembered as the
     * frames go past, and the permission handler looks it up. A miss is a name
     * we do not know, which is answered by ASKING; nothing here guesses.
     *
     * Emptied with the conversation ({@link leaving}), because a call id is only
     * ever looked up inside the session that minted it — otherwise this would be
     * every tool call the process had ever seen, kept for the life of a server
     * that is meant to run for weeks.
     */
    const toolNames = new Map<string, string>()

    /** The conversation is over — replaced, reloaded, or dead. Everything keyed
     *  to it goes: the questions nobody is going to answer now, and the tool
     *  names they were keyed alongside. One function, because "this session is
     *  finished" is one fact and four call sites remembering two things each is
     *  how one of them ends up remembering one. */
    const leaving = (): void => {
      questions.withdrawAll()
      toolNames.clear()
    }

    /** Put a form in front of a person and wait for it — the registry holds the
     *  promise, and this is the one place the row it draws is announced. */
    const put = (form: Form, signal: AbortSignal): Promise<Questions.Settled> =>
      questions.ask(form, signal, (id) => {
        emit({ _tag: "asked", id, message: form.message, fields: form.fields })
      })

    /** A question we cannot draw. Declined on the wire and SAID out loud: an
     *  agent that got an empty answer and a person who never saw the question
     *  is the one shape of this failure nobody could debug. */
    const undrawable = (why: string): void => {
      trouble(`the agent asked something this panel cannot draw — ${why}`)
    }

    const onElicitation = async (
      params: CreateElicitationRequest,
      signal: AbortSignal,
    ): Promise<CreateElicitationResponse> => {
      const form = formOf(params)
      if (form instanceof UsageFailure) {
        undrawable(form.reason)
        return { action: "decline" }
      }
      const settled = await put(form, signal)
      // A dismissal is a DECLINE and a withdrawal is a CANCEL, and the adapter
      // reads them differently: decline tells the model the person skipped and
      // lets the turn go on, cancel aborts the tool use. Saying "cancel" for a
      // dismissal would end a turn somebody meant to continue.
      if (settled.outcome.how === "declined") return { action: "decline" }
      if (settled.outcome.how === "withdrawn") return { action: "cancel" }
      // Already typed against the schema that asked for it — `answer` refuses
      // anything that does not fit rather than settling the row and quietly
      // sending something else.
      return { action: "accept", content: settled.content }
    }

    /** Which tool a permission request is about, or `null` when nothing said.
     *  The request's own `_meta` carries the name for a subagent's call; every
     *  other call was announced first, and the announcement did. */
    const toolOf = (request: RequestPermissionRequest): string | null =>
      toolNameIn(request.toolCall._meta) ??
        toolNames.get(request.toolCall.toolCallId) ??
        null

    const onPermission = async (
      params: RequestPermissionRequest,
      signal: AbortSignal,
    ): Promise<RequestPermissionResponse> => {
      // The tools olai handed this conversation are answered here and now —
      // already mediated, already validated — and everything else is put in
      // front of a person. Which is which is `allowedWithoutAsking`, and it is
      // there rather than here because it is the rule that stops this panel
      // approving its own permissions.
      const allowed = allowedWithoutAsking(toolOf(params), given, params.options)
      if (allowed !== null) {
        return { outcome: { outcome: "selected", optionId: allowed } }
      }
      const settled = await put(permissionFormOf(params), signal)
      const picked = settled.content[PERMISSION_FIELD]
      // Dismissed, withdrawn, or — impossible, since the field is required, but
      // said in one place rather than assumed in two — nothing chosen. All
      // three are `cancelled`, which is the protocol's "nobody decided".
      return typeof picked !== "string"
        ? { outcome: { outcome: "cancelled" } }
        : { outcome: { outcome: "selected", optionId: picked } }
    }

    const remember = (
      toolCallId: string,
      meta: { readonly [key: string]: unknown } | null | undefined,
    ): void => {
      const name = toolNameIn(meta)
      if (name !== null) toolNames.set(toolCallId, name)
    }

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
          // Not drawn, and not an event: the NAME of the tool is what the
          // permission handler needs and the permission request does not
          // carry — see `toolNames`.
          remember(update.toolCallId, update._meta)
          emit({
            _tag: "tool",
            id: update.toolCallId,
            title: update.title ?? undefined,
            status: (update.status ?? undefined) as ToolCallStatus | undefined,
            detail: detailOf(update.rawInput, update.rawOutput),
            progress: progressOf(update.content),
            // The two vocabularies for what a call CHANGED, and a call is at
            // most one of them: a direct file edit sends diff blocks, and a
            // write through the ops layer answers with a reply olai wrote
            // itself. Both are read structurally — `undefined` is "this report
            // said nothing about that", which is the protocol's own rule for
            // every other field here.
            diffs: diffsOf(update.content, options.cwd),
            wrote: wroteIn(update.rawOutput),
            locations: locationsOf(update.locations, options.cwd),
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
          //
          // Quietly is right HERE and not two cases up, and the difference is
          // worth naming since both look like "we dropped something". These
          // are whole update KINDS this panel has no view for — a feature it
          // does not have, the same way it has no view for a terminal — and a
          // marker for each would be a transcript of apologies. An
          // `agent_message_chunk` whose content this panel cannot draw is the
          // other thing entirely: the agent ANSWERED, in a row that is on
          // screen, and dropping it left that row blank. That one is marked
          // (`textOf`).
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
      const picker = modelPickerIn(configOptions)
      if (picker === null) return
      labels = picker.labels
      const current = picker.picked
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

    /** The agent's own file would not run, said once for the two doors that
     *  report it — a malformed spawn call, and the `error` event an exec
     *  failure actually arrives on. It names the COMMAND, because the whole
     *  value of this reason over the broken pipe that follows it is that a
     *  person can see what they set. */
    const notStarted = (why: string): AgentGone =>
      new AgentGone({ why: `could not start the agent \`${options.command}\`: ${why}` })

    const start = (): Effect.Effect<Live, AgentGone> =>
      Effect.gen(function*() {
        const child = yield* Effect.try({
          try: () =>
            spawn(options.command, [...options.args], {
              cwd: options.cwd,
              stdio: ["pipe", "pipe", "pipe"],
            }),
          catch: (cause) => notStarted(reasonOf(cause)),
        })

        /**
         * The same refusal, arriving the way it actually arrives.
         *
         * `OLAI_ACP_AGENT` is a path a PERSON sets, which makes it the likeliest
         * thing here to be wrong — and an exec that fails does so after `spawn`
         * has returned, so the `catch` above has never once seen one. What
         * happened instead was both halves of {@link ../pipes.ts}'s argument at
         * their worst: an uncaught `error` event dumped a stack trace on olai's
         * stderr, and the refusal a person got was ``initialize` failed: Cannot
         * call write after a stream was destroyed` — our end of a dead pipe,
         * where the sentence they needed was the name of the file that is not
         * there.
         *
         * Raced against the handshake rather than checked after it, so which
         * reason wins is not a question about the order two failures happen in.
         *
         * SUBSCRIBED HERE, on the line after the spawn, rather than when the
         * race runs — `Effect.promise` does not call its thunk until the fiber
         * reaches it, and between here and there sit the stderr wiring, the
         * exit handler and `connect`. The exec `error` lands a millisecond or
         * so after `spawn` returns, so that window has been winning; it does
         * not have to keep winning, and a listener attached too late is both an
         * uncaught exception and the destroyed-stream sentence coming back.
         * `kolu.ts` attaches on the line after its own spawn for the same
         * reason.
         */
        const started = unstartable(child)
        const failedToStart: Effect.Effect<never, AgentGone> = Effect.flatMap(
          Effect.promise(() => started),
          (why) => notStarted(why),
        )

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
          // Before anything else it emits: a form left live on a dead wire is a
          // control that does nothing, and pressing it is how a person finds
          // out.
          leaving()
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
          // asked for it (`NEW_SESSION_META`). Asking and then not listening is
          // what this used to do, which is why the header could name a model
          // the session had stopped running. Custom method, so the SDK wants a
          // parser: there is nothing to validate beyond "it is an object", and
          // `readLiveModel` reads one field out of it.
          .onNotification(
            SDK_MESSAGE,
            (params: unknown) => params,
            (context) => {
              readLiveModel(context.params)
            },
          )
          // Allowed without asking when it is one of the tools we handed this
          // session, and PUT IN FRONT OF A PERSON otherwise — the rule, and
          // what it used to cost to get it wrong, in `interpret.ts`.
          .onRequest(methods.client.session.requestPermission, (context) =>
            onPermission(context.params, context.signal))
          // The agent's own structured question, which is a thing it can only
          // ask because `initialize` said we can draw one.
          .onRequest(methods.client.elicitation.create, (context) =>
            onElicitation(context.params, context.signal))
          .connect(streamOver(child))

        const initialized = (yield* Effect.raceFirst(
          ask(
            connection,
            methods.agent.initialize,
            {
              protocolVersion: PROTOCOL,
              clientCapabilities: {
                // Not an editor: the agent reaches the outlines through the ops
                // tools or not at all.
                fs: { readTextFile: false, writeTextFile: false },
                // A form we can draw, and deliberately not a URL: `elicitation.url`
                // sends a person out of the panel to a page olai knows nothing
                // about, which is a different bargain and its own decision. An
                // empty object is how the protocol spells "yes" here.
                elicitation: { form: {} },
              },
              clientInfo: { name: "olai", version: "0.1.0" },
            },
          ),
          // A handshake against a process that never ran cannot win this, and
          // the point is which REASON is reported when it loses.
          failedToStart,
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

    /** The MCP servers this conversation gets: olai's own tool server, and
     *  kolu's terminals if this host is running kolu. Asked FRESH every time a
     *  session is opened rather than once at boot, so a padi started after olai
     *  is picked up by the next conversation instead of the next restart. */
    const servers = Effect.map(
      Kolu.detect,
      // ONE probe answers both halves. `serverOf` takes what a session is
      // handed, and `missingFrom` takes what a person is owed about the one it
      // was not — which used to be dropped here on the grounds that nothing
      // drew it. Something does now (`mcp-fail-visible`), and it reads the same
      // `Detected` rather than probing a second time: two probes could
      // disagree, and the one a session was opened on is the one that is true
      // about it.
      (found) => {
        const handing = mcpServersOf(options.tools(), Kolu.serverOf(found))
        // Remembered as they are handed over, because "the tools we gave this
        // conversation" is exactly the set the permission handler allows
        // without asking — and it is decided per conversation.
        given = handing.map((server) => server.name)
        const absent = Kolu.missingFrom(found)
        // Before the session, always — including when there is nothing to
        // report. An empty list is the news on a conversation that has just
        // been given what the last one lacked, and a panel only ever told about
        // failures would go on drawing a fixed one.
        emit({ _tag: "servers", missing: absent === null ? [] : [absent] })
        return handing
      },
    )

    const fresh = (at: Live): Effect.Effect<void, AgentGone> =>
      Effect.gen(function*() {
        const made = (yield* ask(at.connection, methods.agent.session.new, {
          cwd: options.cwd,
          mcpServers: [...(yield* servers)],
          _meta: NEW_SESSION_META,
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
        // Before the flag below, because a detection is not a replay.
        const mcpServers = [...(yield* servers)]
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
            { sessionId: id, cwd: options.cwd, mcpServers },
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

    /**
     * Ask for the permission mode that makes the backstop above unnecessary.
     *
     * A refusal is normal — running as root, an agent that has no such mode —
     * and is not a boot failure. Ignored rather than reported, and that is a
     * trade with its own reason rather than a swallow: NOTHING IS LOST when
     * this is refused. The backstop it was trying to make unnecessary is still
     * there and still answers every permission request, so what a refusal
     * costs is one round trip per tool call, which is not a fact about a
     * person's outlines and has no honest place on their screen.
     */
    const askForBypass = (at: Live, id: string): Effect.Effect<void> =>
      Effect.ignore(
        ask(at.connection, methods.agent.session.setMode, {
          sessionId: id,
          modeId: BYPASS_MODE,
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
          //
          // FORKED because it has to outlive this line and cannot be waited on
          // — the prompt below is what holds the turn open — but a forked
          // failure is one nobody is watching, and this one used to go
          // nowhere at all: the deferred cancel never landed, the turn ran to
          // the end, and the panel said nothing about either. `trouble` is
          // where a failure with no caller belongs (the boot path uses it for
          // the same reason), so it reaches the transcript rather than the
          // fiber's dump.
          if (cancelPending) {
            cancelPending = false
            yield* Effect.forkDetach(
              Effect.onError(
                Effect.andThen(
                  Effect.sleep("10 millis"),
                  notify(at, methods.agent.session.cancel, { sessionId: id }),
                ),
                (cause) => Effect.sync(() => trouble(notCancelled(reasonOf(cause)))),
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
      // Said in the words of the thing that was asked for, not of the method
      // that carries it: what reaches a person is a refusal under the button
      // they pressed, and "`session/cancel` failed" names our transport where
      // their sentence is "the turn is still running".
      return Effect.mapError(
        notify(at, methods.agent.session.cancel, { sessionId: id }),
        (gone) => new AgentGone({ why: notCancelled(gone.why) }),
      )
    })

    const stop = Effect.sync(() => {
      stopped = true
      const at = live
      live = null
      session = null
      leaving()
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
          // BEFORE the break, so the question is settled on the row it is
          // drawn on rather than after that row has been cleared away.
          leaving()
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
            leaving()
            emit({ _tag: "sessionOver", why: "load" })
            yield* load(at, id, wanted?.title ?? null)
          })
        ),
      sessions: withLive(storedFor),
      answer: (id, answers) =>
        Effect.suspend(() => {
          const took = questions.answer(id, answers)
          if (took instanceof UsageFailure) return Effect.fail(took)
          return Effect.succeed(took === "settled")
        }),
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

// ── reading the payloads ───────────────────────────────────────────────

/**
 * What a content block says — and, when it is not prose, THAT IT WAS THERE.
 *
 * The panel draws text and nothing else, which is a fair thing for it to do and
 * was never a fair thing for it to do silently: a block this returned `""` for
 * was dropped by every caller, so an agent that answered with a picture, a
 * sound or an attached resource left a blank in the conversation where its
 * answer had been. A reader cannot tell that from an agent that said nothing,
 * and the two need entirely different things done about them.
 *
 * So a marker, in the shape the transcript already uses for its own asides
 * (`[image]`), naming what arrived and — where the protocol gives one — what it
 * was called. Rendering the picture itself is a bigger question that belongs
 * with the attachments the composer already sends; what is owed here is the
 * difference between "nothing" and "something this panel cannot draw".
 *
 * The `default` arm is not dead code: `ContentBlock` is somebody else's union
 * and it gains variants, so an unknown block is a marker rather than a hole.
 */
const textOf = (content: ContentBlock): string => {
  switch (content.type) {
    case "text":
      return content.text
    case "image":
      return "[image]"
    case "audio":
      return "[audio]"
    case "resource_link":
      return `[resource: ${content.name}]`
    case "resource":
      return `[resource: ${content.resource.uri}]`
    default:
      return "[unsupported content]"
  }
}

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
 * can show as a line: text. `content` is prose or an embedded resource, and
 * `terminal` is an id whose output arrives over a separate member this client
 * does not open.
 *
 * A `diff` is NOT read here any more, and that inversion is the whole of
 * `chat-edit-diffs`. It used to be flattened to the sentence `— <path>` on the
 * argument that a unified diff in a folded frame is a page of text where a line
 * was wanted, and that the outline itself is where an olai edit shows up
 * anyway. The second half is what stopped being true: a direct edit to a `.md`
 * or a source file shows up in NO outline, so naming the file was the whole of
 * what a person got and the answer to "what changed" was a terminal. It travels
 * structurally now ({@link ./diffs.ts}) and the panel draws it, trimmed —
 * naming it here as well would be the same file reported twice, once as a
 * change and once as a sentence about one.
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
    .map((block) => (block.type === "content" ? textOf(block.content) : ""))
    .filter((line) => line !== "")
  return lines.length === 0 ? undefined : lines.join("\n")
}

/** Where the call is working. `path:line` when the agent said which line, and
 *  the path alone when it did not — a `:0` invented for the second case would
 *  be a claim about a file nobody made.
 *
 *  Spelled root-relative by the same rule a diff's path is ({@link
 *  ./diffs.ts}), because these two land on ONE row: a follow-along location and
 *  the diff under it naming the same file in two different ways is the row
 *  disagreeing with itself. */
const locationsOf = (
  locations: ReadonlyArray<ToolCallLocation> | null | undefined,
  cwd: string,
): ReadonlyArray<string> | undefined => {
  if (locations == null || locations.length === 0) return undefined
  return locations.map((at) => {
    const path = relativeTo(cwd, at.path)
    return typeof at.line === "number" ? `${path}:${at.line}` : path
  })
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

/** Two paths naming the same directory. An agent stores the spelling it was
 *  handed, which may or may not carry a trailing slash. */
const sameDirectory = (a: string, b: string): boolean =>
  a.replace(/\/+$/, "") === b.replace(/\/+$/, "")

/** What a session is handed, as ACP's `mcpServers`. The one place the
 *  protocol's shape for either transport is spelled: olai's own tool server is
 *  http because it is a route on the listener this process already has, and
 *  kolu's is stdio because it is somebody else's program on this host. */
export const mcpServersOf = (
  server: ToolServer | null,
  kolu: Kolu.Server | null,
): ReadonlyArray<McpServer> => [
  ...server === null ? [] : [{
    type: "http" as const,
    name: server.name,
    url: server.url,
    headers: [{ name: "Authorization", value: `Bearer ${server.token}` }],
  }],
  ...kolu === null ? [] : [{
    name: kolu.name,
    command: kolu.command,
    args: [...kolu.args],
    env: Object.entries(kolu.env).map(([name, value]) => ({ name, value })),
  }],
]

