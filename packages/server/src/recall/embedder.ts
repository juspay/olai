/**
 * The embedder seam — how text becomes a vector, and how one is FOUND.
 *
 * Everything semantic in olai hangs off this one interface, and the interface
 * is deliberately all there is: the index ({@link ./recall.ts}) neither knows
 * nor cares where a vector came from. That is the seam the design demands
 * twice over — a second embedder slots in later as another `detect` without
 * the index changing, and every test drives a deterministic fake through it,
 * because a test that needs a live model is a test that does not run.
 *
 * WHAT IS FOUND, AND WHY IT IS A PATH RATHER THAN A PROBE. The first version
 * of this file probed the network for a running Ollama, and that is exactly
 * what got the feature parked (PR #149): olai requires NO dependency outside
 * Nix itself (HACKING.md), and a model server the user is expected to have
 * installed is such a dependency. So nothing is probed. The nix wrapper bakes
 * two store paths into the binary's environment — `OLAI_EMBED_SERVER`, a
 * `llama-server` from `pkgs.llama-cpp`, and `OLAI_EMBED_MODEL`, a GGUF
 * fixed-output derivation — the same way it already bakes `OLAI_ACP_AGENT`
 * (default.nix, nix/embed.nix). Either one unset or empty answers `null`, and
 * `null` is the ORDINARY outcome for a `bun` run straight out of a source
 * checkout: substring search, one debug log line, and nothing anywhere that
 * calls a missing feature an error.
 *
 * OLAI OWNS THE PROCESS. This build of llama.cpp ships no batch embedding
 * binary (`llama --help` lists `serve` and `cli`), so embedding is an HTTP
 * call and the server is olai's own child: spawned LAZILY on the first text
 * that needs embedding, listening on a UNIX SOCKET in the runtime dir — no
 * port to collide on and nothing the network can reach — and killed when the
 * scope that opened it closes. It is declared in docs/running.md. That is the
 * deliberate inverse of the incident this feature carries, where a lane
 * started an `ollama serve` by hand and did not say so.
 *
 * The model is `bge-small-en-v1.5`, which wants an instruction on the QUERY
 * side and nothing on the document side — the whole reason {@link EmbedKind}
 * exists. A query and a document are embedded into the same space from two
 * different sides, and an embedder that ignored that would quietly cost recall
 * quality with nothing anywhere saying why.
 */

import { Data, Effect, FileSystem, Path, Scope } from "effect"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"

/** Which side of a retrieval a text is on. Models trained with task prefixes
 *  embed the two differently INTO THE SAME SPACE; models that were not simply
 *  ignore the distinction. */
export type EmbedKind = "query" | "document"

/** An embedder could not answer — the server died, the call timed out, the
 *  reply did not parse. Never surfaced to a user: recall degrades to nothing
 *  and the owner of the call logs it (once). */
export class EmbedFailure extends Data.TaggedError("EmbedFailure")<{
  readonly reason: string
}> {
  override get message(): string {
    return this.reason
  }
}

