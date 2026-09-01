/**
 * A SPACES THAT IS NOT SPACES — the far end of the mirror's unit tests.
 *
 * The suite pins the request shapes and the queue-on-failure behaviour against
 * the real route's gates, not a paraphrase of one of them. Standing up the
 * human's live instance is refused: this listens on loopback, records every
 * request, and answers with the ChatActionResponse the real routes return.
 *
 * It is a real HTTP server (Bun.serve). The four refines the three chat POSTs
 * actually run (`~/code/xyne-spaces` `routes/chat.ts`, `channelValidation.ts`,
 * `chatController.ts`) are all here, plus channel existence — an unknown
 * `channelId` is 404, which is how a typo'd bind is tested as retryable.
 */

export interface Recorded {
  readonly method: string
  readonly path: string
  readonly authorization: string | null
  readonly body: unknown
}

export interface FakeSpaces {
  readonly url: string
  readonly requests: ReadonlyArray<Recorded>
  readonly failNext: (status: number, error: string, message?: string) => void
  /** Stay refused until {@link FakeSpaces.up}. */
  readonly down: (status: number, error: string, message?: string) => void
  readonly up: () => void
  /** Forget a conversation so the next post into it 404s as a dead thread. */
  readonly dropConversation: (id: string) => void
  /** Delay each fetch by `ms`, so two drain callers can overlap. */
  readonly slow: (ms: number) => void
  readonly close: () => void
}

const asRecord = (body: unknown): Record<string, unknown> =>
  body !== null && typeof body === "object" ? body as Record<string, unknown> : {}

const trimmed = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === "string" ? (record[key] as string).trim() : ""

const hasChannelContext = (record: Record<string, unknown>): boolean =>
  trimmed(record, "channelId") !== ""
  || trimmed(record, "channelName") !== ""
  || trimmed(record, "conversationId") !== ""

const hasMessageText = (record: Record<string, unknown>): boolean =>
  trimmed(record, "text") !== "" || trimmed(record, "markdownText") !== ""

const badRequest = (message: string): Response =>
  Response.json({ error: "Bad Request", message }, { status: 400 })

const notFound = (message: string): Response =>
  Response.json({ error: "Not Found", message }, { status: 404 })

export const listen = async (opts?: {
  readonly channels?: ReadonlyArray<string>
}): Promise<FakeSpaces> => {
  const requests: Array<Recorded> = []
  const channels = new Set(opts?.channels ?? ["ch-team", "ch"])
  const conversations = new Set<string>()
  let fail: { status: number; error: string; message: string } | null = null
  let held: { status: number; error: string; message: string } | null = null
  let wait = 0
  let n = 0

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      if (wait > 0) await Bun.sleep(wait)
      const url = new URL(req.url)
      const authorization = req.headers.get("authorization")
      const body: unknown = await req.json().catch(() => null)
      requests.push({ method: req.method, path: url.pathname, authorization, body })
      const refused = fail ?? held
      if (fail !== null) fail = null
      if (refused !== null) {
        return Response.json(
          { error: refused.error, message: refused.message, code: "REFUSED" },
          { status: refused.status },
        )
      }
      if (req.method !== "POST" || !url.pathname.startsWith("/api/apps/chat/")) {
        return Response.json({ error: "not found", code: "NOT_FOUND" }, { status: 404 })
      }
      const record = asRecord(body)
      if (!hasChannelContext(record)) {
        return badRequest("Validation error")
      }
      const channelId = trimmed(record, "channelId")
      if (channelId !== "" && !channels.has(channelId)) {
        return notFound("Channel not found")
      }
      n += 1
      if (url.pathname === "/api/apps/chat/postMessage") {
        if (!hasMessageText(record)) {
          return badRequest("Either text, markdownText, flow, or attachments is required")
        }
        const conversationId = trimmed(record, "conversationId")
        if (conversationId !== "") {
          if (!conversations.has(conversationId)) {
            return Response.json(
              { error: `Conversation ${conversationId} not found`, code: "NOT_FOUND" },
              { status: 404 },
            )
          }
          return Response.json({
            eventType: "MESSAGE_POSTED",
            conversationId,
            messageId: `msg-${n}`,
          }, { status: 201 })
        }
        const opened = `conv-${n}`
        conversations.add(opened)
        return Response.json({
          eventType: "MESSAGE_POSTED",
          conversationId: opened,
          messageId: `msg-${n}`,
        }, { status: 201 })
      }
      if (url.pathname === "/api/apps/chat/updateMessage") {
        if (trimmed(record, "messageId") === "") {
          return badRequest("Message ID is required")
        }
        if (!hasMessageText(record) && record.flowJSON === undefined) {
          return badRequest("Either text, markdownText, flowJSON, or attachments is required")
        }
        return Response.json({
          eventType: "MESSAGE_UPDATED",
          conversationId: "conv-held",
          messageId: trimmed(record, "messageId") || `msg-${n}`,
        }, { status: 200 })
      }
      if (url.pathname === "/api/apps/chat/agentProgress") {
        if (trimmed(record, "conversationId") === "") {
          return badRequest("Conversation ID is required")
        }
        return Response.json({ success: true }, { status: 200 })
      }
      return Response.json({ error: "not found", code: "NOT_FOUND" }, { status: 404 })
    },
  })

  return {
    url: `http://${server.hostname}:${server.port}`,
    get requests() {
      return requests
    },
    failNext: (status, error, message = error) => {
      fail = { status, error, message }
    },
    down: (status, error, message = error) => {
      held = { status, error, message }
    },
    up: () => {
      held = null
    },
    dropConversation: (id) => {
      conversations.delete(id)
    },
    slow: (ms) => {
      wait = ms
    },
    close: () => {
      server.stop(true)
    },
  }
}
