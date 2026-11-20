import { AGENT_ENV } from "@kolu/acp/engine"
import type { OffBecause } from "olai-plugin-chat/wire"
export { AGENT_ENV }

export const AGENT_PATH_ENV = "OLAI_AGENT_PATH"

export const whyNoAgent = (because: OffBecause): string => {
  switch (because.kind) {
    case "no-engine":
      return `no agent: this serve mounted no engine plugin, so nothing was probed. Every ` +
        `agent olai can seat is a plugin and every one of them is enabled by default, so this ` +
        `is a selection that enables none of them (or an engine fiber that failed — the ` +
        `plugins readout says which). The outlines are served as usual.`
    case "none-installed":
      return `no agent: every engine this serve has was asked and this machine has none of ` +
        `them — nothing was found on ${AGENT_PATH_ENV} (or PATH, where that is unset), and no ` +
        `adapter was baked in. The outlines are served as usual, and every chat says the ` +
        `same thing with each engine's own words on how to get it.`
  }
}
