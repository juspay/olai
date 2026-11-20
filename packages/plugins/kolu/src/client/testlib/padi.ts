import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const FAKE_PADI = path.resolve(import.meta.dirname, "fake-padi.ts");

const FLEETS = path.resolve(import.meta.dirname, "fixtures");

export interface LivePadi {
  readonly socket: string;
  readonly stop: () => void;
}

export const startPadi = async (fleet: string): Promise<LivePadi> => {
  const dir = mkdtempSync(path.join(tmpdir(), "olai-padi-"));
  const socket = path.join(dir, "padi.sock");
  const child = spawn("bun", [FAKE_PADI, socket, path.join(FLEETS, `${fleet}.json`)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  let said = "";
  child.stderr?.on("data", (chunk: string) => {
    said += chunk;
  });

  const listening = new Promise<void>((resolve, reject) => {
    child.stdout?.on("data", (chunk: string) => {
      if (chunk.includes("listening")) resolve();
    });
    void once(child, "exit").then(() => {
      reject(new Error(`fake padi exited before listening: ${said}`));
    });
  });
  await listening;

  return {
    socket,
    stop: () => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
};