export interface Embedder {
  /**
   * Names the model, and thereby the VECTOR SPACE. Stamped into the index
   * cache so vectors from one model are never compared against another's —
   * a cache whose embedder id differs is discarded whole, not migrated.
   */
  readonly id: string
  /**
   * The cosine similarity below which a neighbour is noise rather than a
   * paraphrase.
   *
   * HERE and not in {@link ./recall.ts}, which is where it began, because a
   * floor is a fact about a VECTOR SPACE and this is the only thing that knows
   * which one is in use. Models do not share a scale: bge-small's is
   * compressed (unrelated notes reach 0.60 against this repo's own corpus)
   * where nomic's is not, so an index holding one number would be quietly
   * wrong about the second embedder anybody puts behind the seam — a
   * guarantee made by a layer that cannot see enough to make it.
   */
  readonly floor: number
  /** All texts in one call, in order. Vectors come back unnormalised; the
   *  index owns the geometry ({@link ./recall.ts}). */
  readonly embed: (
    kind: EmbedKind,
    texts: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<Float32Array>, EmbedFailure>
}

/** The two variables the nix wrapper bakes into, named rather than spelled at
 *  each use — the shape `clientDist.ts` and `allowedOrigins.ts` already give
 *  an env var olai reads, so a message and a test can name the symbol. */
export const SERVER_ENV_VAR = "OLAI_EMBED_SERVER"
export const MODEL_ENV_VAR = "OLAI_EMBED_MODEL"

/** Both paths or neither, PARSED at the boundary rather than checked twice
 *  downstream: they are one fact — where the embedder is — and half of it is
 *  not a state anything below here should be able to hold. Read here rather
 *  than in `recall.ts` so the environment is one file's business. */
const pathsFromEnv = (): { server: string; model: string } | null => {
  const server = process.env[SERVER_ENV_VAR]
  const model = process.env[MODEL_ENV_VAR]
  if (server === undefined || server === "") return null
  if (model === undefined || model === "") return null
  return { server, model }
}

/**
 * bge-small-en-v1.5's similarity floor, MEASURED rather than guessed.
 *
 * Against this repo's own roadmap, four deliberately off-topic queries (a
 * bread recipe, the treaty of Westphalia, changing a tyre, APAC revenue) drew
 * a best score of 0.599, while real rank-one hits scored 0.685-0.724. So it
 * sits above every junk ceiling observed and below every genuine top hit —
 * and biased conservative on purpose: semantic hits only fill the room
 * substring leaves, so dropping a weak true positive costs a row nobody was
 * owed, while keeping a strong false positive costs the reader's trust in the
 * `≈`. The caveat, stated rather than buried: it is tuned on one corpus
 * (docs/brainstorming/semantic-recall.md).
 */
const BGE_FLOOR = 0.62

/** BGE's query-side instruction, applied by MODEL rather than
 *  unconditionally: putting a prefix in front of a model that never saw one
 *  puts the prefix into the meaning. */
const BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

const prefixed = (model: string, kind: EmbedKind, text: string): string =>
  kind === "query" && /bge-/i.test(model) ? `${BGE_QUERY_PREFIX}${text}` : text

/** How long the server has to come up before the first embed gives up. It is
 *  a model load from a warm page cache (measured: 68–98 ms) or a cold one
 *  (~490 ms); this covers a badly contended machine and nothing more. */
const START_TIMEOUT_MS = 30_000

/** How long one embed call may take. Generous, because a batch of long notes
 *  is real work; a caller with a tighter budget (the query path) puts its own
 *  timeout in front. */
const EMBED_TIMEOUT_MS = 120_000

/** How many texts the server is asked about at once. Matched to the index's
 *  own batch so a batch is one request. */
const CONTEXT = 8192

/** How long the child has to take a SIGTERM before it gets a SIGKILL. Short:
 *  the server holds nothing worth saving — the index it feeds is derived and
 *  already written. */
const STOP_GRACE_MS = 2_000

/**
 * Where the socket goes. A unix socket path is capped at ~104 bytes by the
 * kernel, which is short enough to matter — so it is the RUNTIME dir (or
 * `/tmp`) plus a 16-hex digest, never a path derived from the served
 * directory's name.
 */
const socketDir = (): string => process.env["XDG_RUNTIME_DIR"] ?? tmpdir()

const socketPath = (root: string): string => {
  const key = createHash("sha256").update(`${root}:${process.pid}`).digest("hex")
    .slice(0, 16)
  return `${socketDir()}/olai-embed-${key}.sock`
}

/** The socket's neighbour: who owns the server listening on it. Two pids —
 *  the olai that started it, and the server itself — because reaping needs
 *  both questions answered ({@link sweepOrphans}). */
const ownerPath = (socket: string): string => `${socket}.owner`

/** Is this process still around? `signal 0` is the POSIX ask-don't-tell. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Does something still answer on this socket? */
const answering = async (socket: string): Promise<boolean> => {
  try {
    const reply = await fetch("http://localhost/health", {
      unix: socket,
      signal: AbortSignal.timeout(500),
    } as RequestInit)
    return reply.ok
  } catch {
    return false
  }
}

/**
 * Kill the model servers whose olai is gone, and clear up after them.
 *
 * The ordinary shutdowns are clean — the child is a scope finalizer, so
 * closing the serve (Ctrl-C, SIGTERM, a scope that ends) takes it with it.
 * `SIGKILL` is the one that cannot be: no finalizer runs, and llama.cpp has no
 * notion of a parent to die with. A 66 MB model server surviving its olai is
 * exactly the shape of the incident this feature carries, so it is swept
 * rather than left for somebody to find in `ps`.
 *
 * Run at START rather than by a watchdog, which is where the bound comes from:
 * an orphan lives until the next `olai` serves anything, and never
 * accumulates. Two guards against killing a stranger that inherited a reused
 * pid: the socket must still ANSWER (so something really is listening on the
 * path this pid was recorded against), and the olai that recorded it must be
 * GONE (so a sibling serve is never disturbed).
 */
export const sweepOrphans = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const dir = socketDir()
    const names = yield* Effect.orElseSucceed(
      fs.readDirectory(dir),
      () => [] as ReadonlyArray<string>,
    )
    for (const name of names) {
      if (!name.startsWith("olai-embed-") || !name.endsWith(".sock.owner")) {
        continue
      }
      const owner = path.join(dir, name)
      const socket = owner.slice(0, -".owner".length)
      const read = yield* Effect.orElseSucceed(
        fs.readFileString(owner),
        () => "",
      )
      const [byPid, serverPid] = read.trim().split("\n").map(Number)
      if (byPid === undefined || serverPid === undefined) continue
      if (alive(byPid)) continue
      // Only ask the socket when there IS one: a leftover whose socket file is
      // already gone has nothing listening by construction, and a probe with a
      // timeout in front of it is the wrong way to learn that.
      const there = yield* Effect.orElseSucceed(fs.exists(socket), () => false)
      if (there && (yield* Effect.promise(() => answering(socket)))) {
        yield* Effect.logInfo(
          `recall: reaping an embedder (pid ${serverPid}) left behind by olai ` +
            `pid ${byPid}`,
        )
        yield* Effect.sync(() => {
          try {
            process.kill(serverPid, "SIGTERM")
          } catch {
            // Gone between the two questions. Nothing to do and nothing to say.
          }
        })
      }
      yield* Effect.ignore(fs.remove(socket))
      yield* Effect.ignore(fs.remove(owner))
    }
  })

