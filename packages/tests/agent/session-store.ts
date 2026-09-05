/** Optional disk-backed ACP sessions for lifecycle scenarios. Each new session
 * has its own identity; only a prompted session can be listed or loaded, and
 * replay contains that session's actual messages. The canned protocol fixtures
 * remain available for tests that need their precise frames. */
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const SESSION_STORE_MARKER = ".agent-persistent-sessions"
interface Saved {
  title: string
  updatedAt: string
  updates: Array<Record<string, unknown>>
}
export const sessionStore = (cwd: string) => {
  const directory = join(cwd, SESSION_STORE_MARKER)
  const file = (id: string) => join(directory, `${id}.json`)
  const valid = (id: string) => /^audit-session-[a-f0-9-]+$/.test(id)
  const read = (id: string): Saved | null =>
    valid(id) && existsSync(file(id)) ? JSON.parse(readFileSync(file(id), "utf8")) as Saved : null
  const write = (id: string, saved: Saved) => {
    mkdirSync(directory, { recursive: true })
    writeFileSync(file(id), JSON.stringify(saved))
  }
  return {
    enabled: existsSync(directory),
    newId: () => `audit-session-${randomUUID()}`,
    read,
    prompt: (id: string, text: string) => {
      if (!valid(id)) return
      const saved = read(id) ?? { title: text.split("\n")[0] ?? text, updatedAt: "", updates: [] }
      saved.updatedAt = new Date().toISOString()
      saved.updates.push({ sessionUpdate: "user_message_chunk", content: { type: "text", text } })
      write(id, saved)
    },
    update: (id: string, update: Record<string, unknown>) => {
      const saved = read(id)
      if (saved === null) return
      if (!["agent_message_chunk", "tool_call", "tool_call_update"].includes(String(update["sessionUpdate"]))) return
      saved.updates.push(update)
      write(id, saved)
    },
    list: () => !existsSync(directory) ? [] : readdirSync(directory).flatMap((name) => {
      const id = name.replace(/\.json$/, "")
      const saved = read(id)
      return saved === null ? [] : [{
        sessionId: id, cwd, title: saved.title, updatedAt: saved.updatedAt,
        _meta: { claudeCode: { messageCount: saved.updates.filter((update) => String(update["sessionUpdate"]).endsWith("message_chunk")).length } },
      }]
    }),
  }
}
