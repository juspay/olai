/** Resolve the kolu command to hand to a conversation, without launching it.
 *
 * The session's real MCP connection is responsible for initialization and
 * daemon errors. A disposable connection delayed every chat and could not
 * guarantee that the next connection would work. `probe` retains the existing
 * session-start registration API, but performs only executable discovery.
 */
import { access, stat } from "node:fs/promises"
import { constants } from "node:fs"
import { delimiter, resolve } from "node:path"
import type { Probed } from "@olai/plugin-api/services"
import { KOLU_COMMAND, KOLU_MCP_ARGS, PADI_SOCKET_ENV } from "olai-plugin-kolu/appliance/detect"

export type { Probed } from "@olai/plugin-api/services"

export const probe = async (env: Record<string, string | undefined>): Promise<Probed> => {
  const socket = env[PADI_SOCKET_ENV]
  for (const directory of (env["PATH"] ?? "").split(delimiter)) {
    if (directory === "") continue
    const command = resolve(directory, KOLU_COMMAND)
    try {
      if (!(await stat(command)).isFile()) continue
      await access(command, constants.X_OK)
    } catch {
      continue
    }
    return {
      server: {
        name: KOLU_COMMAND,
        command,
        args: [...KOLU_MCP_ARGS],
        env: socket ? { [PADI_SOCKET_ENV]: socket } : {},
      },
      missing: null,
    }
  }
  return {
    server: null,
    missing: socket
      ? { name: KOLU_COMMAND, where: null,
        why: `\`${PADI_SOCKET_ENV}\` is set, but no \`${KOLU_COMMAND}\` is on the PATH this server was started with` }
      : null,
  }
}
