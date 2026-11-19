/**
 * The JSON-RPC skeleton every fixture agent in this folder shares: the framing
 * on the way out, the line decoder on the way in, and the one answer they all
 * owe to a method none of them speak.
 *
 * Each fixture is spawned as a SCRIPT by absolute path (`process.execPath`),
 * so this is a sibling relative import — no package entry point is involved.
 * Importing it is also what makes each fixture a module rather than a script,
 * which is what keeps its own names its own: two fixtures in one folder both
 * spelling `write` would otherwise be two globals colliding.
 */

/** One JSON value per line, which is the framing ACP speaks over a pipe. */
export const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

/** The answer to a request. */
export const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

/** A `session/update` notification: the frames a turn is watched through. */
export const update = (sessionId: string | undefined, frame: unknown): void => {
  write({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: frame } })
}

/**
 * A request a fixture does not speak is refused the way a real agent refuses
 * it, so a caller that asks one (`session/close`) is not left waiting for an
 * answer that never comes. A notification — no id — is answered with nothing,
 * which is what the protocol says.
 */
export const unknownMethod = (message: { readonly id?: unknown; readonly method?: string }): void => {
  if (message.method !== undefined && message.id !== undefined) {
    write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `method not found: ${message.method}` } })
  }
}

/**
 * Stdin, decoded into one parsed message per call. A read of a pipe is not a
 * message boundary, so a chunk is buffered until the newline that ends it
 * arrives; blank lines are nothing. The caller names the shape it reads out of
 * the message, since that is the only part that differs between fixtures.
 */
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
