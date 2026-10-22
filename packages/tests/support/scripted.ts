/**
 * What every scripted agent in this suite has in common — and nothing about
 * what any of them MEANS.
 *
 * The engines each own an executable in their `e2e/fake/` (claude's
 * `claude-agent-acp`, pi's `pi-acp`, codex's `codex-acp`), each scripted
 * through the shared core in `agent/scripted-acp.ts`, plus the fake `kolu`
 * next door, and the whole value of having more than one is that they are
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
  /** Refuse model configuration without changing the active model. */
  refuseModel: ".agent-refuse-model",
  /** Let a held turn — or a held open — go on. */
  release: ".agent-release",
  /** Make the next `session/load` sit on the wire. */
  holdLoad: ".agent-hold-load",
  /** NOTE EVERY `session/load` THIS AGENT RECEIVES, one session id per line —
   *  armed by the file's existence, like the listing counter beside it.
   *
   *  This is how a scenario says the server reopened a conversation WITHOUT a
   *  browser: the page cannot be the witness for that, because opening the page
   *  is what would open the conversation in the old behaviour. */
  loads: ".agent-loads",
  /** Make the next replay of `an older conversation` arrive a line at a
   *  time, the way a long history reaches the panel: over many frames, while
   *  the panel is still opening it. */
  slowReplay: ".agent-slow-replay",
  /** Make the next replay of `an older conversation` hold MANY DISTINCT ROWS —
   *  a conversation long enough that a subscribe cannot ship it whole. The
   *  window a transcript ships (`olai-plugin-chat`'s `TRANSCRIPT_WINDOW`) is a
   *  row count, so "long" here means rows: the replay's own prose grows ONE
   *  row, and this adds a hundred finished calls so the count crosses the
   *  window. */
  longHistory: ".agent-long-history",
  /** ... and the next session OPEN, whichever verb asked for it: the window
   *  between picking an agent and having a conversation. */
  holdOpen: ".agent-hold-open",
  /** Make the next handshake ADVERTISE NOTHING — no queue, no steering. A
   *  property of the machine rather than of anything the client says, like the
   *  stored sessions and the refusals beside it, and the one way a scenario can
   *  look at a panel that has been told nothing about the agent it is talking
   *  to: no promise about a message sent mid-turn, and no interruption
   *  offered. */
  saysNothing: ".agent-says-nothing",
  /** Make this agent REFUSE to open a conversation, and to run a turn, UNTIL
   *  IT HAS BEEN SIGNED IN — ACP's `-32000`, the whole of how an agent asks
   *  for a signature. Released by {@link signedIn}, which is what
   *  a completed sign-in leaves behind: the login script writes it for the
   *  method olai runs, and the agent writes it for the one it runs itself.
   *
   *  TWO FILES RATHER THAN ONE that a scenario adds and removes, because the
   *  two ends are different files that never meet: a step says "this machine
   *  needs a signature" at the start of a scenario, and whichever sign-in
   *  COMPLETES leaves the other. */
  needsAuth: ".agent-needs-auth",
  /** ... AND IT HAS BEEN: the credential a sign-in left behind. See
   *  {@link needsAuth}. */
  signedIn: ".agent-signed-in",
  /** Say the person has finished at a vendor's page — what a device-code or an
   *  OAuth elicitation waits for, since this suite cannot visit one. */
  atThePage: ".agent-at-the-page",
  /** Make the next SLEEP TURN ask a structured question and wait for it: the
   *  shape a person's alert fires on, and the one case the pass itself decides
   *  — a question nobody is there to answer is cancelled, not announced. */
  sleepAsk: ".agent-sleep-ask",
  /** ...and make it try to write the memo of its own sleep, which its session
   *  credential refuses (`olai-plugin-chat`'s reserved key). */
  sleepStamp: ".agent-sleep-stamp",
  /** ...and make it WRITE and then hold the turn open until released, so a
   *  scenario can give the quiet window its full run in the middle of a pass —
   *  the only way the hold on that window can be shown to be doing anything. */
  sleepHold: ".agent-sleep-hold",
  /** ...AND MAKE IT TRY ONE WRITE OUTSIDE ITS SUBTREE AND ONE TRASH, in the
   *  same turn: the file's CONTENT names the node to write to, and the pass's
   *  fence (`@olai/ops`' `Confinement`) is what must refuse both. */
  sleepOutside: ".agent-sleep-outside",
  sleepTrash: ".agent-sleep-trash",
  /** WHAT THE AGENT LEAVES WHEN ITS SLEEP QUESTION IS ON THE WIRE. A scenario
   *  that asserts an alert did NOT fire has to establish that there was
   *  something to alert about, and with the fold shut there is nothing else to
   *  read (`packages/plugins/alerts/e2e/steps/alerts_steps.ts` says the same
   *  thing about its own absences). */
  sleepAsked: ".agent-sleep-asked",
  /** WHICH PROCESS THE LOGIN COMMAND IS, written by the command itself as it
   *  starts (`./fake-login.ts`). The one way the suite can hold the panel to
   *  "the scope going away kills it": a killed process leaves nothing else to
   *  read, and a handler that says goodbye on its way out is a claim about ONE
   *  signal rather than about being gone. */
  loginPid: ".agent-login-pid",
} as const

/** The release marker, by its old name — {@link MARKER}'s `release`. */
export const RELEASE = MARKER.release

/** THE MEMO THE SCRIPTED AGENT TRIES TO WRITE FOR ITSELF, and cannot: a session
 *  may not write the record of its own pass (`olai-plugin-chat`'s reserved key).
 *  A value from another century, so a scenario can say which of the two landed —
 *  the agent's or the pass's — by reading the node. Spelled here rather than in
 *  each file for {@link MARKER}'s reason: it is a value two files that never
 *  meet have to agree about. */
export const SLEEP_STAMP = "1999-01-01T00:00:00+00:00"

/** Long enough that a slow machine is not the reason a scenario fails, short
 *  enough that a scenario which forgot to release fails on its own assertion
 *  rather than on the runner's timeout.
 *
 *  A MINUTE, and the margin is stated rather than left to be rediscovered: the
 *  sleep scenario that holds a turn open gives the quiet window its full run
 *  from the turn's start, which is 22 s of the scenario's own spans, and a fake
 *  that gave up at thirty would end the turn and commit before that scenario
 *  read "0 commits". Nothing passes falsely by waiting longer — a release that
 *  never comes still ends the scenario on its own assertion. */
export const HOLD_LIMIT_MS = 60_000

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
  stopped?: () => boolean,
): Promise<boolean> => {
  const marker = `${cwd}/${RELEASE}`;
  for (let waited = 0; waited < HOLD_LIMIT_MS; waited += 100) {
    await onTick?.();
    if (stopped?.()) return true;
    if (existsSync(marker)) {
      rmSync(marker, { force: true });
      return true;
    }
    await sleep(100);
  }
  return false;
};
