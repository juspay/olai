import type { Readable } from "node:stream";

export const readMessages = <Message = Record<string, unknown>>(
  stream: Readable,
  onMessage: (message: Message) => void,
  onGarbage?: (line: string) => void,
): void => {
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
