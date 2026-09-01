/**
 * A SPACES THAT IS NOT SPACES — the far end of the mirror's unit tests.
 *
 * The suite pins the request shapes (auth header, postMessage body, thread
 * reply, updateMessage, agentProgress) and the queue-on-failure behaviour.
 * Standing up the human's live instance would be the opposite of that, and
 * is refused: this listens on loopback, records every request, and answers
 * with the ChatActionResponse the real routes return
 * (`~/code/xyne-spaces` `apps/backend/src/apps/types/index.ts`).
 *
 * It is a real HTTP server (Bun.serve), not a stub of `fetch`, so a test
 * that passes here is a test of the bytes on the wire.
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
  readonly failNext: (status: number, error: string) => void
  /** Stay refused until {@link FakeSpaces.up}. */
  readonly down: (status: number, error: string) => void
  readonly up: () => void
  readonly close: () => void
}

export const listen = async (): Promise<FakeSpaces> => {
  const requests: Array<Recorded> = []
  let fail: { status: number; error: string } | null = null
  let held: { status: number; error: string } | null = null
  let n = 0

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      const authorization = req.headers.get("authorization")
      const body: unknown = await req.json().catch(() => null)
      requests.push({ method: req.method, path: url.pathname, authorization, body })
      const refused = fail ?? held
      if (fail !== null) fail = null
      if (refused !== null) {
        return Response.json({ error: refused.error, code: "REFUSED" }, { status: refused.status })
      }
      n += 1
      if (url.pathname === "/api/apps/chat/postMessage" && req.method === "POST") {
        const record = body !== null && typeof body === "object"
          ? body as Record<string, unknown>
          : {}
        const conversationId =
          typeof record.conversationId === "string" ? record.conversationId : `conv-${n}`
        return Response.json({
          eventType: "MESSAGE_POSTED",
          conversationId,
          messageId: `msg-${n}`,
        }, { status: 201 })
      }
      if (url.pathname === "/api/apps/chat/updateMessage" && req.method === "POST") {
        return Response.json({
          eventType: "MESSAGE_UPDATED",
          conversationId: "conv-held",
          messageId: (body as { messageId?: string } | null)?.messageId ?? `msg-${n}`,
        }, { status: 200 })
      }
      if (url.pathname === "/api/apps/chat/agentProgress" && req.method === "POST") {
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
    failNext: (status, error) => {
      fail = { status, error }
    },
    down: (status, error) => {
      held = { status, error }
    },
    up: () => {
      held = null
    },
    close: () => {
      server.stop(true)
    },
  }
}
