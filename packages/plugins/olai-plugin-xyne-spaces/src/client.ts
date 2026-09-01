/**
 * THE DIAL — Spaces' installed-app chat routes, as this plugin posts them.
 *
 * Shapes are read off `~/code/xyne-spaces` (`apps/backend/src/apps/routes/chat.ts`,
 * `controllers/chatController.ts`, `core/conversationUtils.ts`). Never guessed.
 *
 *   POST /api/apps/chat/postMessage     Authorization: Bearer <JWT>
 *     { channelId, markdownText, conversationId? }
 *     201 { eventType, conversationId, messageId }
 *
 *   POST /api/apps/chat/updateMessage
 *     { messageId, markdownText }
 *     200 { eventType, conversationId, messageId }
 *
 *   POST /api/apps/chat/agentProgress
 *     { conversationId, channelId?, status: "working"|"done", agentSlug?, sessionId? }
 *     200 { success: true }
 *
 * `conversationId` absent on postMessage opens a thread (a new Conversation);
 * present, it replies into that thread. That is `findOrCreateConversation`.
 *
 * `fetch` is injectable so a test owns the far end. A real serve uses the
 * runtime's `fetch`.
 */

export interface Posted {
  readonly conversationId: string
  readonly messageId: string
}

export interface Refused {
  readonly status: number
  readonly why: string
}

export type PostResult =
  | { readonly ok: true; readonly posted: Posted }
  | { readonly ok: false; readonly refused: Refused }

export type ProgressResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly refused: Refused }

export interface SpacesClient {
  readonly postMessage: (body: {
    readonly channelId: string
    readonly markdownText: string
    readonly conversationId?: string
  }) => Promise<PostResult>
  readonly updateMessage: (body: {
    readonly messageId: string
    readonly markdownText: string
  }) => Promise<PostResult>
  readonly agentProgress: (body: {
    readonly conversationId: string
    readonly channelId?: string
    readonly status: "working" | "done"
    readonly agentSlug?: string
    readonly sessionId?: string
  }) => Promise<ProgressResult>
}

/** What a test (or a real serve) hands the dial. */
export interface Dial {
  readonly fetch?: typeof fetch
}

const CHAT = "/api/apps/chat"

export const originOf = (url: string): string => url.replace(/\/+$/, "")

export const makeClient = (
  origin: string,
  token: string,
  dial: Dial | undefined,
): SpacesClient => {
  const fetchImpl = dial?.fetch ?? fetch
  const base = originOf(origin)

  const call = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; json: unknown }> => {
    const response = await fetchImpl(`${base}${CHAT}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const json: unknown = await response.json().catch(() => null)
    return { status: response.status, json }
  }

  const postedOf = (json: unknown): Posted | null => {
    if (json === null || typeof json !== "object") return null
    const record = json as Record<string, unknown>
    const conversationId = record.conversationId
    const messageId = record.messageId
    if (typeof conversationId !== "string" || typeof messageId !== "string") return null
    return { conversationId, messageId }
  }

  const refusedOf = (status: number, json: unknown): Refused => {
    const error =
      json !== null && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${status}`
    return { status, why: error }
  }

  return {
    postMessage: async (body) => {
      const payload: Record<string, unknown> = {
        channelId: body.channelId,
        markdownText: body.markdownText,
      }
      if (body.conversationId !== undefined) payload.conversationId = body.conversationId
      const { status, json } = await call("/postMessage", payload)
      const posted = postedOf(json)
      if (status >= 200 && status < 300 && posted !== null) return { ok: true, posted }
      return { ok: false, refused: refusedOf(status, json) }
    },
    updateMessage: async (body) => {
      const { status, json } = await call("/updateMessage", {
        messageId: body.messageId,
        markdownText: body.markdownText,
      })
      const posted = postedOf(json)
      if (status >= 200 && status < 300 && posted !== null) return { ok: true, posted }
      return { ok: false, refused: refusedOf(status, json) }
    },
    agentProgress: async (body) => {
      const payload: Record<string, unknown> = {
        conversationId: body.conversationId,
        status: body.status,
        agentSlug: body.agentSlug ?? "olai",
      }
      if (body.channelId !== undefined) payload.channelId = body.channelId
      if (body.sessionId !== undefined) payload.sessionId = body.sessionId
      const { status, json } = await call("/agentProgress", payload)
      if (status >= 200 && status < 300) return { ok: true }
      return { ok: false, refused: refusedOf(status, json) }
    },
  }
}
