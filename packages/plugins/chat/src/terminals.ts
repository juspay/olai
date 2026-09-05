/** Client-owned commands and their retained output. Released handles cannot be
 * used by the agent again, but their snapshots remain available to tool rows. */
import type { CreateTerminalRequest, TerminalOutputRequest } from "@agentclientprotocol/sdk"
import { RequestError } from "@agentclientprotocol/sdk"
import { start, type Child } from "@olai/child"
import { randomUUID } from "node:crypto"
import { isAbsolute } from "node:path"
import type { TerminalView } from "olai-plugin-chat/wire"

const DEFAULT_LIMIT = 64 * 1024
const MAX_LIMIT = 1024 * 1024

/** Keep the newest complete UTF-8 characters, including for a zero-byte limit. */
export const tailBytes = (text: string, limit: number): { output: string; truncated: boolean } => {
  const bytes = Buffer.from(text)
  if (bytes.length <= limit) return { output: text, truncated: false }
  let from = bytes.length - limit
  while (from < bytes.length && (bytes[from]! & 0xc0) === 0x80) from++
  return { output: bytes.subarray(from).toString("utf8"), truncated: true }
}

export class Terminals {
  private generation = 0
  private readonly views = new Map<string, TerminalView>()
  private readonly limits = new Map<string, number>()
  private readonly live = new Map<string, { session: string; child: Child }>()
  constructor(private readonly changed: (id: string) => void, private readonly cwd: string) {}

  view(id: string): TerminalView {
    return this.views.get(id) ?? { id, output: "Terminal output is unavailable.",
      truncated: false, exitCode: null, signal: null, running: false }
  }

  begin(id: string, limit = DEFAULT_LIMIT): void {
    if (this.views.has(id)) return
    this.limits.set(id, limit)
    this.views.set(id, { id, output: "", truncated: false, exitCode: null, signal: null, running: true })
  }

  append(id: string, data: string): void {
    this.begin(id)
    const old = this.view(id)
    const tail = tailBytes(old.output + data, this.limits.get(id) ?? DEFAULT_LIMIT)
    this.views.set(id, { ...old, ...tail, truncated: old.truncated || tail.truncated })
    this.changed(id)
  }

  finish(id: string, exitCode: number | null, signal: string | null): void {
    this.begin(id)
    this.views.set(id, { ...this.view(id), running: false, exitCode, signal })
    this.changed(id)
  }

  create(params: CreateTerminalRequest): { terminalId: string } {
    const cwd = params.cwd ?? this.cwd
    if (!isAbsolute(cwd)) throw RequestError.invalidParams("terminal cwd must be absolute")
    const wanted = params.outputByteLimit ?? DEFAULT_LIMIT
    if (!Number.isSafeInteger(wanted) || wanted < 0) throw RequestError.invalidParams("invalid terminal output limit")
    const id = randomUUID()
    this.begin(id, Math.min(wanted, MAX_LIMIT))
    const env = { ...process.env }
    for (const pair of params.env ?? []) env[pair.name] = pair.value
    const child = start(params.command, params.args ?? [], {
      cwd, env, processGroup: true, drain: { stdout: false, stderr: false },
    })
    this.live.set(id, { session: params.sessionId, child })
    const generation = this.generation
    for (const stream of [child.stdout, child.stderr]) {
      stream?.setEncoding("utf8")
      stream?.on("data", (chunk: string) => { if (generation === this.generation) this.append(id, chunk) })
    }
    void child.unstartable.then((why) => { if (generation === this.generation) this.append(id, why + "\n") })
    void child.closed.then(({ code, signal }) => { if (generation === this.generation) this.finish(id, code, signal) })
    return { terminalId: id }
  }

  private handle(params: TerminalOutputRequest): Child {
    const at = this.live.get(params.terminalId)
    if (at === undefined || at.session !== params.sessionId) throw RequestError.invalidParams("unknown terminal in this session")
    return at.child
  }

  output(params: TerminalOutputRequest) {
    this.handle(params)
    const view = this.view(params.terminalId)
    return { output: view.output, truncated: view.truncated,
      ...(view.running ? {} : { exitStatus: { exitCode: view.exitCode, signal: view.signal } }) }
  }

  async wait(params: TerminalOutputRequest) {
    const close = await this.handle(params).closed
    return { exitCode: close.code, signal: close.signal }
  }

  async kill(params: TerminalOutputRequest) {
    await this.handle(params).stop()
    return {}
  }

  async release(params: TerminalOutputRequest) {
    const child = this.handle(params)
    this.live.delete(params.terminalId)
    await child.stop()
    return {}
  }

  async cancel(): Promise<void> {
    await Promise.all([...this.live.values()].map(({ child }) => child.stop()))
  }

  async clear(): Promise<void> {
    const children = [...this.live.values()]
    for (const [id, view] of this.views) if (view.running) this.finish(id, null, "SIGTERM")
    this.generation++
    this.live.clear()
    this.views.clear()
    this.limits.clear()
    await Promise.all(children.map(({ child }) => child.stop()))
  }
}