/**
 * Find the embedder the closure carries, or `null`.
 *
 * `null` and not a failure: a tree run without the nix wrapper has no baked
 * paths, and that is an ordinary way to run olai rather than a fault. Nothing
 * is spawned here — the process starts on the first text that actually needs
 * embedding, so a serve whose cache is already warm and whose reader never
 * searches by meaning pays nothing at all.
 */
export const detectPackaged = (
  root: string,
): Effect.Effect<Embedder | null, never, Scope.Scope | FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const paths = pathsFromEnv()
    if (paths === null) {
      yield* Effect.logDebug(
        "recall: no embedder in this build's environment " +
          `(${SERVER_ENV_VAR} / ${MODEL_ENV_VAR}); semantic search off`,
      )
      return null
    }
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    for (const [name, file] of [
      [SERVER_ENV_VAR, paths.server],
      [MODEL_ENV_VAR, paths.model],
    ] as const) {
      // A stat that fails is a path that is not usable, which is the same
      // answer as a path that is not there.
      const there = yield* Effect.orElseSucceed(fs.exists(file), () => false)
      if (!there) {
        // Baked but missing is NOT the ordinary case — somebody pointed the
        // variable at something that is not there — so it is said out loud
        // once, and then treated like every other absence.
        yield* Effect.logWarning(
          `recall: ${name} points at ${file}, which does not exist; ` +
            `semantic search stays off`,
        )
        return null
      }
    }
    // Anything a `kill -9` left behind, swept at BOOT rather than at the first
    // embed. The spawn is lazy on purpose, and a sweep hung off it would be
    // lazy too — a serve whose cache is already warm never embeds anything,
    // and would walk past an orphan without looking at it.
    yield* sweepOrphans(fs, path)
    return yield* packagedEmbedder(
      paths.server,
      paths.model,
      socketPath(root),
      fs,
      path,
    )
  })

/**
 * The embedder over a `llama-server` this process owns.
 *
 * Split from the detection above so a test of the CALL shape needs no
 * environment, and scoped so the child dies with the serve: the finalizer is
 * registered when the process starts, not when this function returns, because
 * a serve that never embeds never has a child to kill.
 */
const packagedEmbedder = (
  server: string,
  model: string,
  socket: string,
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<Embedder, never, Scope.Scope> =>
  Effect.gen(function*() {
    // The serve's own scope, captured HERE and handed to the start below — so
    // the child is a finalizer of the serve even though it is spawned much
    // later, on some keystroke's fiber. Without this the process would belong
    // to whichever request happened to start it and die when that request did.
    const scope = yield* Effect.scope
    // ONE start, however many callers race for the first embed: `cached`
    // memoises the effect, so the second caller waits on the first's process
    // rather than spawning a second server over the same socket.
    const started = yield* Effect.cached(
      Effect.provideService(
        start(server, model, socket, fs, path),
        Scope.Scope,
        scope,
      ),
    )

    const embed: Embedder["embed"] = (kind, texts) =>
      Effect.flatMap(started, () =>
        Effect.tryPromise({
          try: async () => {
            const reply = await fetch("http://localhost/v1/embeddings", {
              // Bun's own extension: the request goes over the unix socket and
              // the URL's host is never resolved.
              unix: socket,
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                input: texts.map((text) => prefixed(model, kind, text)),
              }),
              signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
            } as RequestInit)
            if (!reply.ok) {
              throw new Error(`POST /v1/embeddings: ${reply.status}`)
            }
            const body = (await reply.json()) as {
              readonly data?: ReadonlyArray<{ readonly embedding?: ReadonlyArray<number> }>
            }
            const rows = body.data ?? []
            if (rows.length !== texts.length) {
              throw new Error(
                `asked for ${texts.length} embeddings, got ${rows.length}`,
              )
            }
            return rows.map((row) => Float32Array.from(row.embedding ?? []))
          },
          catch: (cause) => new EmbedFailure({ reason: String(cause) }),
        })).pipe(
          // A start that failed is an embed that failed: same empty answer,
          // same one log line, said by the index.
          Effect.catchTag("StartFailure", (failure) =>
            new EmbedFailure({ reason: failure.reason })),
        )

    return { id: idOf(model), floor: BGE_FLOOR, embed }
  })

