import * as os from "node:os"

const HOSTNAME_ENV_VAR = "OLAI_HOSTNAME"

export const hostnameReading = (): { value: string; author: "env" | "process" } => {
  const asked = process.env[HOSTNAME_ENV_VAR]?.trim()
  return asked === undefined || asked === ""
    ? { value: os.hostname(), author: "process" }
    : { value: asked, author: "env" }
}

export const hostname = (): string => hostnameReading().value
