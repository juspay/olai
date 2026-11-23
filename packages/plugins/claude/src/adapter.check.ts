/**
 * DOES THE SHIPPED CLAUDE ADAPTER STILL OFFER A MODEL PICKER — asked of the
 * built `claude-agent-acp`, over its own stdio, in the build sandbox.
 *
 * ## Why this exists as its own leg
 *
 * The rows of the chat's model picker are not written down anywhere in olai or
 * kolu: the Claude Code CLI behind the adapter reports them on `session/new`,
 * as the `configOptions` entry whose `id` is `"model"` (`@kolu/acp-claude`'s
 * `MODELS.config`), and every layer above passes them through. Every e2e
 * scenario talks to a fake adapter (`../e2e/fake`), and the live scripts need
 * an account, so nothing else in CI asks the real pair. A build that wires the
 * adapter to a CLI that answers no picker, or to no CLI at all, was green.
 *
 * ## What it asks, and what it does not
 *
 * `initialize`, then `session/new`, with an empty `HOME`, no credentials and
 * no network: that handshake was measured to answer the picker in exactly that
 * state. It fails unless the answer carries a `model` entry with at least one
 * row. It names NO model: the list moves with the CLI the kolu pin's
 * derivation drives, and a check that pinned a name would fail on every bump
 * for being right.
 *
 * Run by `checks.plugin-claude-adapter` (`../default.nix`):
 *
 *     bun adapter.check.ts <claude-agent-acp> <empty home>
 */

import { spawn } from "node:child_process"

const [adapter, home] = process.argv.slice(2)
if (adapter === undefined || home === undefined) {
  console.error("usage: adapter.check.ts <claude-agent-acp> <empty home>")
  process.exit(2)
}

/** A leaf of the picker: a row a person can choose. A select's options are
 *  either such rows or groups of them. */
type Row = { readonly value: string; readonly name: string }
type Choice = Row | { readonly options?: readonly Choice[] }
const rowsOf = (choices: readonly Choice[]): readonly Row[] =>
  choices.flatMap((c) => ("value" in c && typeof c.value === "string" ? [c] : rowsOf("options" in c ? (c.options ?? []) : [])))

const fail = (why: string): never => {
  console.error(`claude adapter check: ${why}`)
  child.kill()
  process.exit(1)
}

// The adapter's own environment and nothing of the builder's: an empty home,
// so the CLI finds no config or credentials, and Claude Code told to make no
// traffic it can skip.
const child = spawn(adapter, [], {
  env: { HOME: home, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
  cwd: home,
  stdio: ["pipe", "pipe", "inherit"],
})
const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`)

const deadline = setTimeout(() => fail("no answer to `session/new` within 120s"), 120_000)
// A path that does not exist or cannot run is the adapter not starting, said in
// this check's own words rather than as an unhandled spawn error.
child.on("error", (error) => fail(`the adapter did not start: ${error.message}`))
child.on("exit", (code, signal) => fail(`the adapter exited (${code ?? signal}) before answering`))

let buffered = ""
child.stdout.on("data", (chunk: Buffer) => {
  buffered += chunk.toString()
  for (let end = buffered.indexOf("\n"); end !== -1; end = buffered.indexOf("\n")) {
    const line = buffered.slice(0, end)
    buffered = buffered.slice(end + 1)
    let message: {
      id?: unknown
      method?: unknown
      error?: unknown
      result?: { configOptions?: { id?: unknown; options?: Choice[] }[] }
    }
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }
    // JSON-RPC ids are per direction: a request or notification FROM the agent
    // may carry the id of one of ours, and only a message without a `method`
    // is an answer.
    if (message.method !== undefined) continue
    if (message.error !== undefined) fail(`request ${String(message.id)} failed: ${JSON.stringify(message.error)}`)
    if (message.id === 1) {
      send({ jsonrpc: "2.0", id: 2, method: "session/new", params: { cwd: home, mcpServers: [] } })
    }
    if (message.id === 2) {
      const model = (message.result?.configOptions ?? []).find((option) => option.id === "model")
      if (model === undefined) fail("`session/new` carries no `model` entry in `configOptions`")
      const rows = rowsOf(model?.options ?? [])
      if (rows.length === 0) fail("the `model` entry offers no rows")
      for (const row of rows) console.log(`${row.value}\t${row.name}`)
      clearTimeout(deadline)
      child.removeAllListeners("exit")
      child.kill()
      process.exit(0)
    }
  }
})

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: 1, clientCapabilities: {} } })
