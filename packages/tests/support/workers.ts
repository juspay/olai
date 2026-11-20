import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { DOORS as MAIL_DOOR_NAMES } from "olai-plugin-mail/appliance/testlib";
import { KNOBS } from "@olai/bundle/knobs";

export { defaultWorkers, WORKER_CAP, workerCount } from "./parallelism.js";

export const spawnFingerprint = (opts: {
  readonly stored: boolean;
  readonly agent: boolean;
  readonly fakes: ReadonlyArray<string>;
  readonly git?: string;
  readonly pin?: { readonly commit?: string; readonly push?: string };
  readonly avatar?: string;
  readonly padiSocket?: string;
  readonly oduOrigin?: string;
  readonly himalaya?: string;
  readonly mailGoogle?: string;
  readonly mailDoors?: boolean;
  readonly plugins?: string;
  readonly rowsOn?: string;
  readonly rowsOff?: string;
}): string =>

  `stored=${opts.stored ? 1 : 0},agent=${opts.agent ? 1 : 0},fakes=${[...opts.fakes].sort().join("+")},git=${opts.git ?? "off"}` +
  `,commit=${opts.pin?.commit ?? "-"},push=${opts.pin?.push ?? "-"},avatar=${opts.avatar ?? "-"}` +
  `,padi=${opts.padiSocket ?? "-"},odu=${opts.oduOrigin ?? "-"},plugins=${opts.plugins ?? "-"}` +
  `,himalaya=${opts.himalaya ?? "(unset)"},google=${opts.mailGoogle ?? "-"},maildoors=${opts.mailDoors === true ? 1 : 0}` +
  `,extra=${opts.rowsOn ?? "-"},without=${opts.rowsOff ?? "-"}`;

export const workerId = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.CUCUMBER_WORKER_ID;
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const NOTHING_LISTENS = "http://127.0.0.1:1";

export const MAIL_HIMALAYA_OFF = "";

export const holdPort = (port: number): Promise<net.Server> =>
  new Promise((resolve, reject) => {
    const holder = net.createServer((socket) => {
      socket.resetAndDestroy();
    });
    holder.unref();
    holder.once("error", reject);
    holder.listen(port, "127.0.0.1", () => resolve(holder));
  });

export const releasePort = (holder: net.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    holder.close((cause) => (cause ? reject(cause) : resolve()));
  });

const stateHomeIn = (stateRoot: string): string =>
  path.join(stateRoot, "state");

export const isolateEnv = (
  stateRoot: string,
  extras: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv => {
  const cache = path.join(stateRoot, "cache");
  const state = stateHomeIn(stateRoot);
  const runtime = path.join(stateRoot, "runtime");
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
  const host: NodeJS.ProcessEnv = { ...process.env };
  delete host.PADI_SOCKET;
  delete host.ODU_WEB_ORIGIN;
  for (const knob of KNOBS) delete host[knob];
  for (const door of MAIL_DOOR_NAMES) delete host[door];
  const env: NodeJS.ProcessEnv = {
    ...host,
    ...extras,
    ODU_WEB_ORIGIN: extras.ODU_WEB_ORIGIN ?? NOTHING_LISTENS,
    XDG_CACHE_HOME: cache,
    XDG_STATE_HOME: state,
    XDG_RUNTIME_DIR: runtime,
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_COMMON_DIR",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ] as const) {
    delete env[key];
  }
  return env;
};
