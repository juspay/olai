/**
 * Line-delimited JSON, read off a pipe. One copy, for everything in this
 * package that talks to a subprocess.
 *
 * Three things here speak newline-framed JSON-RPC down or up a pipe — the MCP
 * client that drives `olai mcp` (`support/mcp.ts`), the scripted ACP agent
 * every server is pointed at (`agent/fake-acp-agent.ts`), and the fake `kolu`
 * every server finds on its PATH (`agent/kolu/kolu`) — and each of them used to
 * carry its own copy of the same six lines: keep what has not ended in a
 * buffer, cut on newlines, parse each whole line. The copies were the bug. A
 * chunk boundary is not a message boundary, which is the one thing this is
 * easy to get wrong about, and getting it right in three places means fixing it
 * in three places.
 *
 * It is a LIBRARY, so it lives in `support/` beside the other shared machinery
 * rather than in `agent/`, which holds programs. Cucumber imports everything
 * under `support/` into the runner's own process; this file is a function and
 * nothing else, so there is nothing for that to start.
 *
 * Deliberately not an MCP or ACP client: the framing is all that is shared. Who
 * a message is for, and what to do about it, is each caller's own — which is
 * why the callback takes a whole message and this file knows no method names.
 */

import type { Readable } from "node:stream";

/**
 * Call `onMessage` with each whole JSON message the stream delivers.
 *
 * A line that will not parse goes to `onGarbage` — and when a caller passes
 * none, the error is left to throw, because a client reading a protocol WE
 * serve has no business quietly skipping a frame that is not one.
 */
export const readMessages = <Message = Record<string, unknown>>(
  stream: Readable,
  onMessage: (message: Message) => void,
  onGarbage?: (line: string) => void,
): void => {
  // Everything since the last newline, which is the half-message a chunk
  // boundary leaves behind.
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim() === "") continue;
      let message: Message;
      try {
        message = JSON.parse(line) as Message;
      } catch (cause) {
        if (onGarbage === undefined) throw cause;
        onGarbage(line);
        continue;
      }
      onMessage(message);
    }
  });
};
