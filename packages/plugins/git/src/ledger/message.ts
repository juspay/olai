import { MESSAGE_PREFIX, type Writer } from "@olai/format"

const WRITER_TRAILER = "X-Olai-Writer"

export const AUDIT = { prefix: MESSAGE_PREFIX, trailer: WRITER_TRAILER } as const

export const signed = (message: string, writer: Writer): string => {
  const said = message.trim() === "" ? `${MESSAGE_PREFIX}: commit` : message.trim()
  const prefixed = said.startsWith(MESSAGE_PREFIX) ? said : `${MESSAGE_PREFIX}: ${said}`
  return `${prefixed}\n\n${WRITER_TRAILER}: ${writer}\n`
}
