export const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

export const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

export const update = (sessionId: string | undefined, frame: unknown): void => {
  write({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: frame } })
}

export const unknownMethod = (message: { readonly id?: unknown; readonly method?: string }): void => {
  if (message.method !== undefined && message.id !== undefined) {
    write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `method not found: ${message.method}` } })
  }
}

export const listen = <T>(handle: (message: T) => void): void => {
  let pending = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (chunk: string) => {
    pending += chunk
    const lines = pending.split("\n")
    pending = lines.pop() ?? ""
    for (const line of lines) {
      if (line.trim() === "") continue
      handle(JSON.parse(line) as T)
    }
  })
}
