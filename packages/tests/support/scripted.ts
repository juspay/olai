/**
 * What every scripted agent in this suite has in common — and nothing about
 * what any of them MEANS.
 *
 * There are two of them now (`agent/fake-acp-agent.ts`, shaped like the Claude
 * Code adapter, and `agent/opencode/opencode`, shaped like opencode), plus the
 * fake `kolu` next door, and the whole value of having two is that they are
 * INDEPENDENT WITNESSES to the same protocol: the frames, the `_meta`, the call
 * ids, the order of a permission's options are each file's own to get right,
 * and a shared implementation of any of them would let a fake agree with the
 * client by construction.
 *
 * None of that is what is here. This is the transport underneath: how a
 * JSON-RPC message is put on a pipe, how a request the AGENT sends is matched
 * to the answer that comes back, and how a held turn waits for a scenario to
 * say when. Each of those was written twice, in files that never meet, and each
 * of them is a contract with something outside the file — the framing with
 * whatever reads the pipe, the hold marker with the step definition that
 * touches it. That is the kind of copy that goes wrong silently.
 *
 * It is the write half of {@link ./ndjson.ts}, which made exactly this argument
 * for the read half first ("each of them used to carry its own copy of the same
 * six lines… The copies were the bug"). It lives in `support/` for the same
 * reason that one does: Cucumber imports everything under `support/` into the
 * runner's own process, so a file here must be a library and nothing else —
 * there is nothing in it to start.
 */

import { existsSync, rmSync } from "node:fs"

/** One JSON-RPC message, framed and written. Line-delimited, which is what ACP
 *  over stdio is. */
export const emitter = (out: NodeJS.WritableStream) => (message: unknown): void => {
  out.write(`${JSON.stringify(message)}\n`)
}

/** Everything an agent puts on the wire, over one `emit`.
 *
 *  A FACTORY rather than four free functions, because the pending-request map
 *  and the id counter belong to one agent's conversation and a module-level
 *  pair would be shared by anything that imported them. */
export const speaking = (emit: (message: unknown) => void, prefix: string) => {
  /** The client's answers to requests WE sent, by the id we sent them under.
   *  Ids are prefixed so they cannot be mistaken for the client's own. */
  const answering = new Map<string, (result: unknown) => void>()
  let nextRequestId = 0

  return {
    /** An answer to something the client asked. */
    respond: (id: unknown, result: unknown): void => {
      emit({ jsonrpc: "2.0", id, result })
    },
    /** The other half: a request we will not answer. Named for the same reason
     *  its sibling is — the envelope is the protocol's, not a fake's, and two
     *  hand-built copies is how one of them drifts. */
    refuse: (id: unknown, code: number, message: string): void => {
      emit({ jsonrpc: "2.0", id, error: { code, message } })
    },
    notify: (method: string, params: unknown): void => {
      emit({ jsonrpc: "2.0", method, params })
    },
    /** Ask the client something and wait. Half the protocol runs this way — a
     *  permission, an elicitation — and a scripted agent that could only notify
     *  could not exercise any of it. */
    request: (method: string, params: unknown): Promise<unknown> =>
      new Promise<unknown>((resolve) => {
        const id = `${prefix}-${++nextRequestId}`
        answering.set(id, resolve)
        emit({ jsonrpc: "2.0", id, method, params })
      }),
    /** Whether this id is one of OURS still waiting, and the resolver if it
     *  is — taken, so a second answer to one request settles nothing twice. */
    take: (id: unknown): ((result: unknown) => void) | null => {
      if (typeof id !== "string") return null
      const resolve = answering.get(id)
      if (resolve === undefined) return null
      answering.delete(id)
      return resolve
    },
    /** Every question still on the wire, taken back — which is what a real
     *  agent does when its turn is cancelled. The caller sends whatever its own
     *  protocol spells that with; what is shared is that each is resolved
     *  rather than awaited, because a cancelled request gets no response and an
     *  agent that went on awaiting them would hang on a turn it had abandoned. */
    withdraw: (): ReadonlyArray<string> => {
      const outstanding = [...answering.keys()]
      for (const id of outstanding) {
        const resolve = answering.get(id)
        answering.delete(id)
        resolve?.(null)
      }
      return outstanding
    },
  }
}

/**
 * THE MARKERS a scenario and a scripted agent talk through.
 *
 * Dot-files, which the store's walk prunes, so touching one is not itself an
 * edit — and NAMED HERE, all of them, because each is a contract between a file
 * that writes it (a step definition) and one or two that read it (the scripted
 * agents), and a name spelled twice in files that never meet is the copy this
 * module's header is about. A typo on either side does not fail: it makes the
 * scenario quietly not hold, and a race scenario that holds nothing passes for
 * the wrong reason.
 */
export const MARKER = {
  /** Let a held turn — or a held open — go on. */
  release: ".agent-release",
  /** Make the next `session/load` sit on the wire. */
  holdLoad: ".agent-hold-load",
  /** ... and the next session OPEN, whichever verb asked for it: the window
   *  between picking an agent and having a conversation. */
  holdOpen: ".agent-hold-open",
} as const

/** The release marker, by its old name — {@link MARKER}'s `release`. */
export const RELEASE = MARKER.release

/** Long enough that a slow machine is not the reason a scenario fails, short
 *  enough that a scenario which forgot to release fails on its own assertion
 *  rather than on the runner's timeout. */
export const HOLD_LIMIT_MS = 30_000

const sleep = (millis: number) => new Promise<void>((done) => setTimeout(done, millis));

/**
 * Wait until a scenario says when — the whole of `hold`.
 *
 * `onTick` runs on every poll, BEFORE the release is looked for, because for
 * one of the two agents that is where the claim under test lives: a message
 * steered into a turn is acted on by the turn that is still running, not by the
 * one after it.
 *
 * Answers whether it was released or gave up, so the caller can say so in its
 * own words on its own channel.
 */
export const released = async (
  cwd: string,
  onTick?: () => void | Promise<void>,
): Promise<boolean> => {
  const marker = `${cwd}/${RELEASE}`;
  for (let waited = 0; waited < HOLD_LIMIT_MS; waited += 100) {
    await onTick?.();
    if (existsSync(marker)) {
      rmSync(marker, { force: true });
      return true;
    }
    await sleep(100);
  }
  return false;
};
