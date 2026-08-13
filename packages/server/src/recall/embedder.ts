/**
 * The embedder seam — how text becomes a vector, and how one is FOUND.
 *
 * Everything semantic in olai hangs off this one interface, and the interface
 * is deliberately all there is: the index ({@link ./recall.ts}) neither knows
 * nor cares whether a vector came from a local Ollama, a configured API, or a
 * test's deterministic fake. That is the seam the design demands twice over —
 * a configured API embedder slots in later as a second `detect` without the
 * index changing, and CI proves the semantic path against a fake because a
 * lane has no model to talk to (the kolu-ci-1 rule: a test that needs a live
 * model is a test that does not run).
 *
 * The one detection shipped is OLLAMA, local-first and key-free: a probe of
 * the conventional loopback port, honouring `OLLAMA_HOST` the way every
 * Ollama client does. Not finding one is the ORDINARY outcome — most machines
 * have no model server — so it answers `null` rather than failing, and the
 * only thing said about it is one boot-time log line. The absence of a
 * feature is not an error, and nothing in any UI reports it.
 *
 * The default model is `nomic-embed-text`: small enough to embed a corpus of
 * notes in seconds on a CPU, the most commonly pulled embedding model in the
 * Ollama library, and trained with task prefixes — which is why {@link
 * EmbedKind} exists. A query and a document are embedded into the same space
 * from two different sides ("search_query: " / "search_document: "), and an
 * embedder that ignored that would quietly cost recall quality with nothing
 * anywhere saying why. `OLAI_EMBED_MODEL` overrides the model; a model absent
 * from the running Ollama is the same `null` as no Ollama, with a log line
 * naming the pull that would turn it on.
 */

import { Data, Effect } from "effect"

/** Which side of a retrieval a text is on. Models trained with task prefixes
 *  (the nomic family) embed the two differently INTO THE SAME SPACE; models
 *  that were not simply ignore the distinction. */
export type EmbedKind = "query" | "document"

/** An embedder could not answer — the server is gone, the call timed out, the
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
  /** All texts in one call, in order. Vectors come back unnormalised; the
   *  index owns the geometry ({@link ./recall.ts}). */
  readonly embed: (
    kind: EmbedKind,
    texts: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<Float32Array>, EmbedFailure>
}

/** Ollama's own convention, normalised: `OLLAMA_HOST` may be a bare
 *  `host:port` or a full URL, and absent means the conventional loopback. */
const ollamaHost = (): string => {
  const host = process.env["OLLAMA_HOST"]
  if (host === undefined || host === "") return "http://127.0.0.1:11434"
  return host.includes("://") ? host.replace(/\/$/, "") : `http://${host}`
}

const model = (): string => process.env["OLAI_EMBED_MODEL"] ?? "nomic-embed-text"

/** How long a probe may take before the answer is "no Ollama here". Loopback
 *  answers or refuses in microseconds; this covers only the pathological
 *  cases (a firewalled OLLAMA_HOST that swallows the SYN). */
const PROBE_TIMEOUT_MS = 1_000

/** How long one embed call may take. Generous, because a first call may load
 *  the model from disk into memory; a caller with a tighter budget (the query
 *  path) puts its own timeout in front. */
const EMBED_TIMEOUT_MS = 120_000

/** The task prefixes the nomic family was trained with. Applied by MODEL
 *  rather than unconditionally: prefixing a model that never saw them would
 *  put the prefix into the meaning. */
const prefixed = (name: string, kind: EmbedKind, text: string): string =>
  name.startsWith("nomic-embed-text")
    ? `${kind === "query" ? "search_query" : "search_document"}: ${text}`
    : text

/**
 * Find a running Ollama with the model pulled, or `null`.
 *
 * `null` and not a failure, in every branch: no server, a server without the
 * model, a reply that is not Ollama's. Each branch logs its own line — debug
 * for the ordinary "nothing on the port", info for the one case a person
 * could act on (Ollama is up, the model is one `ollama pull` away).
 */
export const detectOllama: Effect.Effect<Embedder | null> = Effect.gen(
  function*() {
    const host = ollamaHost()
    const wanted = model()
    const listed = yield* Effect.tryPromise({
      try: async () => {
        const reply = await fetch(`${host}/api/tags`, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
        if (!reply.ok) throw new Error(`GET /api/tags: ${reply.status}`)
        const body = (await reply.json()) as {
          readonly models?: ReadonlyArray<{ readonly name?: string }>
        }
        return (body.models ?? []).flatMap((entry) =>
          entry.name === undefined ? [] : [entry.name]
        )
      },
      catch: (cause) => new EmbedFailure({ reason: String(cause) }),
    }).pipe(Effect.result)

    if (listed._tag === "Failure") {
      yield* Effect.logDebug(`recall: no Ollama at ${host}; semantic search off`)
      return null
    }
    const present = listed.success.some(
      (name) => name === wanted || name.split(":")[0] === wanted,
    )
    if (!present) {
      yield* Effect.logInfo(
        `recall: Ollama is running but \`${wanted}\` is not pulled — semantic ` +
          `search stays off (\`ollama pull ${wanted}\` turns it on)`,
      )
      return null
    }
    return ollamaEmbedder(host, wanted)
  },
)

/** The embedder over a host that answered the probe. Split from the detection
 *  so a test of the CALL shape needs no `/api/tags` to exist. */
export const ollamaEmbedder = (host: string, name: string): Embedder => ({
  id: `ollama/${name}`,
  embed: (kind, texts) =>
    Effect.tryPromise({
      try: async () => {
        const reply = await fetch(`${host}/api/embed`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: name,
            input: texts.map((text) => prefixed(name, kind, text)),
          }),
          signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
        })
        if (!reply.ok) throw new Error(`POST /api/embed: ${reply.status}`)
        const body = (await reply.json()) as {
          readonly embeddings?: ReadonlyArray<ReadonlyArray<number>>
        }
        const vectors = body.embeddings ?? []
        if (vectors.length !== texts.length) {
          throw new Error(
            `asked for ${texts.length} embeddings, got ${vectors.length}`,
          )
        }
        return vectors.map((vector) => Float32Array.from(vector))
      },
      catch: (cause) => new EmbedFailure({ reason: String(cause) }),
    }),
})