/** The vector space's name: the model file, plus a digest of its path. Two
 *  different store paths are two different models as far as a cache is
 *  concerned, even when their basenames agree. */
const idOf = (model: string): string => {
  const name = model.split("/").pop() ?? model
  return `llama-cpp/${name}#${
    createHash("sha256").update(model).digest("hex").slice(0, 8)
  }`
}

class StartFailure extends Data.TaggedError("StartFailure")<{
  readonly reason: string
}> {}

/**
 * Spawn the server and wait for it to answer `/health`. Registers the kill as
 * a scope finalizer BEFORE waiting, so a start that times out still leaves no
 * orphan behind.
 */
const start = (
  server: string,
  model: string,
  socket: string,
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<void, StartFailure, Scope.Scope> =>
  Effect.gen(function*() {
    yield* Effect.ignore(fs.makeDirectory(path.dirname(socket), { recursive: true }))
    // A socket left behind by a serve that was killed rather than closed: the
    // bind below would fail on it, and there is nothing to salvage.
    yield* Effect.ignore(fs.remove(socket))

    const child = spawn(server, [
      "--model",
      model,
      "--embedding",
      "--host",
      socket,
      // The whole context as one number: the index batches, and a batch of
      // long notes needs room for all of them at once.
      "--ctx-size",
      String(CONTEXT),
      "--ubatch-size",
      "512",
      // Nothing here reads llama.cpp's own logs; the index says what happened.
      "--log-disable",
    ], { stdio: ["ignore", "ignore", "pipe"] })

    // The child's stderr is drained rather than inherited: an unread pipe
    // fills and blocks the server, and llama.cpp's boot chatter is not olai's
    // to print. The last of it is kept so a start failure can quote it.
    let tail = ""
    child.stderr?.on("data", (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-2_000)
    })
    child.on("error", () => {})

    // Who to reap, and who is allowed to. Written BEFORE the wait, so a start
    // that times out is still recorded — an orphan nobody knows about is the
    // one this file exists to prevent.
    if (child.pid !== undefined) {
      yield* Effect.ignore(
        fs.writeFileString(ownerPath(socket), `${process.pid}\n${child.pid}\n`),
      )
    }

    yield* Effect.addFinalizer(() =>
      // Asked politely, then made to. A model server mid-batch does not always
      // notice a SIGTERM promptly, and a shutdown that returned while its child
      // was still deciding is how the process ends up reparented to init —
      // which is the exact thing this file refuses to leave behind.
      Effect.promise(async () => {
        child.kill("SIGTERM")
        const deadline = Date.now() + STOP_GRACE_MS
        while (child.exitCode === null && child.signalCode === null) {
          if (Date.now() > deadline) {
            child.kill("SIGKILL")
            break
          }
          await new Promise((resume) => setTimeout(resume, 20))
        }
      }).pipe(
        Effect.andThen(Effect.ignore(fs.remove(socket))),
        Effect.andThen(Effect.ignore(fs.remove(ownerPath(socket)))),
      )
    )

    const healthy = yield* Effect.result(
      Effect.tryPromise({
        try: async () => {
          const deadline = Date.now() + START_TIMEOUT_MS
          for (;;) {
            if (child.exitCode !== null) {
              throw new Error(
                `llama-server exited with ${child.exitCode}: ${tail.trim()}`,
              )
            }
            try {
              const reply = await fetch("http://localhost/health", {
                unix: socket,
                signal: AbortSignal.timeout(1_000),
              } as RequestInit)
              if (reply.ok) return
            } catch {
              // Not up yet. The deadline below is what ends this.
            }
            if (Date.now() > deadline) {
              throw new Error(
                `llama-server did not answer /health within ${
                  START_TIMEOUT_MS / 1_000
                }s: ${tail.trim()}`,
              )
            }
            await new Promise((resume) => setTimeout(resume, 25))
          }
        },
        catch: (cause) => new StartFailure({ reason: String(cause) }),
      }),
    )
    if (healthy._tag === "Failure") return yield* healthy.failure
    yield* Effect.logInfo(`recall: embedder up on ${socket}`)
  })
