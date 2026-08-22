/**
 * A reverse proxy that stamps trusted identity headers on every request,
 * including the websocket upgrade.
 *
 * Playwright's `setExtraHTTPHeaders` does not apply to websocket connections
 * — the browser WebSocket constructor cannot set them — so a chip that reads
 * identity off the upgrade never saw what `proxyInjects` wrote. A real reverse
 * proxy (`tailscale serve`) sits in front and writes the headers as it
 * forwards. This is that, for a scenario.
 *
 * Implemented over raw TCP rather than `http.createServer`'s `upgrade`
 * socket: bun's HTTP upgrade socket accepts a write of the 101 and never
 * delivers it to the client (probed 2026-08-22). `net.Socket` splice does.
 */

import * as http from "node:http";
import * as net from "node:net";

export interface HeaderProxy {
  readonly url: string;
  readonly close: () => Promise<void>;
}

export const listenHeaderProxy = (
  backend: string,
  headers: () => Record<string, string>,
): Promise<HeaderProxy> =>
  new Promise((resolve, reject) => {
    const target = new URL(backend);
    const server = net.createServer((client) => {
      readHead(client, (head, rest) => {
        const { requestLine, headerLines, isUpgrade } = parseHead(head);
        const injected = headers();
        if (isUpgrade) {
          const up = net.connect(Number(target.port), target.hostname, () => {
            up.write(rewrittenHead(requestLine, headerLines, target, injected));
            if (rest.length > 0) up.write(rest);
            splice(up, client);
            splice(client, up);
          });
          up.on("error", () => client.destroy());
          return;
        }
        const upstream = http.request(
          {
            hostname: target.hostname,
            port: target.port,
            path: pathOf(requestLine),
            method: methodOf(requestLine),
            headers: hopFree(
              towards(headerObject(headerLines), target, injected),
            ),
          },
          (answer) => {
            client.write(
              `HTTP/1.1 ${answer.statusCode ?? 502} ${answer.statusMessage ?? ""}\r\n`,
            );
            for (const [name, value] of Object.entries(hopFree(answer.headers))) {
              if (value === undefined) continue;
              const values = Array.isArray(value) ? value : [value];
              for (const one of values) client.write(`${name}: ${one}\r\n`);
            }
            client.write("\r\n");
            answer.on("data", (chunk) => client.write(chunk as Buffer));
            answer.on("end", () => client.end());
            answer.on("error", () => client.destroy());
          },
        );
        upstream.on("error", () => client.destroy());
        if (rest.length > 0) upstream.write(rest);
        client.on("data", (chunk) => upstream.write(chunk));
        client.on("end", () => upstream.end());
        // A GET/HEAD is complete in the head we already parsed; the client
        // will not send more. A body (capture, etc.) ends when the client
        // does.
        const method = methodOf(requestLine);
        if (method === "GET" || method === "HEAD") upstream.end();
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("header proxy bound no port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done, fail) =>
            server.close((cause) => (cause ? fail(cause) : done())),
          ),
      });
    });
  });

const splice = (from: net.Socket, to: net.Socket): void => {
  from.on("data", (chunk) => to.write(chunk));
  from.on("end", () => to.end());
  from.on("close", () => to.destroy());
  from.on("error", () => to.destroy());
};

const readHead = (
  socket: net.Socket,
  then: (head: Buffer, rest: Buffer) => void,
): void => {
  const chunks: Buffer[] = [];
  const onData = (chunk: Buffer) => {
    chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    const idx = buf.indexOf("\r\n\r\n");
    if (idx < 0) return;
    socket.removeListener("data", onData);
    then(buf.subarray(0, idx + 4), buf.subarray(idx + 4));
  };
  socket.on("data", onData);
};

const parseHead = (
  head: Buffer,
): {
  readonly requestLine: string;
  readonly headerLines: ReadonlyArray<string>;
  readonly isUpgrade: boolean;
} => {
  const text = head.toString("utf8");
  const lines = text.split("\r\n");
  const requestLine = lines[0] ?? "";
  const headerLines = lines.slice(1).filter((line) => line !== "");
  const isUpgrade = headerLines.some((line) =>
    line.toLowerCase().startsWith("upgrade:"),
  );
  return { requestLine, headerLines, isUpgrade };
};

const rewrittenHead = (
  requestLine: string,
  headerLines: ReadonlyArray<string>,
  target: URL,
  injected: Record<string, string>,
): string => {
  const taken = namesOf(injected);
  const lines = [requestLine];
  for (const line of headerLines) {
    const colon = line.indexOf(":");
    const name = colon < 0 ? line : line.slice(0, colon);
    const key = name.toLowerCase();
    if (taken.has(key)) continue;
    if (key === "host") lines.push(`Host: ${target.host}`);
    else if (key === "origin") lines.push(`Origin: ${target.origin}`);
    else lines.push(line);
  }
  for (const [name, value] of Object.entries(injected)) {
    lines.push(`${name}: ${value}`);
  }
  lines.push("", "");
  return lines.join("\r\n");
};

const methodOf = (requestLine: string): string =>
  requestLine.split(" ")[0] ?? "GET";

const pathOf = (requestLine: string): string =>
  requestLine.split(" ")[1] ?? "/";

const headerObject = (
  headerLines: ReadonlyArray<string>,
): http.IncomingHttpHeaders => {
  const out: http.IncomingHttpHeaders = {};
  for (const line of headerLines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    out[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
  }
  return out;
};

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const hopFree = (
  incoming: http.IncomingHttpHeaders | http.OutgoingHttpHeaders,
): http.OutgoingHttpHeaders => {
  const out: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(incoming)) {
    if (!HOP.has(name.toLowerCase())) out[name] = value;
  }
  return out;
};

const namesOf = (injected: Record<string, string>): Set<string> =>
  new Set(Object.keys(injected).map((name) => name.toLowerCase()));

const towards = (
  incoming: http.IncomingHttpHeaders,
  target: URL,
  injected: Record<string, string>,
): http.OutgoingHttpHeaders => {
  const taken = namesOf(injected);
  const out: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(incoming)) {
    if (!taken.has(name.toLowerCase())) out[name] = value;
  }
  for (const [name, value] of Object.entries(injected)) out[name] = value;
  out.host = target.host;
  if (incoming.origin !== undefined) out.origin = target.origin;
  return out;
};
