import { existsSync, rmSync } from "node:fs"

export const emitter = (out: NodeJS.WritableStream) => (message: unknown): void => {
  out.write(`${JSON.stringify(message)}\n`)
}

export const speaking = (emit: (message: unknown) => void, prefix: string) => {
  const answering = new Map<string, (result: unknown) => void>()
  let nextRequestId = 0

  return {
    respond: (id: unknown, result: unknown): void => {
      emit({ jsonrpc: "2.0", id, result })
    },
    refuse: (id: unknown, code: number, message: string, data?: unknown): void => {
      emit({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } })
    },
    notify: (method: string, params: unknown): void => {
      emit({ jsonrpc: "2.0", method, params })
    },
    request: (method: string, params: unknown): Promise<unknown> =>
      new Promise<unknown>((resolve) => {
        const id = `${prefix}-${++nextRequestId}`
        answering.set(id, resolve)
        emit({ jsonrpc: "2.0", id, method, params })
      }),
    take: (id: unknown): ((result: unknown) => void) | null => {
      if (typeof id !== "string") return null
      const resolve = answering.get(id)
      if (resolve === undefined) return null
      answering.delete(id)
      return resolve
    },
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

export const MARKER = {
  refuseModel: ".agent-refuse-model",
  refuseModelByAccount: ".agent-refuse-model-by-account",
  release: ".agent-release",
  holdLoad: ".agent-hold-load",
  loads: ".agent-loads",
  slowReplay: ".agent-slow-replay",
  longHistory: ".agent-long-history",
  holdOpen: ".agent-hold-open",
  saysNothing: ".agent-says-nothing",
  needsAuth: ".agent-needs-auth",
  signedIn: ".agent-signed-in",
  identityOnly: ".agent-identity-only",
  identity: ".agent-identity",
  atThePage: ".agent-at-the-page",
  sleepAsk: ".agent-sleep-ask",
  sleepStamp: ".agent-sleep-stamp",
  sleepHold: ".agent-sleep-hold",
  sleepOutside: ".agent-sleep-outside",
  sleepTrash: ".agent-sleep-trash",
  sleepAsked: ".agent-sleep-asked",
  loginPid: ".agent-login-pid",
} as const

export const RELEASE = MARKER.release

export const SLEEP_STAMP = "1999-01-01T00:00:00+00:00"

export const HOLD_LIMIT_MS = 60_000

const sleep = (millis: number) => new Promise<void>((done) => setTimeout(done, millis));

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
